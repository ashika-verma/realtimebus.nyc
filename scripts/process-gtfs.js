/**
 * process-gtfs.js
 *
 * Reads a GTFS static zip (or extracted folder) and produces:
 *   server/gtfs/stops.json    — all stops with lat/lon
 *   server/gtfs/routes.json   — all routes with color info
 *
 * Stops also get a `routes` array of route IDs that serve them.
 *
 * Usage:
 *   node scripts/process-gtfs.js [path-to-gtfs-zip-or-folder]
 *
 * If no argument is given, downloads MTA Bus GTFS from the official URL.
 */

import { createReadStream, createWriteStream, mkdirSync, existsSync } from 'fs'
import { writeFile, readFile } from 'fs/promises'
import { createInterface } from 'readline'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pipeline } from 'stream/promises'
import fetch from 'node-fetch'
import { parse } from 'csv-parse'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const GTFS_OUT = join(ROOT, 'server', 'gtfs')
const GTFS_DATA = join(ROOT, 'gtfs-data')

// MTA Bus GTFS static feeds — one zip per borough (redirect to S3)
const MTA_GTFS_FEEDS = [
  { name: 'manhattan', url: 'http://web.mta.info/developers/data/nyct/bus/google_transit_manhattan.zip' },
  { name: 'brooklyn',  url: 'http://web.mta.info/developers/data/nyct/bus/google_transit_brooklyn.zip' },
  { name: 'queens',    url: 'http://web.mta.info/developers/data/nyct/bus/google_transit_queens.zip' },
  { name: 'bronx',     url: 'http://web.mta.info/developers/data/nyct/bus/google_transit_bronx.zip' },
  { name: 'staten_island', url: 'http://web.mta.info/developers/data/nyct/bus/google_transit_staten_island.zip' },
  { name: 'busco',     url: 'http://web.mta.info/developers/data/busco/google_transit.zip' },
]

// ─── helpers ────────────────────────────────────────────────────────────────

async function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const records = []
    createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
      .on('data', (row) => records.push(row))
      .on('error', reject)
      .on('end', () => resolve(records))
  })
}

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true })
}

// ─── download + extract ──────────────────────────────────────────────────────

