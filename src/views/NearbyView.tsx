import React, { useMemo, useState, useEffect } from 'react'
import { useLocation } from '../hooks/useLocation'
import { useTripUpdates, useStops, useRoutes } from '../hooks/useGtfs'
import { stopsNearby } from '../utils/geo'
import { buildArrivalsByStop } from '../utils/gtfs'
import StopCard from '../components/StopCard'
import type { SelectedTrip } from '../types'

interface NearbyViewProps {
  onSelectTrip: (trip: SelectedTrip) => void
}

export default function NearbyView({ onSelectTrip }: NearbyViewProps) {
  const { coords, error: geoError, loading: geoLoading } = useLocation()
  const { stops, isLoading: stopsLoading } = useStops()
  const { routeMap } = useRoutes()
  const { tripUpdates, isLoading: tripsLoading, isValidating, lastUpdated } = useTripUpdates()

  // Nearby stops (within 320m)
  const nearbyStops = useMemo(() => {
    if (!coords || !stops.length) return []
    return stopsNearby(stops, coords.lat, coords.lon, 320)
  }, [coords, stops])

  // Build arrivals map keyed by stopId
  const arrivalsByStop = useMemo(() => {
    if (!nearbyStops.length || !tripUpdates.length) return new Map<string, never[]>()
    const ids = new Set(nearbyStops.map((s) => s.stopId))
    return buildArrivalsByStop(tripUpdates, ids)
  }, [nearbyStops, tripUpdates])

  // Ticking "X sec ago" indicator
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const secsSince = lastUpdated ? Math.round((now - lastUpdated) / 1000) : null

  const loading = geoLoading || stopsLoading || tripsLoading

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'lightseagreen' }}>
      {/* Header */}
      <header className="sticky top-0 z-20 px-4 pb-3 pt-10" style={{ backgroundColor: 'lightseagreen' }}>
        <div className="flex items-end justify-between max-w-lg mx-auto">
          <div>
            <h1 className="text-white font-bold text-2xl tracking-tight leading-none">
              realtimebus.nyc
            </h1>
            <p className="text-white/70 text-xs mt-1">
              {geoLoading
                ? 'Finding your location…'
                : coords
                  ? 'Nearby stops'
                  : geoError
                    ? `Location error: ${geoError}`
                    : 'No location'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {isValidating && (
              <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
            )}
            {secsSince !== null && (
              <span className="text-white/60 text-xs">{secsSince}s ago</span>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 pb-8 max-w-lg mx-auto space-y-3">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/30 rounded-2xl h-32 animate-pulse" />
            ))}
          </div>
        )}

        {/* GPS error */}
        {!geoLoading && geoError && !coords && (
          <div className="bg-white rounded-2xl shadow p-5 text-center">
            <p className="text-gray-500 text-sm">
              Allow location access to see nearby buses.
            </p>
          </div>
        )}

        {/* No stops nearby */}
        {!loading && coords && nearbyStops.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-5 text-center">
            <p className="text-gray-500 text-sm">No bus stops within 320m.</p>
            <p className="text-gray-400 text-xs mt-1">Try moving closer to a bus stop.</p>
          </div>
        )}

        {/* Stop cards */}
        {nearbyStops.map((stop) => {
          const arrivals = arrivalsByStop.get(stop.stopId) ?? []
          return (
            <StopCard
              key={stop.stopId}
              stop={stop}
              arrivals={arrivals}
              routeMap={routeMap}
              allStops={stops}
              onSelectTrip={onSelectTrip}
            />
          )
        })}
      </main>
    </div>
  )
}
