import React, { useState } from 'react'
import ArrivalRow from './ArrivalRow'
import TransfersList from './TransfersList'
import { groupByDirection } from '../utils/gtfs'
import { walkTimeSec as calcWalkTime } from '../utils/geo'
import type { Stop, ArrivalInfo, RouteMap, SelectedTrip } from '../types'

interface StopCardProps {
  stop: Stop & { distanceMeters: number }
  arrivals: ArrivalInfo[]
  routeMap: RouteMap
  allStops: Stop[]
  onSelectTrip?: (trip: SelectedTrip) => void
}

export default function StopCard({
  stop,
  arrivals,
  routeMap,
  allStops,
  onSelectTrip,
}: StopCardProps) {
  const [expanded, setExpanded] = useState(true)
  const wt = calcWalkTime(stop.distanceMeters)
  const byDirection = groupByDirection(arrivals)

  // Filter out fully-departed directions
  const directions = [...byDirection.entries()].filter(([, rows]) =>
    rows.some((r) => {
      const t = Number(r.arrival?.time ?? r.departure?.time ?? 0)
      return t > 0 && t - Date.now() / 1000 > -120
    })
  )

  if (directions.length === 0 && arrivals.length > 0) return null

  return (
    <div className="bg-white rounded-2xl shadow overflow-hidden card-enter">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div>
          <h2 className="font-semibold text-gray-900 text-base leading-tight">
            {stop.name}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {Math.round(stop.distanceMeters)}m away ·{' '}
            {Math.ceil(wt / 60)} min walk · Stop #{stop.stopId}
          </p>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <>
          {directions.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-gray-400 italic">No upcoming arrivals</p>
          ) : (
            directions.map(([headsign, rows]) => (
              <div key={headsign} className="border-t border-gray-100">
                <p className="px-4 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  To {headsign}
                </p>
                {rows.slice(0, 4).map((arrival, i) => (
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
              </div>
            ))
          )}

          <TransfersList stop={stop} allStops={allStops} routeMap={routeMap} />
        </>
      )}
    </div>
  )
}
