import express from 'express'
import fetch from 'node-fetch'
import { createRequire } from 'module'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFile } from 'fs/promises'

const require = createRequire(import.meta.url)
const GtfsRealtimeBindings = require('gtfs-realtime-bindings')

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load env (simple key=value parsing — no dotenv dep needed)
function loadEnv() {
  const envPath = join(__dirname, '..', '.env')
  if (!existsSync(envPath)) return
  const lines = readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnv()

const API_KEY = process.env.MTA_API_KEY ?? ''
const BASE_URL = process.env.MTA_GTFS_RT_BASE_URL ?? 'https://gtfsrt.prod.obanyc.com'
const PORT = parseInt(process.env.PORT ?? '3001', 10)

const app = express()
app.use(express.json())

// CORS for dev
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  next()
})

// ────────────────────────────────────────────────────────────────
// Simple in-memory cache: { [cacheKey]: { data, fetchedAt } }
// ────────────────────────────────────────────────────────────────
const cache = {}
const CACHE_TTL_MS = 15_000

async function fetchGtfsRt(path) {
  const cacheKey = path
  const now = Date.now()
  if (cache[cacheKey] && now - cache[cacheKey].fetchedAt < CACHE_TTL_MS) {
    return cache[cacheKey].data
  }

  const url = `${BASE_URL}${path}`
  const headers = API_KEY ? { 'x-api-key': API_KEY } : {}
  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new Error(`MTA API returned ${response.status} for ${url}`)
  }

  const buffer = await response.arrayBuffer()
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
    new Uint8Array(buffer)
  )
  const data = { ...feed.toJSON(), _fetchedAt: now }

  cache[cacheKey] = { data, fetchedAt: now }
  return data
}

// ────────────────────────────────────────────────────────────────
// GTFS-RT routes
// ────────────────────────────────────────────────────────────────
app.get('/api/gtfs/vehicles', async (req, res) => {
  try {
    const data = await fetchGtfsRt('/vehiclePositions')
    res.json(data)
  } catch (err) {
    console.error('[vehicles]', err.message)
    res.status(502).json({ error: err.message })
  }
})

app.get('/api/gtfs/trips', async (req, res) => {
  try {
    const data = await fetchGtfsRt('/tripUpdates')
    res.json(data)
  } catch (err) {
    console.error('[trips]', err.message)
    res.status(502).json({ error: err.message })
  }
})

// ────────────────────────────────────────────────────────────────
// Static GTFS data
// ────────────────────────────────────────────────────────────────
const GTFS_DIR = join(__dirname, 'gtfs')

async function loadJson(filename) {
  const filePath = join(GTFS_DIR, filename)
  if (!existsSync(filePath)) return null
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

// Simple in-memory static cache (these rarely change)
let stopsCache = null
let routesCache = null

app.get('/api/stops', async (req, res) => {
  try {
    if (!stopsCache) stopsCache = await loadJson('stops.json')
    if (!stopsCache) return res.status(503).json({ error: 'stops.json not found — run: npm run process-gtfs' })
    res.json(stopsCache)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.get('/api/routes', async (req, res) => {
  try {
    if (!routesCache) routesCache = await loadJson('routes.json')
    if (!routesCache) return res.status(503).json({ error: 'routes.json not found — run: npm run process-gtfs' })
    res.json(routesCache)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    stopsLoaded: !!stopsCache,
    routesLoaded: !!routesCache,
    apiKeySet: !!API_KEY,
    baseUrl: BASE_URL,
  })
})

// ────────────────────────────────────────────────────────────────
// Serve built frontend in production
// ────────────────────────────────────────────────────────────────
const DIST_DIR = join(__dirname, '..', 'dist')
if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
  // SPA fallback — let React handle unknown paths (Express v5 uses regex)
  app.get(/.*/, (_req, res) => {
    res.sendFile(join(DIST_DIR, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`[server] Listening on http://localhost:${PORT}`)
  console.log(`[server] MTA base URL: ${BASE_URL}`)
  console.log(`[server] API key: ${API_KEY ? '✓ set' : '✗ missing'}`)
  console.log(`[server] Frontend: ${existsSync(DIST_DIR) ? 'serving dist/' : 'dev mode (no dist/)'}`)
})
