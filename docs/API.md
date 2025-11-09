# 🌐 API Reference

> Complete REST API and SSE documentation

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Analysis](#analysis)
  - [Tests](#tests)
  - [MCP Health](#mcp-health)
  - [Usage Statistics](#usage-statistics)
- [Server-Sent Events](#server-sent-events)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Examples](#examples)

---

## Overview

The MCP Figma to Code API provides HTTP endpoints for:
- Triggering Figma design analyses
- Managing test outputs
- Monitoring MCP server health
- Tracking API usage

**Server:** Express.js with SSE support
**Port:** 5173 (development)
**Protocol:** HTTP/1.1 + SSE

---

## Base URL

**Development:**
```
http://localhost:5173/api
```

**Production:**
```
https://your-domain.com/api
```

All endpoints are prefixed with `/api`.

---

## Authentication

**Current Status:** None (local development)

**Future:** JWT-based authentication planned

For production deployments, implement authentication middleware:

```javascript
// Example authentication middleware
function authenticate(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Verify token
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Forbidden' })
    req.user = user
    next()
  })
}
```

---

## Endpoints

### Analysis

#### POST /api/analyze

Start a new Figma design analysis.

**Request:**

```http
POST /api/analyze HTTP/1.1
Content-Type: application/json

{
  "figmaUrl": "https://www.figma.com/design/FILE_ID?node-id=X-Y"
}
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `figmaUrl` | string | Yes | Full Figma URL with node-id parameter |

**Response (202 Accepted):**

```json
{
  "jobId": "job-1735689600-abc123",
  "status": "started",
  "message": "Analysis started"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | string | Unique job identifier for tracking |
| `status` | string | Job status: "started" |
| `message` | string | Human-readable message |

**Errors:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Missing Figma URL` | Request body missing `figmaUrl` |
| 400 | `Invalid Figma URL format` | URL doesn't match expected pattern |
| 500 | `Failed to start analysis` | Server error spawning process |

**Example (curl):**

```bash
curl -X POST http://localhost:5173/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"figmaUrl":"https://www.figma.com/design/ABC?node-id=1-2"}'
```

**Example (JavaScript):**

```javascript
const response = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    figmaUrl: 'https://www.figma.com/design/ABC?node-id=1-2'
  })
})

const { jobId } = await response.json()
console.log('Job started:', jobId)
```

---

#### GET /api/analyze/logs/:jobId

Stream real-time analysis logs via Server-Sent Events.

**Request:**

```http
GET /api/analyze/logs/job-1735689600-abc123 HTTP/1.1
Accept: text/event-stream
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `jobId` | string | Job ID from POST /api/analyze |

**Response (SSE Stream):**

```
event: log
data: {"type":"log","message":"Connecting to MCP server..."}

event: log
data: {"type":"log","message":"Extracting metadata..."}

event: log
data: {"type":"log","message":"Processing chunk: Header"}

event: complete
data: {"type":"complete","result":{"nodeId":"9:2654","testDir":"src/generated/tests/node-9-2654-1735689600"}}
```

**Event Types:**

| Type | Description | Data Fields |
|------|-------------|-------------|
| `log` | Progress message | `type`, `message` |
| `complete` | Analysis finished | `type`, `result` |
| `error` | Analysis failed | `type`, `error` |

**Errors:**

| Status | Error | Description |
|--------|-------|-------------|
| 404 | `Job not found` | Invalid jobId |

**Example (JavaScript):**

```javascript
const eventSource = new EventSource(`/api/analyze/logs/${jobId}`)

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data)

  if (data.type === 'log') {
    console.log('Log:', data.message)
  } else if (data.type === 'complete') {
    console.log('Complete:', data.result)
    eventSource.close()
  } else if (data.type === 'error') {
    console.error('Error:', data.error)
    eventSource.close()
  }
})

eventSource.addEventListener('error', () => {
  console.error('SSE connection error')
})
```

---

#### GET /api/analyze/status/:jobId

Check analysis job status.

**Request:**

```http
GET /api/analyze/status/job-1735689600-abc123 HTTP/1.1
```

**Response (200 OK):**

```json
{
  "jobId": "job-1735689600-abc123",
  "status": "completed",
  "result": {
    "nodeId": "9:2654",
    "testDir": "src/generated/tests/node-9-2654-1735689600"
  }
}
```

**Status Values:**

| Status | Description |
|--------|-------------|
| `running` | Analysis in progress |
| `completed` | Analysis finished successfully |
| `failed` | Analysis failed with error |

**Errors:**

| Status | Error | Description |
|--------|-------|-------------|
| 404 | `Job not found` | Invalid jobId |

---

### Tests

#### GET /api/tests

List all available tests.

**Request:**

```http
GET /api/tests HTTP/1.1
```

**Response (200 OK):**

```json
[
  {
    "id": "node-9-2654-1735689600",
    "nodeId": "9:2654",
    "nodeName": "Hero Section",
    "timestamp": 1735689600,
    "stats": {
      "totalNodes": 245,
      "imagesOrganized": 12,
      "totalFixes": 87,
      "executionTime": 2345
    }
  },
  {
    "id": "node-104-871-1735689500",
    "nodeId": "104:871",
    "nodeName": "Pricing Cards",
    "timestamp": 1735689500,
    "stats": {
      "totalNodes": 189,
      "imagesOrganized": 8,
      "totalFixes": 52,
      "executionTime": 1890
    }
  }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Test directory name |
| `nodeId` | string | Figma node ID |
| `nodeName` | string | Figma layer name |
| `timestamp` | number | Unix timestamp (seconds) |
| `stats` | object | Processing statistics |

**Example (curl):**

```bash
curl http://localhost:5173/api/tests
```

**Example (JavaScript):**

```javascript
const tests = await fetch('/api/tests').then(r => r.json())
console.log(`Found ${tests.length} tests`)
```

---

#### DELETE /api/tests/:testId

Delete a test and all its files.

**Request:**

```http
DELETE /api/tests/node-9-2654-1735689600 HTTP/1.1
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `testId` | string | Test directory name |

**Response (200 OK):**

```json
{
  "success": true,
  "testId": "node-9-2654-1735689600"
}
```

**Errors:**

| Status | Error | Description |
|--------|-------|-------------|
| 404 | `Test not found` | Invalid testId |
| 500 | `Failed to delete test` | File system error |

**Example (curl):**

```bash
curl -X DELETE http://localhost:5173/api/tests/node-9-2654-1735689600
```

**Example (JavaScript):**

```javascript
const response = await fetch(`/api/tests/${testId}`, {
  method: 'DELETE'
})

if (response.ok) {
  console.log('Test deleted successfully')
}
```

---

#### GET /api/download/:testId

Download test as ZIP archive.

**Request:**

```http
GET /api/download/node-9-2654-1735689600 HTTP/1.1
```

**Response (200 OK):**

```
Content-Type: application/zip
Content-Disposition: attachment; filename="node-9-2654-1735689600.zip"

[Binary ZIP data]
```

**ZIP Contents:**
```
node-9-2654-1735689600/
├── Component-fixed.tsx
├── Component-fixed.css
├── Component-clean.tsx (if --clean)
├── Component-clean.css (if --clean)
├── chunks-fixed/
├── img/
├── metadata.json
├── analysis.md
├── report.html
├── figma-render.png
└── web-render.png
```

**Errors:**

| Status | Error | Description |
|--------|-------|-------------|
| 404 | `Test not found` | Invalid testId |
| 500 | `Failed to create archive` | ZIP creation error |

**Example (Browser):**

```html
<a href="/api/download/node-9-2654-1735689600" download>
  Download Test
</a>
```

**Example (JavaScript):**

```javascript
// Trigger download
window.location.href = `/api/download/${testId}`

// Or fetch and save
const response = await fetch(`/api/download/${testId}`)
const blob = await response.blob()
const url = window.URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = `${testId}.zip`
a.click()
```

---

### MCP Health

#### GET /api/mcp/health

Check MCP server connection status.

**Request:**

```http
GET /api/mcp/health HTTP/1.1
```

**Response (200 OK):**

```json
{
  "status": "connected",
  "serverUrl": "http://host.docker.internal:3845/mcp",
  "timestamp": 1735689600
}
```

**Response (503 Service Unavailable):**

```json
{
  "status": "disconnected",
  "serverUrl": "http://host.docker.internal:3845/mcp",
  "error": "Connection refused",
  "timestamp": 1735689600
}
```

**Status Values:**

| Status | HTTP Code | Description |
|--------|-----------|-------------|
| `connected` | 200 | MCP server reachable |
| `disconnected` | 503 | MCP server unreachable |

**Example (curl):**

```bash
curl http://localhost:5173/api/mcp/health
```

**Example (JavaScript):**

```javascript
async function checkMcpHealth() {
  const response = await fetch('/api/mcp/health')
  const { status } = await response.json()

  if (status === 'connected') {
    console.log('✅ MCP Connected')
  } else {
    console.log('🔴 MCP Disconnected')
  }
}

// Poll every 30 seconds
setInterval(checkMcpHealth, 30000)
```

---

### Usage Statistics

#### GET /api/usage

Get Figma API usage statistics.

**Request:**

```http
GET /api/usage HTTP/1.1
```

**Response (200 OK):**

```json
{
  "today": {
    "date": "2025-01-09",
    "calls": {
      "get_metadata": 5,
      "get_design_context": 23,
      "get_screenshot": 5,
      "get_variable_defs": 5,
      "total": 38
    },
    "tokens": {
      "estimated": 125000,
      "min": 100000,
      "max": 150000
    },
    "analyses": 5
  },
  "historical": [
    {
      "date": "2025-01-08",
      "calls": { "total": 42 },
      "tokens": { "estimated": 140000 },
      "analyses": 6
    },
    {
      "date": "2025-01-07",
      "calls": { "total": 31 },
      "tokens": { "estimated": 95000 },
      "analyses": 4
    }
  ],
  "status": {
    "level": "GOOD",
    "percentage": 10.4,
    "dailyLimit": 1200000,
    "remaining": 1075000
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `today` | object | Today's usage statistics |
| `today.calls` | object | API call counts by tool |
| `today.tokens` | object | Token usage estimates |
| `today.analyses` | number | Number of analyses run |
| `historical` | array | Past 7 days statistics |
| `status` | object | Current usage status |
| `status.level` | string | SAFE / GOOD / WARNING / CRITICAL / DANGER |
| `status.percentage` | number | Percentage of daily limit used |

**Status Levels:**

| Level | Percentage | Color | Description |
|-------|------------|-------|-------------|
| SAFE | <10% | Green | Plenty of quota remaining |
| GOOD | 10-50% | Green | Moderate usage |
| WARNING | 50-80% | Yellow | High usage |
| CRITICAL | 80-95% | Orange | Near limit |
| DANGER | >95% | Red | Likely exceeded limit |

**Example (curl):**

```bash
curl http://localhost:5173/api/usage
```

**Example (JavaScript):**

```javascript
async function fetchUsage() {
  const usage = await fetch('/api/usage').then(r => r.json())

  console.log(`Today: ${usage.today.calls.total} calls`)
  console.log(`Status: ${usage.status.level} (${usage.status.percentage}%)`)
  console.log(`Remaining: ${usage.status.remaining} tokens`)
}
```

---

## Server-Sent Events

### SSE Connection

Server-Sent Events provide real-time updates during analysis.

**Connection:**

```javascript
const eventSource = new EventSource('/api/analyze/logs/JOB_ID')
```

**Event Structure:**

```
event: MESSAGE_TYPE
data: JSON_DATA
```

**Message Types:**

| Type | Purpose | Example Data |
|------|---------|--------------|
| `log` | Progress update | `{"type":"log","message":"Processing..."}` |
| `complete` | Success | `{"type":"complete","result":{...}}` |
| `error` | Failure | `{"type":"error","error":"Failed"}` |

**Handling Events:**

```javascript
const eventSource = new EventSource(`/api/analyze/logs/${jobId}`)

// Method 1: Generic message handler
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  console.log(data)
}

// Method 2: Specific event handlers
eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data)

  switch (data.type) {
    case 'log':
      appendLog(data.message)
      break
    case 'complete':
      handleSuccess(data.result)
      eventSource.close()
      break
    case 'error':
      handleError(data.error)
      eventSource.close()
      break
  }
})

