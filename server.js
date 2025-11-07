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
    clients: []
  }

  activeJobs.set(jobId, job)

  // Start the analysis process
  const cliPath = path.join(__dirname, 'scripts', 'figma-cli.js')
  const child = spawn('node', [cliPath, figmaUrl], {
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
    job.logs.push(log)

    // Broadcast to all connected clients
    job.clients.forEach(client => {
      client.write(`data: ${JSON.stringify({ type: 'log', message: log })}\n\n`)
    })
  })

  // Capture stderr
  child.stderr.on('data', (data) => {
    const log = data.toString()
    job.logs.push(log)

    // Broadcast to all connected clients
    job.clients.forEach(client => {
      client.write(`data: ${JSON.stringify({ type: 'log', message: log })}\n\n`)
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
      client.write(`data: ${JSON.stringify({ type: 'done', message: finalMessage, success: code === 0 })}\n\n`)
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
    res.write(`data: ${JSON.stringify({ type: 'done', success: true })}\n\n`)
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
            dailyLimit: 1200000,
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
    const percentUsed = (totalTokens / 1200000) * 100

    // Déterminer le statut
    let status
    if (percentUsed < 10) {
      status = { emoji: '✅', text: 'SAFE - Plenty of quota remaining', level: 'safe' }
    } else if (percentUsed < 50) {
      status = { emoji: '🟢', text: 'GOOD - Moderate usage', level: 'good' }
    } else if (percentUsed < 80) {
      status = { emoji: '🟡', text: 'WARNING - High usage', level: 'warning' }
    } else if (percentUsed < 95) {
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
          dailyLimit: 1200000,
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
