/**
 * Backend API Server
 * Gère l'exécution des analyses Figma et stream les logs en temps réel
 */

import express from 'express'
import { spawn } from 'child_process'
import { createServer as createViteServer } from 'vite'
import { createServer as createHttpServer } from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5173

// Middleware
app.use(express.json())

// Store active analysis jobs
const activeJobs = new Map()

/**
 * Strip ANSI color codes from text
 * Removes escape sequences like [1m, [32m, [0m, etc.
 */
function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '')
}

/**
 * POST /api/analyze
 * Lance une analyse Figma
 */
app.post('/api/analyze', async (req, res) => {
  const { figmaUrl } = req.body

  if (!figmaUrl) {
    return res.status(400).json({ error: 'URL Figma requise' })
  }

  // Validate Figma URL format
  if (!figmaUrl.includes('figma.com')) {
    return res.status(400).json({ error: 'URL Figma invalide' })
  }

  // Generate unique job ID
  const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Create job metadata
  const job = {
    id: jobId,
    url: figmaUrl,
    status: 'running',
    startTime: Date.now(),
    logs: [],
    clients: [],
    testId: null // Will be extracted from logs
  }

  activeJobs.set(jobId, job)

  // Start the analysis process
  const cliPath = path.join(__dirname, 'scripts', 'figma-cli.js')
  const child = spawn('node', [cliPath, figmaUrl, '--clean'], {
    cwd: __dirname,
    env: {
      ...process.env,
      FORCE_COLOR: '1' // Keep ANSI colors for react-lazylog
    }
  })

  job.process = child

  // Capture stdout
  child.stdout.on('data', (data) => {
    const log = data.toString()
    const cleanLog = stripAnsi(log)
    job.logs.push(cleanLog)

    // Extract testId from logs (format: "TEST_ID: node-XXX-XXX")
    const testIdMatch = cleanLog.match(/TEST_ID:\s*(node-[^\s\n]+)/)
    if (testIdMatch) {
      job.testId = testIdMatch[1].trim()
      console.log('✓ Test ID extracted:', job.testId) // Debug log
    }

    // Broadcast to all connected clients
    job.clients.forEach(client => {
      client.write(`data: ${JSON.stringify({ type: 'log', message: cleanLog })}\n\n`)
    })
  })

  // Capture stderr
  child.stderr.on('data', (data) => {
    const log = data.toString()
    const cleanLog = stripAnsi(log)
    job.logs.push(cleanLog)

    // Broadcast to all connected clients
    job.clients.forEach(client => {
      client.write(`data: ${JSON.stringify({ type: 'log', message: cleanLog })}\n\n`)
    })
  })

  // Handle process exit
  child.on('close', (code) => {
    job.status = code === 0 ? 'completed' : 'failed'
    job.endTime = Date.now()
    job.exitCode = code

    const finalMessage = code === 0
      ? '\n✓ Analyse terminée avec succès\n'
      : `\n✗ Analyse échouée (code: ${code})\n`

    job.logs.push(finalMessage)

    // Broadcast completion to all clients
    job.clients.forEach(client => {
      client.write(`data: ${JSON.stringify({ type: 'done', message: finalMessage, success: code === 0, testId: job.testId })}\n\n`)
    })

    // Don't close connections, let clients handle it
  })

  // Handle process errors
  child.on('error', (error) => {
    job.status = 'failed'
    job.error = error.message
    job.endTime = Date.now()

    const errorMessage = `\n✗ Erreur: ${error.message}\n`
    job.logs.push(errorMessage)

    // Broadcast error to all clients
    job.clients.forEach(client => {
      client.write(`data: ${JSON.stringify({ type: 'error', message: errorMessage })}\n\n`)
    })
  })

  res.json({
    jobId,
    status: 'started',
    message: 'Analyse lancée avec succès'
  })
})

/**
 * GET /api/analyze/logs/:jobId
 * Stream les logs d'une analyse via Server-Sent Events (SSE)
 */
