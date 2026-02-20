import React, { useState } from 'react'
import ArrivalRow from './ArrivalRow'
import TransfersList from './TransfersList'
import { groupByDirection } from '../utils/gtfs'
import { walkTimeSec as calcWalkTime } from '../utils/geo'
import type { Stop, ArrivalInfo, RouteMap, RouteHeadsigns, SelectedTrip, GtfsAlert } from '../types'

interface StopCardProps {
  stop: Stop & { distanceMeters: number }
  arrivals: ArrivalInfo[]
  routeMap: RouteMap
  routeHeadsigns: RouteHeadsigns
  allStops: Stop[]
  alerts?: GtfsAlert[]
  onSelectTrip?: (trip: SelectedTrip) => void
  onSelectStop?: (stopId: string, name: string) => void
  showTransfers?: boolean
}

/** Resolve best headsign: from RT data first, then static lookup, then null */
function resolveHeadsign(
  arrival: ArrivalInfo,
  routeHeadsigns: RouteHeadsigns,
): string | null {
  if (arrival.headsign) return arrival.headsign
  if (arrival.routeId && arrival.directionId != null) {
    return routeHeadsigns[arrival.routeId]?.[String(arrival.directionId)] ?? null
  }
  return null
}

export default function StopCard({
  stop,
  arrivals,
  routeMap,
  routeHeadsigns,
  allStops,
  alerts = [],
  onSelectTrip,
  onSelectStop,
  showTransfers = true,
}: StopCardProps) {
  const [expandedDirections, setExpandedDirections] = useState<Set<string>>(new Set())
  const wt = calcWalkTime(stop.distanceMeters)

  // Enrich arrivals with resolved headsigns before grouping
  const enriched = arrivals.map((a) => ({
    ...a,
    headsign: resolveHeadsign(a, routeHeadsigns),
  }))
  const byDirection = groupByDirection(enriched)

  // Filter out fully-departed directions
  const directions = [...byDirection.entries()].filter(([, rows]) =>
    rows.some((r) => {
      const t = Number(r.arrival?.time ?? r.departure?.time ?? 0)
      return t > 0 && t - Date.now() / 1000 > -120
    })
  ) as [string | null, ArrivalInfo[]][]

  // Inline alerts: filter to those affecting any of this stop's routes
  const stopRouteSet = new Set(stop.routes)
  const relevantAlerts = alerts.filter((a) =>
    a.informedEntity?.some((e) => e.routeId && stopRouteSet.has(e.routeId))
  )

  const walkMins = Math.ceil(wt / 60)

  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden card-enter">
      {/* Header — non-interactive, just info */}
      <div className="flex items-start justify-between px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900 text-base leading-tight truncate">
            {stop.name}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {Math.round(stop.distanceMeters)}m ·{' '}
            <span className="font-semibold text-gray-500">{walkMins} min walk</span>
            {' '}· #{stop.stopId}
          </p>
        </div>

        {/* Alert indicator */}
        {relevantAlerts.length > 0 && (
          <span
            className="ml-2 mt-0.5 shrink-0 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5"
            title={relevantAlerts.map((a) => a.effect?.replace(/_/g, ' ')).join(', ')}
          >
            ⚠ {relevantAlerts.length}
          </span>
        )}
      </div>

      {/* Arrivals */}
      {directions.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-gray-400 italic border-t border-gray-100 pt-3">
          No upcoming arrivals
        </p>
      ) : (
        directions.map(([headsign, rows]) => {
          const key = headsign ?? '_unknown'
          const isExpanded = expandedDirections.has(key)
          const shown = rows.slice(0, isExpanded ? rows.length : 3)
          const hidden = rows.length - 3
          return (
            <div key={key} className="border-t border-gray-100">
              {headsign && (
                <p className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  To {headsign}
                </p>
              )}
              {shown.map((arrival, i) => (
                <ArrivalRow
                  key={`${arrival.tripId ?? ''}-${i}`}
                  arrival={arrival}
                  walkTimeSec={wt}
                  routeMap={routeMap}
                  onClick={() =>
                    onSelectTrip?.({
                      tripId: arrival.tripId ?? '',
                      vehicleId: arrival.vehicleId,
                      routeId: arrival.routeId ?? '',
                      headsign,
                      stopId: stop.stopId,
                    })
                  }
                />
              ))}
              {!isExpanded && hidden > 0 && (
                <button
                  className="px-4 pb-2 text-xs text-gray-400 hover:text-gray-600"
                  onClick={() =>
                    setExpandedDirections((prev) => {
                      const next = new Set(prev)
                      next.add(key)
                      return next
                    })
                  }
                >
                  Show {hidden} more
                </button>
              )}
            </div>
          )
        })
      )}

      {showTransfers && (
        <TransfersList stop={stop} allStops={allStops} routeMap={routeMap} onSelectStop={onSelectStop} />
      )}
    </div>
  )
}