// Error handling
eventSource.onerror = () => {
  console.error('SSE connection error')
  eventSource.close()
}
```

**Closing Connection:**

```javascript
// Always close when done
eventSource.close()
```

---

## Error Handling

### Error Response Format

All errors follow this format:

```json
{
  "error": "Error message here"
}
```

**Example:**

```json
{
  "error": "Invalid Figma URL format"
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET/DELETE |
| 202 | Accepted | Analysis started |
| 400 | Bad Request | Invalid input |
| 404 | Not Found | Resource not found |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | MCP disconnected |

### Client Error Handling

```javascript
async function handleRequest(url, options) {
  try {
    const response = await fetch(url, options)

    if (!response.ok) {
      const { error } = await response.json()
      throw new Error(error || `HTTP ${response.status}`)
    }

    return await response.json()
  } catch (err) {
    console.error('API error:', err.message)
    // Show user-friendly error
    alert('Something went wrong. Please try again.')
  }
}
```

---

## Rate Limiting

**Current Status:** None (local development)

**Planned Implementation:**

```javascript
// Example rate limiter
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // Max requests per window
  message: 'Too many requests, please try again later'
})

app.use('/api/', limiter)
```

**Recommended Limits:**

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| POST /api/analyze | 10 requests | 15 min |
| GET /api/tests | 100 requests | 15 min |
| GET /api/usage | 100 requests | 15 min |
| DELETE /api/tests/:id | 20 requests | 15 min |

---

## Examples

### Complete Analysis Workflow

```javascript
async function analyzeDesign(figmaUrl) {
  // 1. Start analysis
  const { jobId } = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ figmaUrl })
  }).then(r => r.json())

  console.log('Started job:', jobId)

  // 2. Stream logs
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(`/api/analyze/logs/${jobId}`)

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'log') {
        console.log('📝', data.message)
      } else if (data.type === 'complete') {
        console.log('✅ Complete:', data.result)
        eventSource.close()
        resolve(data.result)
      } else if (data.type === 'error') {
        console.error('❌ Error:', data.error)
        eventSource.close()
        reject(new Error(data.error))
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      reject(new Error('SSE connection failed'))
    }
  })
}

// Usage
try {
  const result = await analyzeDesign('https://www.figma.com/design/...')
  console.log('Test created:', result.testDir)
} catch (err) {
  console.error('Analysis failed:', err.message)
}
```

### Polling Status (Alternative to SSE)

```javascript
async function pollStatus(jobId) {
  while (true) {
    const { status, result } = await fetch(`/api/analyze/status/${jobId}`)
      .then(r => r.json())

    if (status === 'completed') {
      console.log('✅ Complete:', result)
      return result
    } else if (status === 'failed') {
      throw new Error('Analysis failed')
    }

    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}
```

### React Hook for Analysis

```typescript
function useAnalysis() {
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [result, setResult] = useState(null)
  const [error, setError] = useState<string | null>(null)

  const analyze = async (figmaUrl: string) => {
    setLoading(true)
    setLogs([])
    setError(null)

    try {
      // Start analysis
      const { jobId } = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figmaUrl })
      }).then(r => r.json())

      // Stream logs
      const eventSource = new EventSource(`/api/analyze/logs/${jobId}`)

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.type === 'log') {
          setLogs(prev => [...prev, data.message])
        } else if (data.type === 'complete') {
          setResult(data.result)
          setLoading(false)
          eventSource.close()
        } else if (data.type === 'error') {
          setError(data.error)
          setLoading(false)
          eventSource.close()
        }
      }
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return { analyze, loading, logs, result, error }
}

// Usage in component
function AnalysisForm() {
  const { analyze, loading, logs, result, error } = useAnalysis()

  const handleSubmit = (e) => {
    e.preventDefault()
    const figmaUrl = e.target.figmaUrl.value
    analyze(figmaUrl)
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="figmaUrl" placeholder="Figma URL" />
      <button disabled={loading}>
        {loading ? 'Analyzing...' : 'Start Analysis'}
      </button>

      {logs.map((log, i) => <div key={i}>{log}</div>)}
      {error && <div>Error: {error}</div>}
      {result && <div>Success! Test: {result.testDir}</div>}
    </form>
  )
}
```

---

## Next Steps

- See [ARCHITECTURE.md](ARCHITECTURE.md) for server implementation
- See [DEVELOPMENT.md](DEVELOPMENT.md) for API development
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common API issues
