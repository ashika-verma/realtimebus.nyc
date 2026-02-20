import type { Stop } from '../types'

/**
 * Haversine distance between two lat/lon points, in meters.
 */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Walking time in seconds at 1.33 m/s (about 80 m/min, comfortable walk).
 */
export function walkTimeSec(meters: number): number {
  return meters / 1.33
}

/**
 * Whether an arrival is "catchable":
 *   arrivalSec > walkTimeSec + 30s buffer
 */
export function isCatchable(arrivalUnixSec: number | string, walkTimeSeconds: number): boolean {
  const nowSec = Date.now() / 1000
  const secsUntilArrival = Number(arrivalUnixSec) - nowSec
  return secsUntilArrival > walkTimeSeconds + 30
}

/**
 * Format seconds-until as a human-readable label: "2 min", "arriving", "departed"
 */
export function formatArrival(arrivalUnixSec: number | string): string {
  const nowSec = Date.now() / 1000
  const diff = Number(arrivalUnixSec) - nowSec
  if (diff < -60) return 'departed'
  if (diff < 30) return 'arriving'
  const mins = Math.round(diff / 60)
  return `${mins} min`
}

/**
 * "Leave in X min" / "leave now" / "arriving" / "departed" — answers the
 * question "when do I need to leave?" instead of "when does the bus arrive?"
 */
export function formatLeaveIn(arrivalUnixSec: number | string, walkTimeSec: number): string {
  const nowSec = Date.now() / 1000
  const diff = Number(arrivalUnixSec) - nowSec
  if (diff < -60) return 'departed'
  if (diff < 30) return 'arriving'
  const leaveInSecs = diff - walkTimeSec
  if (leaveInSecs < 60) return 'leave now'
  const mins = Math.floor(leaveInSecs / 60)
  return `leave in ${mins} min`
}

/**
 * Find stops within radiusMeters of (lat, lon) from a stops array.
 * Returns stops sorted by distance, each annotated with .distanceMeters.
 */
export function stopsNearby(
  stops: Stop[],
  lat: number,
  lon: number,
  radiusMeters = 320,
): (Stop & { distanceMeters: number })[] {
  return stops
    .map((s) => ({
      ...s,
      distanceMeters: haversineMeters(lat, lon, s.lat, s.lon),
    }))
    .filter((s) => s.distanceMeters <= radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
}
