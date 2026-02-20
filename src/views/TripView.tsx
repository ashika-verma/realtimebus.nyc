import React, { useMemo } from 'react'
import { useTripUpdates, useVehiclePositions, useStops, useRoutes } from '../hooks/useGtfs'
import { vehicleForTrip } from '../utils/gtfs'
import TripTimeline from '../components/TripTimeline'
import RouteBadge from '../components/RouteBadge'
import type { SelectedTrip, Stop, TimelineStop } from '../types'

interface TripViewProps {
  trip: SelectedTrip
  onBack: () => void
}

export default function TripView({ trip, onBack }: TripViewProps) {
  const { tripId, vehicleId, routeId, headsign } = trip
  const { tripUpdates } = useTripUpdates()
  const { vehicles } = useVehiclePositions()
  const { stops: allStops } = useStops()
  const { routeMap } = useRoutes()

  const route = routeId ? routeMap[routeId] : undefined
  const routeColor = route?.routeColor ? `#${route.routeColor}` : '#20B2AA'

  // Find this trip's stop time updates
  const stopTimeUpdates = useMemo(() => {
    const entity = tripUpdates.find((e) => e.tripUpdate?.trip?.tripId === tripId)
    return entity?.tripUpdate?.stopTimeUpdate ?? []
  }, [tripUpdates, tripId])

  // Live vehicle position
  const vehicle = useMemo(() => vehicleForTrip(vehicles, tripId), [vehicles, tripId])
  const vehicleStopId = vehicle?.stopId ?? null

  // Build stop name lookup
  const stopMap = useMemo(() => {
    const m: Record<string, Stop> = {}
    for (const s of allStops) m[s.stopId] = s
    return m
  }, [allStops])

  const timelineStops: TimelineStop[] = stopTimeUpdates.map((stu) => ({
    ...stu,
    name: stu.stopId ? stopMap[stu.stopId]?.name : undefined,
  }))

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'lightseagreen' }}>
      {/* Header */}
      <header className="sticky top-0 z-20 px-4 pb-3 pt-10" style={{ backgroundColor: 'lightseagreen' }}>
        <div className="max-w-lg mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/80 text-sm mb-3 -ml-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Nearby stops
          </button>
          <div className="flex items-center gap-3">
            <RouteBadge routeId={routeId} route={route} />
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">
                {headsign ?? 'Trip detail'}
              </h1>
              <p className="text-white/60 text-xs">
                Trip {tripId}
                {vehicleId ? ` · Bus ${vehicleId}` : ''}
                {vehicle ? ' · Live' : ''}
              </p>
            </div>
            {vehicle && (
              <span
                className="ml-auto text-xs px-2 py-1 rounded-full font-medium text-white"
                style={{ backgroundColor: routeColor }}
              >
                Live
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 pb-8 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl shadow p-4">
          {timelineStops.length === 0 ? (
            <p className="text-gray-400 text-sm italic text-center py-6">
              No stop data available for this trip.
            </p>
          ) : (
            <TripTimeline
              stops={timelineStops}
              vehicleStop={vehicleStopId}
              routeColor={routeColor}
            />
          )}
        </div>

        <p className="text-white/40 text-xs text-center mt-4">Updates every 15 seconds</p>
      </main>
    </div>
  )
}
