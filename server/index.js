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
// Bus Time SIRI key — same registration as GTFS-RT (register.developer.obanyc.com)
// Falls back to MTA_API_KEY; override with BUSTIME_API_KEY in .env if needed
const BUSTIME_KEY = process.env.BUSTIME_API_KEY ?? process.env.MTA_API_KEY ?? ''
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

app.get('/api/gtfs/alerts', async (req, res) => {
  try {
    const data = await fetchGtfsRt('/alerts')
    res.json(data)
  } catch (err) {
    console.error('[alerts]', err.message)
    res.status(502).json({ error: err.message })
  }
})

// ────────────────────────────────────────────────────────────────
// MTA Bus Time SIRI API — per-stop arrivals (real-time + scheduled)
// ────────────────────────────────────────────────────────────────
const SIRI_BASE = 'https://bustime.mta.info/api/siri'
const SIRI_CACHE_TTL = 30_000 // 30s

async function fetchSiriStop(stopId) {
  const cacheKey = `siri_${stopId}`
  const now = Date.now()
  if (cache[cacheKey] && now - cache[cacheKey].fetchedAt < SIRI_CACHE_TTL) {
    return cache[cacheKey].data
  }
  const url = `${SIRI_BASE}/stop-monitoring.json?key=${BUSTIME_KEY}&version=2&OperatorRef=MTA&MonitoringRef=${stopId}&MinimumStopVisitsPerLine=2`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`SIRI ${resp.status} for stop ${stopId}`)
  const data = await resp.json()
  cache[cacheKey] = { data, fetchedAt: now }
  return data
}

function parseSiriStop(raw) {
  const deliveries = raw?.Siri?.ServiceDelivery?.StopMonitoringDelivery ?? []
  const visits = deliveries.flatMap((d) => d.MonitoredStopVisit ?? [])
  const arrivals = []

  for (const visit of visits) {
    const mvj = visit.MonitoredVehicleJourney
    const mc = mvj?.MonitoredCall
    if (!mvj || !mc) continue

    // Strip agency prefix: "MTA NYCT_Q17" → "Q17"
    const lineRef = mvj.LineRef ?? ''
    const routeId = lineRef.includes('_') ? lineRef.split('_').slice(1).join('_') : lineRef

    const expectedTime = mc.ExpectedArrivalTime ?? mc.ExpectedDepartureTime
    const aimedTime = mc.AimedArrivalTime ?? mc.AimedDepartureTime
    const timeStr = expectedTime ?? aimedTime
    if (!timeStr) continue

    const timeSec = Math.floor(new Date(timeStr).getTime() / 1000)
    const vehicleRef = mvj.VehicleRef ?? ''
    const vehicleId = vehicleRef.includes('_') ? vehicleRef.split('_').pop() : vehicleRef || null

    // DestinationName can be a string or a single-element array
    const rawDest = mvj.DestinationName
    const headsign = Array.isArray(rawDest) ? (rawDest[0] ?? null) : (rawDest ?? null)

    arrivals.push({
      tripId: mvj.FramedVehicleJourneyRef?.DatedVehicleJourneyRef ?? null,
      routeId,
      headsign,
      directionId: mvj.DirectionRef != null ? parseInt(String(mvj.DirectionRef), 10) : null,
      vehicleId,
      arrival: { time: timeSec },
      scheduleRelationship: expectedTime ? 'REALTIME' : 'SCHEDULED',
      // NumberOfStopsAway is directly on MonitoredCall; fall back to Extensions path just in case
      stopsAway: mc.NumberOfStopsAway ?? mc.Extensions?.Distances?.StopsFromCall ?? null,
      isScheduled: !expectedTime,
    })
  }

  arrivals.sort((a, b) => a.arrival.time - b.arrival.time)
  return arrivals
}

// Batch endpoint: fetches SIRI for multiple stops in parallel
app.get('/api/siri/stops', async (req, res) => {
  const stopIds = String(req.query.stops ?? '').split(',').filter(Boolean).slice(0, 20)
  if (!stopIds.length) return res.json({})

  const results = await Promise.allSettled(stopIds.map((id) => fetchSiriStop(id)))
  const out = {}
  let firstError = null
  for (let i = 0; i < stopIds.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled') {
      out[stopIds[i]] = parseSiriStop(r.value)
    } else {
      firstError = firstError ?? r.reason?.message
      out[stopIds[i]] = []
    }
  }
  if (firstError && Object.values(out).every((arr) => arr.length === 0)) {
    return res.status(502).json({ error: firstError })
  }
  res.json(out)
})

// Debug: raw SIRI response for a single stop (no cache bypass, check live data)
app.get('/api/siri/debug/:stopId', async (req, res) => {
  try {
    const { stopId } = req.params
    const url = `${SIRI_BASE}/stop-monitoring.json?key=${BUSTIME_KEY}&version=2&OperatorRef=MTA&MonitoringRef=${stopId}&MinimumStopVisitsPerLine=2`
    const resp = await fetch(url)
    const text = await resp.text()
    res.setHeader('Content-Type', 'application/json')
    // Return status, key hint, and raw body so we can see exactly what MTA returns
    res.json({
      httpStatus: resp.status,
      keySet: !!BUSTIME_KEY,
      keyPrefix: BUSTIME_KEY ? BUSTIME_KEY.slice(0, 8) + '…' : '(none)',
      url: url.replace(BUSTIME_KEY, '***'),
      rawBody: (() => { try { return JSON.parse(text) } catch { return text } })(),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
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
let routeHeadsignsCache = null

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

app.get('/api/route-headsigns', async (req, res) => {
  try {
    if (!routeHeadsignsCache) routeHeadsignsCache = await loadJson('route-headsigns.json')
    if (!routeHeadsignsCache) return res.status(503).json({ error: 'route-headsigns.json not found — run: npm run process-gtfs' })
    res.json(routeHeadsignsCache)
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