app.get('/api/analyze/logs/:jobId', (req, res) => {
  const { jobId } = req.params
  const job = activeJobs.get(jobId)

  if (!job) {
    return res.status(404).json({ error: 'Job non trouvé' })
  }

  // Configure SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Send existing logs
  job.logs.forEach(log => {
    res.write(`data: ${JSON.stringify({ type: 'log', message: log })}\n\n`)
  })

  // Add client to broadcast list
  job.clients.push(res)

  // Send initial status if job already completed
  if (job.status === 'completed') {
    res.write(`data: ${JSON.stringify({ type: 'done', success: true, testId: job.testId })}\n\n`)
  } else if (job.status === 'failed') {
    res.write(`data: ${JSON.stringify({ type: 'done', success: false })}\n\n`)
  }

  // Handle client disconnect
  req.on('close', () => {
    const index = job.clients.indexOf(res)
    if (index !== -1) {
      job.clients.splice(index, 1)
    }

    // Clean up job if no clients and completed
    if (job.clients.length === 0 && (job.status === 'completed' || job.status === 'failed')) {
      setTimeout(() => {
        activeJobs.delete(jobId)
      }, 60000) // Keep for 1 minute after last client disconnects
    }
  })
})

/**
 * GET /api/analyze/status/:jobId
 * Récupère le statut d'une analyse
 */
app.get('/api/analyze/status/:jobId', (req, res) => {
  const { jobId } = req.params
  const job = activeJobs.get(jobId)

  if (!job) {
    return res.status(404).json({ error: 'Job non trouvé' })
  }

  res.json({
    jobId: job.id,
    status: job.status,
    url: job.url,
    startTime: job.startTime,
    endTime: job.endTime,
    exitCode: job.exitCode,
    logsCount: job.logs.length
  })
})

/**
 * DELETE /api/tests/:testId
 * Supprime un test et son dossier
 */
app.delete('/api/tests/:testId', async (req, res) => {
  const { testId } = req.params

  if (!testId || !testId.startsWith('node-')) {
    return res.status(400).json({ error: 'Test ID invalide' })
  }

  try {
    const { rm } = await import('fs/promises')
    const testPath = path.join(__dirname, 'src', 'generated', 'tests', testId)

    // Supprimer le dossier et tout son contenu
    await rm(testPath, { recursive: true, force: true })

    res.json({
      success: true,
      message: 'Test supprimé avec succès',
      testId
    })
  } catch (error) {
    console.error('Erreur lors de la suppression:', error)
    res.status(500).json({
      error: 'Erreur lors de la suppression du test',
      message: error.message
    })
  }
})

/**
 * GET /api/mcp/health
 * Vérifie la connexion au serveur MCP
 */
app.get('/api/mcp/health', async (req, res) => {
  try {
    // Try to connect to MCP server
    const mcpHost = process.env.MCP_HOST || 'host.docker.internal'
    const mcpPort = process.env.MCP_SERVER_PORT || 3845

    // Simple TCP connection test
    const net = await import('net')
    const socket = new net.Socket()

    socket.setTimeout(2000)

    socket.connect(mcpPort, mcpHost, () => {
      socket.destroy()
      res.json({ status: 'connected', message: 'MCP server is reachable' })
    })

    socket.on('error', () => {
      socket.destroy()
      res.status(503).json({ status: 'disconnected', message: 'MCP server is not reachable' })
    })

    socket.on('timeout', () => {
      socket.destroy()
      res.status(503).json({ status: 'disconnected', message: 'MCP server timeout' })
    })
  } catch (error) {
    res.status(503).json({ status: 'error', message: error.message })
  }
})

/**
 * GET /api/usage
 * Récupère les statistiques d'utilisation de l'API Figma
 */