async function extractZip(zipPath, outDir) {
  // Use unzip command since Node doesn't have a native zip reader
  // Fall back to manual extraction
  const { execSync } = await import('child_process')
  ensureDir(outDir)
  try {
    execSync(`unzip -o "${zipPath}" -d "${outDir}"`, { stdio: 'pipe' })
    console.log(`Extracted to ${outDir}`)
  } catch (e) {
    throw new Error(`Failed to extract zip: ${e.message}`)
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const arg = process.argv[2]

  if (arg) {
    // Single directory or zip
    let gtfsDir = arg
    if (arg.endsWith('.zip')) {
      const extractDir = join(GTFS_DATA, 'extracted', 'custom')
      await extractZip(arg, extractDir)
      gtfsDir = extractDir
    }
    ensureDir(GTFS_OUT)
    const { stops, routes } = await processOneGtfsDir(gtfsDir)
    const stopsArr = Object.values(stops)
    const routesArr = Object.values(routes)
    await writeFile(join(GTFS_OUT, 'stops.json'), JSON.stringify(stopsArr))
    await writeFile(join(GTFS_OUT, 'routes.json'), JSON.stringify(routesArr))
    console.log(`Wrote ${stopsArr.length} stops, ${routesArr.length} routes`)
    console.log('Done! Run: npm run dev')
  } else {
    // Download all borough feeds, process each, merge JSON outputs
    await downloadAllAndMergeJson()
  }
}

async function downloadAllAndMergeJson() {
  ensureDir(GTFS_OUT)

  const allStops = {}   // stopId → stop object
  const allRoutes = {}  // routeId → route object

  for (const feed of MTA_GTFS_FEEDS) {
    const extractDir = join(GTFS_DATA, 'extracted', feed.name)
    const zipPath = join(GTFS_DATA, `${feed.name}.zip`)

    // Download if not cached
    if (!existsSync(zipPath)) {
      console.log(`\nDownloading ${feed.name} …`)
      const resp = await fetch(feed.url)
      if (!resp.ok) {
        console.warn(`  Skipping ${feed.name}: HTTP ${resp.status}`)
        continue
      }
      const out = createWriteStream(zipPath)
      await pipeline(resp.body, out)
    } else {
      console.log(`\nUsing cached ${feed.name}.zip`)
    }

    // Extract if not done
    if (!existsSync(join(extractDir, 'stops.txt'))) {
      await extractZip(zipPath, extractDir)
    }

    console.log(`Processing ${feed.name} …`)
    const { stops, routes } = await processOneGtfsDir(extractDir)
    for (const [id, s] of Object.entries(stops)) {
      if (!allStops[id]) {
        allStops[id] = s
      } else {
        // Merge routes
        const merged = new Set([...allStops[id].routes, ...s.routes])
        allStops[id].routes = [...merged].sort()
      }
    }
    for (const [id, r] of Object.entries(routes)) {
      allRoutes[id] = r
    }
  }

  const stopsArr = Object.values(allStops)
  const routesArr = Object.values(allRoutes)

  await writeFile(join(GTFS_OUT, 'stops.json'), JSON.stringify(stopsArr))
  console.log(`\nWrote server/gtfs/stops.json (${stopsArr.length} stops)`)

  await writeFile(join(GTFS_OUT, 'routes.json'), JSON.stringify(routesArr))
  console.log(`Wrote server/gtfs/routes.json (${routesArr.length} routes)`)
  console.log('\nDone! Run: npm run dev')
}

/**
 * Process a single extracted GTFS directory; return { stops, routes } maps.
 */
async function processOneGtfsDir(gtfsDir) {
  // stops
  const stopsRaw = await parseCsv(join(gtfsDir, 'stops.txt'))
  const stopsMap = {}
  for (const row of stopsRaw) {
    const lat = parseFloat(row.stop_lat)
    const lon = parseFloat(row.stop_lon)
    if (isNaN(lat) || isNaN(lon)) continue
    stopsMap[row.stop_id] = {
      stopId: row.stop_id,
      name: row.stop_name,
      lat, lon,
      routes: [],
    }
  }

  // routes
  const routesRaw = await parseCsv(join(gtfsDir, 'routes.txt'))
  const routesMap = {}
  for (const row of routesRaw) {
    routesMap[row.route_id] = {
      routeId: row.route_id,
      routeShortName: row.route_short_name,
      routeLongName: row.route_long_name,
      routeColor: row.route_color || null,
      routeTextColor: row.route_text_color || null,
    }
  }

  // trips → route mapping
  const tripsRaw = await parseCsv(join(gtfsDir, 'trips.txt'))
  const tripToRoute = {}
  for (const row of tripsRaw) {
    tripToRoute[row.trip_id] = row.route_id
  }

  // stop_times → attach routes to stops (streaming)
  const stopTimesPath = join(gtfsDir, 'stop_times.txt')
  const stopRouteSet = {}
  await new Promise((resolve, reject) => {
    let headerParsed = false, tripIdIdx = -1, stopIdIdx = -1
    const rl = createInterface({ input: createReadStream(stopTimesPath), crlfDelay: Infinity })
    rl.on('line', (line) => {
      if (!headerParsed) {
        const cols = line.split(',')
        tripIdIdx = cols.indexOf('trip_id')
        stopIdIdx = cols.indexOf('stop_id')
        headerParsed = true
        return
      }
      const cols = line.split(',')
      const tripId = cols[tripIdIdx]?.trim()
      const stopId = cols[stopIdIdx]?.trim()
      const routeId = tripToRoute[tripId]
      if (!routeId || !stopId) return
      if (!stopRouteSet[stopId]) stopRouteSet[stopId] = new Set()
      stopRouteSet[stopId].add(routeId)
    })
    rl.on('close', resolve)
    rl.on('error', reject)
  })

  for (const [stopId, routeSet] of Object.entries(stopRouteSet)) {
    if (stopsMap[stopId]) stopsMap[stopId].routes = [...routeSet].sort()
  }

  return { stops: stopsMap, routes: routesMap }
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
