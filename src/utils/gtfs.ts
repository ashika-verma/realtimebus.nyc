import type { ArrivalInfo, FeedEntity, VehiclePosition } from '../types'

/**
 * Group trip-update StopTimeUpdates by stop_id for a given set of nearby stop IDs.
 */
export function buildArrivalsByStop(
  tripUpdates: FeedEntity[],
  nearbyStopIds: Set<string>,
): Map<string, ArrivalInfo[]> {
  const byStop = new Map<string, ArrivalInfo[]>()
  for (const id of nearbyStopIds) byStop.set(id, [])

  for (const entity of tripUpdates) {
    const tu = entity.tripUpdate
    if (!tu) continue
    const tripId = tu.trip?.tripId
    const routeId = tu.trip?.routeId
    const vehicleId = tu.vehicle?.id ?? tu.vehicle?.label ?? null

    for (const stu of tu.stopTimeUpdate ?? []) {
      const stopId = stu.stopId
      if (!stopId || !byStop.has(stopId)) continue

      byStop.get(stopId)!.push({
        tripId,
        routeId,
        headsign: tu.trip?.tripHeadsign ?? null,
        vehicleId,
        stopSequence: stu.stopSequence,
        arrival: stu.arrival ?? null,
        departure: stu.departure ?? null,
        scheduleRelationship: stu.scheduleRelationship,
      })
    }
  }

  // Sort each stop's arrivals by soonest
  for (const arrivals of byStop.values()) {
    arrivals.sort((a, b) => {
      const aT = Number(a.arrival?.time ?? a.departure?.time ?? Infinity)
      const bT = Number(b.arrival?.time ?? b.departure?.time ?? Infinity)
      return aT - bT
    })
  }

  return byStop
}

/**
 * Group arrivals by headsign direction within a stop.
 */
export function groupByDirection(arrivals: ArrivalInfo[]): Map<string, ArrivalInfo[]> {
  const groups = new Map<string, ArrivalInfo[]>()
  for (const a of arrivals) {
    const key = a.headsign ?? 'Unknown'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(a)
  }
  return groups
}

/**
 * Find the vehicle position for a given tripId from a vehicles feed.
 */
export function vehicleForTrip(vehicleEntities: FeedEntity[], tripId: string): VehiclePosition | null {
  return vehicleEntities.find(
    (e) => e.vehicle?.trip?.tripId === tripId
  )?.vehicle ?? null
}

/**
 * Hex color → { r, g, b }
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return { r, g, b }
}

/**
 * Pick a legible text color (black or white) for a given background hex.
 */
export function contrastColor(bgHex: string): string {
  const rgb = hexToRgb(bgHex)
  if (!rgb) return '#ffffff'
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}