app.get('/api/usage', (req, res) => {
  try {
    const usageFilePath = path.join(__dirname, 'data', 'figma-usage.json')

    // Load settings for dailyTokenLimit
    let dailyLimit = 1200000; // Default fallback
    try {
      const settingsPath = path.join(__dirname, 'cli', 'config', 'settings.json')
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
        dailyLimit = settings.apiLimits?.dailyTokenLimit || 1200000
      }
    } catch (err) {
      console.warn('Failed to load dailyTokenLimit from settings, using default:', err.message)
    }

    // Si le fichier n'existe pas, retourner des stats vides
    if (!fs.existsSync(usageFilePath)) {
      return res.json({
        today: {
          date: new Date().toISOString().split('T')[0],
          calls: {},
          totalCalls: 0,
          analyses: 0,
          credits: {
            min: 0,
            typical: 0,
            max: 0,
            dailyLimit: dailyLimit,
            percentUsed: 0
          }
        },
        historical: [],
        status: {
          emoji: '✅',
          text: 'SAFE - No usage yet',
          level: 'safe'
        }
      })
    }

    // Lire le fichier d'usage
    const usageData = JSON.parse(fs.readFileSync(usageFilePath, 'utf8'))
    const today = new Date().toISOString().split('T')[0]
    const todayData = usageData.daily[today] || { calls: {}, totalCalls: 0, analyses: 0, tokens: {}, totalTokens: 0 }

    // Use actual tokens from measurements
    const totalTokens = todayData.totalTokens || 0
    const percentUsed = (totalTokens / dailyLimit) * 100

    // Load thresholds from settings
    let thresholds = { warning: 50, critical: 75, danger: 90 }; // Defaults
    try {
      const settingsPath = path.join(__dirname, 'cli', 'config', 'settings.json')
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
        if (settings.apiLimits?.thresholds) {
          thresholds = settings.apiLimits.thresholds
        }
      }
    } catch (err) {
      console.warn('Failed to load thresholds from settings:', err.message)
    }

    // Déterminer le statut
    let status
    if (percentUsed < 10) {
      status = { emoji: '✅', text: 'SAFE - Plenty of quota remaining', level: 'safe' }
    } else if (percentUsed < thresholds.warning) {
      status = { emoji: '🟢', text: 'GOOD - Moderate usage', level: 'good' }
    } else if (percentUsed < thresholds.critical) {
      status = { emoji: '🟡', text: 'WARNING - High usage', level: 'warning' }
    } else if (percentUsed < thresholds.danger) {
      status = { emoji: '🟠', text: 'CRITICAL - Near limit', level: 'critical' }
    } else {
      status = { emoji: '🔴', text: 'DANGER - Likely exceeded limit', level: 'danger' }
    }

    // Historique 7 derniers jours
    const historical = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayData = usageData.daily[dateStr]

      if (dayData) {
        historical.push({
          date: dateStr,
          totalCalls: dayData.totalCalls,
          analyses: dayData.analyses,
          creditsEstimate: dayData.totalTokens || 0,
          calls: dayData.calls || {},
          tokens: dayData.tokens || {}
        })
      } else {
        historical.push({
          date: dateStr,
          totalCalls: 0,
          analyses: 0,
          creditsEstimate: 0,
          calls: {},
          tokens: {}
        })
      }
    }

    res.json({
      today: {
        date: today,
        calls: todayData.calls,
        totalCalls: todayData.totalCalls,
        analyses: todayData.analyses,
        tokens: todayData.tokens || {},
        credits: {
          min: totalTokens,
          typical: totalTokens,
          max: totalTokens,
          dailyLimit: dailyLimit,
          percentUsed,
          isActual: true
        }
      },
      historical,
      status
    })
  } catch (error) {
    console.error('Error reading usage data:', error)
    res.status(500).json({ error: 'Failed to read usage data' })
  }
})

/**
 * GET /api/tests/:testId/data
 * Récupère les données complètes d'un test (metadata.json, metadata.xml, analysis.md)
 */
app.get('/api/tests/:testId/data', async (req, res) => {
  const { testId } = req.params

  if (!testId || !testId.startsWith('node-')) {
    return res.status(400).json({ error: 'Test ID invalide' })
  }

  try {
    const testPath = path.join(__dirname, 'src', 'generated', 'tests', testId)

    // Vérifier que le dossier existe
    if (!fs.existsSync(testPath)) {
      return res.status(404).json({ error: 'Test non trouvé' })
    }

    const data = {}

    // Lire metadata.json
    const metadataPath = path.join(testPath, 'metadata.json')
    if (fs.existsSync(metadataPath)) {
      data.metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
    }

    // Lire metadata.xml
    const xmlPath = path.join(testPath, 'metadata.xml')
    if (fs.existsSync(xmlPath)) {
      const xmlContent = fs.readFileSync(xmlPath, 'utf8')
      data.metadataXml = xmlContent

      // Extraire layerName depuis XML
      const frameMatch = xmlContent.match(/<frame[^>]+name="([^"]+)"/)
      if (frameMatch && data.metadata) {
        data.metadata.layerName = frameMatch[1]
      }
    }

    // Lire analysis.md
    const analysisPath = path.join(testPath, 'analysis.md')
    if (fs.existsSync(analysisPath)) {
      data.analysis = fs.readFileSync(analysisPath, 'utf8')
    }

    res.json(data)
  } catch (error) {
    console.error('Error loading test data:', error)
    res.status(500).json({ error: 'Failed to load test data' })
  }
})

/**
 * GET /api/tests
 * Récupère la liste de tous les tests avec leurs métadonnées
 */
app.get('/api/tests', async (req, res) => {
  try {
    const testsDir = path.join(__dirname, 'src', 'generated', 'tests')

    // Vérifier que le dossier existe
    if (!fs.existsSync(testsDir)) {
      return res.json([])
    }

    // Lire tous les dossiers de tests
    const testFolders = fs.readdirSync(testsDir)
      .filter(name => name.startsWith('node-'))

    // Charger les métadonnées pour chaque test
    const tests = testFolders.map(testId => {
      try {
        const testPath = path.join(testsDir, testId)
        const metadataPath = path.join(testPath, 'metadata.json')
        const xmlPath = path.join(testPath, 'metadata.xml')

        // Lire metadata.json
        let metadata = {}
        if (fs.existsSync(metadataPath)) {
          metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
        }

        // Lire layerName depuis metadata.xml
        let layerName = null
        if (fs.existsSync(xmlPath)) {
          const xmlContent = fs.readFileSync(xmlPath, 'utf8')
          const frameMatch = xmlContent.match(/<frame[^>]+name="([^"]+)"/)
          layerName = frameMatch ? frameMatch[1] : null
        }

        return {
          ...metadata,
          testId,
          layerName
        }
      } catch (error) {
        console.error(`Error loading test ${testId}:`, error)
        return null
      }
    }).filter(test => test !== null)

    res.json(tests)
  } catch (error) {
    console.error('Error reading tests:', error)
    res.status(500).json({ error: 'Failed to read tests' })
  }
})

/**
 * GET /api/responsive-tests
 * Récupère la liste de tous les tests responsive avec leurs métadonnées
 */
app.get('/api/responsive-tests', async (req, res) => {
  try {
    const responsiveDir = path.join(__dirname, 'src', 'generated', 'responsive-screens')

    // Vérifier que le dossier existe
    if (!fs.existsSync(responsiveDir)) {
      return res.json([])
    }

    // Lire tous les dossiers de tests responsive
    const testFolders = fs.readdirSync(responsiveDir)
      .filter(name => name.startsWith('responsive-merger-'))

    // Charger les métadonnées pour chaque test
    const tests = testFolders.map(mergeId => {
      try {
        const testPath = path.join(responsiveDir, mergeId)
        const metadataPath = path.join(testPath, 'responsive-metadata.json')

        // Lire responsive-metadata.json
        if (fs.existsSync(metadataPath)) {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
          return metadata
        }

        return null
      } catch (error) {
        console.error(`Error loading responsive test ${mergeId}:`, error)
        return null
      }
    }).filter(test => test !== null)

    // Trier par timestamp décroissant (plus récent en premier)
    tests.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    res.json(tests)
  } catch (error) {
    console.error('Error reading responsive tests:', error)
    res.status(500).json({ error: 'Failed to read responsive tests' })
  }
})

/**
 * POST /api/responsive-tests/merge
 * Lance un nouveau merge responsive
 */
app.post('/api/responsive-tests/merge', async (req, res) => {
  const { desktop, tablet, mobile } = req.body

  // Validation
  if (!desktop || !tablet || !mobile) {
    return res.status(400).json({ error: 'Desktop, tablet et mobile requis' })
  }

  if (!desktop.size || !desktop.testId || !tablet.size || !tablet.testId || !mobile.size || !mobile.testId) {
    return res.status(400).json({ error: 'Chaque breakpoint doit avoir size et testId' })
  }

  // Valider que les tests existent
  const testsDir = path.join(__dirname, 'src', 'generated', 'tests')
  const desktopPath = path.join(testsDir, desktop.testId)
  const tabletPath = path.join(testsDir, tablet.testId)
  const mobilePath = path.join(testsDir, mobile.testId)

  if (!fs.existsSync(desktopPath) || !fs.existsSync(tabletPath) || !fs.existsSync(mobilePath)) {
    return res.status(400).json({ error: 'Un ou plusieurs tests n\'existent pas' })
  }

  // Generate unique job ID
  const jobId = `merge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const mergeId = `responsive-merger-${Date.now()}`

  // Create job metadata
  const job = {
    id: jobId,
    mergeId,
    breakpoints: { desktop, tablet, mobile },
    status: 'running',
    startTime: Date.now(),
    logs: [],
    clients: []
  }

  activeJobs.set(jobId, job)

  // Start the merge process
  const mergerPath = path.join(__dirname, 'scripts', 'responsive-merger.js')
  const child = spawn('node', [
    mergerPath,
    '--desktop', desktop.size, desktop.testId,
    '--tablet', tablet.size, tablet.testId,
    '--mobile', mobile.size, mobile.testId
  ], {
    cwd: __dirname,
    env: {
      ...process.env,
      FORCE_COLOR: '1'
    }
  })

  job.process = child

  // Capture stdout
  child.stdout.on('data', (data) => {
    const log = data.toString()
    const cleanLog = stripAnsi(log)
    job.logs.push(cleanLog)

    // Broadcast to all connected clients
    job.clients.forEach(client => {
      client.write(`data: ${JSON.stringify({ type: 'log', message: cleanLog })}\n\n`)
    })
  })

  // Capture stderr
  child.stderr.on('data', (data) => {
    const log = data.toString()
    const cleanLog = stripAnsi(log)
    job.logs.push(cleanLog)

    // Broadcast to all connected clients
    job.clients.forEach(client => {
      client.write(`data: ${JSON.stringify({ type: 'log', message: cleanLog })}\n\n`)
    })
  })

  // Handle process exit
  child.on('close', (code) => {
    job.status = code === 0 ? 'completed' : 'failed'
    job.endTime = Date.now()
    job.exitCode = code

    const finalMessage = code === 0
      ? '\n✓ Merge responsive terminé avec succès\n'
      : `\n✗ Merge responsive échoué (code: ${code})\n`

    job.logs.push(finalMessage)

    // Broadcast completion to all clients
    job.clients.forEach(client => {
      client.write(`data: ${JSON.stringify({ type: 'done', message: finalMessage, success: code === 0, mergeId })}\n\n`)
    })
  })

  // Handle process errors
  child.on('error', (error) => {
    job.status = 'failed'
    job.error = error.message
    job.endTime = Date.now()

    const errorMessage = `\n✗ Erreur: ${error.message}\n`
    job.logs.push(errorMessage)

    // Broadcast error to all clients
    job.clients.forEach(client => {
      client.write(`data: ${JSON.stringify({ type: 'error', message: errorMessage })}\n\n`)
    })
  })

  res.json({
    jobId,
    mergeId,
    status: 'started',
    message: 'Merge responsive lancé avec succès'
  })
})

/**
 * GET /api/responsive-tests/merge/logs/:jobId
 * Stream les logs d'un merge responsive via Server-Sent Events (SSE)
 */
app.get('/api/responsive-tests/merge/logs/:jobId', (req, res) => {
  const { jobId } = req.params
  const job = activeJobs.get(jobId)

  if (!job) {
    return res.status(404).json({ error: 'Job non trouvé' })
  }

  // Configure SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Send existing logs
  job.logs.forEach(log => {
    res.write(`data: ${JSON.stringify({ type: 'log', message: log })}\n\n`)
  })

  // Add client to broadcast list
  job.clients.push(res)

  // Send initial status if job already completed
  if (job.status === 'completed') {
    res.write(`data: ${JSON.stringify({ type: 'done', success: true, mergeId: job.mergeId })}\n\n`)
  } else if (job.status === 'failed') {
    res.write(`data: ${JSON.stringify({ type: 'done', success: false })}\n\n`)
  }

  // Handle client disconnect
  req.on('close', () => {
    const index = job.clients.indexOf(res)
    if (index !== -1) {
      job.clients.splice(index, 1)
    }

    // Clean up job if no clients and completed
    if (job.clients.length === 0 && (job.status === 'completed' || job.status === 'failed')) {
      setTimeout(() => {
        activeJobs.delete(jobId)
      }, 60000)
    }
  })
})

/**
 * DELETE /api/responsive-tests/:mergeId
 * Supprime un test responsive et son dossier
 */
app.delete('/api/responsive-tests/:mergeId', async (req, res) => {
  const { mergeId } = req.params

  if (!mergeId || !mergeId.startsWith('responsive-merger-')) {
    return res.status(400).json({ error: 'Merge ID invalide' })
  }

  try {
    const { rm } = await import('fs/promises')
    const testPath = path.join(__dirname, 'src', 'generated', 'responsive-screens', mergeId)

    // Supprimer le dossier et tout son contenu
    await rm(testPath, { recursive: true, force: true })

    res.json({
      success: true,
      message: 'Test responsive supprimé avec succès',
      mergeId
    })
  } catch (error) {
    console.error('Erreur lors de la suppression:', error)
    res.status(500).json({
      error: 'Erreur lors de la suppression du test responsive',
      message: error.message
    })
  }
})

/**
 * GET /api/responsive-tests/:mergeId/puck-config
 * Retourne la configuration Puck (liste des composants disponibles)
 */
app.get('/api/responsive-tests/:mergeId/puck-config', async (req, res) => {
  const { mergeId } = req.params

  if (!mergeId || !mergeId.startsWith('responsive-merger-')) {
    return res.status(400).json({ error: 'Merge ID invalide' })
  }

  try {
    const metadataPath = path.join(
      __dirname,
      'src/generated/responsive-screens',
      mergeId,
      'responsive-metadata.json'
    )

    if (!fs.existsSync(metadataPath)) {
      return res.status(404).json({ error: 'Test responsive introuvable' })
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))

    res.json({
      componentNames: metadata.components || [],
      breakpoints: metadata.breakpoints,
      mergeId: metadata.mergeId
    })
  } catch (error) {
    console.error('Erreur lors du chargement de la config Puck:', error)
    res.status(500).json({
      error: 'Erreur lors du chargement de la configuration',
      message: error.message
    })
  }
})

/**
 * GET /api/responsive-tests/:mergeId/puck-data
 * Retourne le layout Puck sauvegardé (ou null si pas encore sauvegardé)
 */
app.get('/api/responsive-tests/:mergeId/puck-data', async (req, res) => {
  const { mergeId } = req.params

  if (!mergeId || !mergeId.startsWith('responsive-merger-')) {
    return res.status(400).json({ error: 'Merge ID invalide' })
  }

  try {
    const dataPath = path.join(
      __dirname,
      'src/generated/responsive-screens',
      mergeId,
      'puck/puck-data.json'
    )

    if (!fs.existsSync(dataPath)) {
      // Pas encore de données sauvegardées, retourner null
      return res.json(null)
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
    res.json(data)
  } catch (error) {
    console.error('Erreur lors du chargement des données Puck:', error)
    res.status(500).json({
      error: 'Erreur lors du chargement des données',
      message: error.message
    })
  }
})

/**
 * POST /api/responsive-tests/:mergeId/puck-save
 * Sauvegarde le layout Puck
 */
app.post('/api/responsive-tests/:mergeId/puck-save', async (req, res) => {
  const { mergeId } = req.params

  if (!mergeId || !mergeId.startsWith('responsive-merger-')) {
    return res.status(400).json({ error: 'Merge ID invalide' })
  }

  try {
    const puckDir = path.join(
      __dirname,
      'src/generated/responsive-screens',
      mergeId,
      'puck'
    )

    if (!fs.existsSync(puckDir)) {
      return res.status(404).json({ error: 'Dossier Puck introuvable' })
    }

    const dataPath = path.join(puckDir, 'puck-data.json')

    // Sauvegarder les données Puck
    fs.writeFileSync(dataPath, JSON.stringify(req.body, null, 2))

    res.json({
      success: true,
      message: 'Layout Puck sauvegardé avec succès',
      mergeId
    })
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error)
    res.status(500).json({
      error: 'Erreur lors de la sauvegarde du layout',
      message: error.message
    })
  }
})

/**
 * GET /api/responsive-tests/:mergeId/images/:imageName
 * Servir les images pour Puck Editor
 */
app.get('/api/responsive-tests/:mergeId/images/:imageName', (req, res) => {
  const { mergeId, imageName } = req.params

  if (!mergeId || !mergeId.startsWith('responsive-merger-')) {
    return res.status(400).json({ error: 'Merge ID invalide' })
  }

  try {
    const imagePath = path.join(
      __dirname,
      'src/generated/responsive-screens',
      mergeId,
      'puck/img',
      imageName
    )

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image non trouvée' })
    }

    // Servir l'image avec le bon Content-Type
    res.sendFile(imagePath)
  } catch (error) {
    console.error('Erreur lors du chargement de l\'image:', error)
    res.status(500).json({
      error: 'Erreur lors du chargement de l\'image',
      message: error.message
    })
  }
})

/**
 * GET /api/download/:testId
 * Télécharge un test complet en archive ZIP
 */
app.get('/api/download/:testId', async (req, res) => {
  const { testId } = req.params

  if (!testId || !testId.startsWith('node-')) {
    return res.status(400).json({ error: 'Test ID invalide' })
  }

  try {
    const { default: archiver } = await import('archiver')
    const fs = await import('fs')
    const testPath = path.join(__dirname, 'src', 'generated', 'tests', testId)

    // Vérifier que le dossier existe
    if (!fs.existsSync(testPath)) {
      return res.status(404).json({ error: 'Test non trouvé' })
    }

    // Créer l'archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Niveau de compression maximum
    })

    // Gérer les erreurs de l'archive
    archive.on('error', (err) => {
      console.error('Erreur lors de la création du ZIP:', err)
      res.status(500).json({ error: 'Erreur lors de la création de l\'archive' })
    })

    // Configuration des headers pour le téléchargement
    res.attachment(`${testId}.zip`)
    res.setHeader('Content-Type', 'application/zip')

    // Pipe l'archive vers la réponse
    archive.pipe(res)

    // Ajouter tout le contenu du dossier au ZIP
    archive.directory(testPath, false)

    // Finaliser l'archive
    await archive.finalize()

    console.log(`✓ Archive ${testId}.zip créée et envoyée`)
  } catch (error) {
    console.error('Erreur lors du téléchargement:', error)
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Erreur lors du téléchargement',
        message: error.message
      })
    }
  }
})

/**
 * GET /api/settings
 * Récupère la configuration actuelle
 */
app.get('/api/settings', (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'cli', 'config', 'settings.json')

    if (!fs.existsSync(settingsPath)) {
      return res.status(404).json({ error: 'Settings file not found' })
    }

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    res.json(settings)
  } catch (error) {
    console.error('Error reading settings:', error)
    res.status(500).json({ error: 'Failed to read settings' })
  }
})

/**
 * POST /api/settings
 * Sauvegarde la configuration
 */
app.post('/api/settings', (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'cli', 'config', 'settings.json')
    const newSettings = req.body

    // Validation basique
    if (!newSettings || typeof newSettings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings data' })
    }

    // Sauvegarder avec indentation pour lisibilité
    fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), 'utf8')

    res.json({
      success: true,
      message: 'Settings saved successfully',
      settings: newSettings
    })
  } catch (error) {
    console.error('Error saving settings:', error)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

/**
 * POST /api/settings/reset
 * Réinitialise la configuration aux valeurs par défaut
 */
app.post('/api/settings/reset', (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'cli', 'config', 'settings.json')

    // Valeurs par défaut
    const defaultSettings = {
      "mcp": {
        "serverUrl": "http://host.docker.internal:3845/mcp",
        "callDelay": 1000,
        "minDelay": 500,
        "maxDelay": 5000
      },
      "generation": {
        "defaultMode": "both",
        "chunking": {
          "enabled": true
        }
      },
      "directories": {
        "testsOutput": "src/generated/tests",
        "tmpAssets": "tmp/figma-assets"
      },
      "apiLimits": {
        "dailyTokenLimit": 1200000,
        "thresholds": {
          "warning": 50,
          "critical": 75,
          "danger": 90
        }
      },
      "ui": {
        "defaultView": "grid",
        "itemsPerPage": 12,
        "responsiveDefaultView": "grid",
        "responsiveItemsPerPage": 12
      },
      "screenshots": {
        "format": "png",
        "quality": 90
      },
      "docker": {
        "containerName": "mcp-figma-v1"
      },
      "transforms": {
        "font-detection": {
          "enabled": true,
          "usePostScriptName": true,
          "useTextStyleId": true
        },
        "auto-layout": {
          "enabled": true,
          "fixMissingGap": true,
          "fixMissingAlignments": true,
          "fixSizing": true
        },
        "ast-cleaning": {
          "enabled": true
        },
        "svg-icon-fixes": {
          "enabled": true
        },
        "post-fixes": {
          "enabled": true,
          "fixShadows": true,
          "fixTextTransform": true
        },
        "position-fixes": {
          "enabled": true,
          "convertAbsoluteToRelative": true,
          "skipOverlays": true
        },
        "stroke-alignment": {
          "enabled": true,
          "useBoxShadowForInside": true,
          "useOutlineForOutside": true
        },
        "css-vars": {
          "enabled": true
        },
        "tailwind-optimizer": {
          "enabled": true
        },
        "continueOnError": false
      }
    }

    fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf8')

    res.json({
      success: true,
      message: 'Settings reset to defaults',
      settings: defaultSettings
    })
  } catch (error) {
    console.error('Error resetting settings:', error)
    res.status(500).json({ error: 'Failed to reset settings' })
  }
})

/**
 * Start Vite dev server and API server
 */
async function startServer() {
  try {
    // IMPORTANT: Create HTTP server FIRST
    const httpServer = createHttpServer(app)

    // Create Vite server in middleware mode
    // Pass httpServer to HMR config for WebSocket support
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer  // FIX: Pass HTTP server for WebSocket
        }
      },
      appType: 'spa'
    })

    // Use Vite's middleware AFTER API routes
    app.use(vite.middlewares)

    // Start HTTP server
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`)
      console.log(`📡 API endpoints available:`)
      console.log(`   POST /api/analyze`)
      console.log(`   GET  /api/analyze/logs/:jobId`)
      console.log(`   GET  /api/analyze/status/:jobId`)
      console.log(`   GET  /api/usage`)
      console.log(`   GET  /api/mcp/health`)
      console.log(`   GET  /api/settings`)
      console.log(`   POST /api/settings`)
      console.log(`   POST /api/settings/reset`)
      console.log(`\n💡 Open http://localhost:${PORT} in your browser`)
    })

    // Handle server shutdown gracefully
    process.on('SIGTERM', () => {
      console.log('\n👋 SIGTERM received, closing server...')
      httpServer.close(() => {
        console.log('✓ Server closed')
        process.exit(0)
      })
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
