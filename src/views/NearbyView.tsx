import React, { useMemo, useState, useEffect } from 'react'
import { DEFAULT_SETTINGS } from '../config'
import { useLocation } from '../hooks/useLocation'
import { useTripUpdates, useStops, useRoutes, useRouteHeadsigns, useAlerts } from '../hooks/useGtfs'
import { stopsNearby, haversineMeters } from '../utils/geo'
import { buildArrivalsByStop } from '../utils/gtfs'
import StopCard from '../components/StopCard'
import AlertBanner from '../components/AlertBanner'
import type { Stop, SelectedTrip } from '../types'

interface NearbyViewProps {
  onSelectTrip: (trip: SelectedTrip) => void
  onSelectStop: (stopId: string, name: string) => void
}

function matchesSearch(stop: Stop, query: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return false
  return (
    stop.name.toLowerCase().includes(q) ||
    stop.routes.some((r) => r.toLowerCase().includes(q))
  )
}

export default function NearbyView({ onSelectTrip, onSelectStop }: NearbyViewProps) {
  const { coords, error: geoError, loading: geoLoading } = useLocation()
  const { stops, isLoading: stopsLoading } = useStops()
  const { routeMap } = useRoutes()
  const { routeHeadsigns } = useRouteHeadsigns()
  const { tripUpdates, isLoading: tripsLoading, isValidating, lastUpdated, error: tripsError, mutate } = useTripUpdates()
  const { alerts } = useAlerts()

  const [searchQuery, setSearchQuery] = useState('')
  const [slowLoad, setSlowLoad] = useState(false)

  // After 8s of initial loading show a "server waking up" hint
  useEffect(() => {
    if (!tripsLoading) { setSlowLoad(false); return }
    const id = setTimeout(() => setSlowLoad(true), 8000)
    return () => clearInterval(id)
  }, [tripsLoading])

  // Nearby stops (within 400m)
  const nearbyStops = useMemo(() => {
    if (!coords || !stops.length) return []
    return stopsNearby(stops, coords.lat, coords.lon, DEFAULT_SETTINGS.nearbyRadiusMeters)
  }, [coords, stops])

  // Build arrivals map for nearby stops
  const arrivalsByStop = useMemo(() => {
    if (!nearbyStops.length || !tripUpdates.length) return new Map<string, never[]>()
    const ids = new Set(nearbyStops.map((s) => s.stopId))
    return buildArrivalsByStop(tripUpdates, ids)
  }, [nearbyStops, tripUpdates])

  // Sort: stops with upcoming arrivals first, empty stops at the bottom
  const sortedNearbyStops = useMemo(() => {
    const hasArrivals = (stopId: string) => {
      const rows = arrivalsByStop.get(stopId) ?? []
      const now = Date.now() / 1000
      return rows.some((r) => {
        const t = Number(r.arrival?.time ?? r.departure?.time ?? 0)
        return t > 0 && t - now > -120
      })
    }
    return [...nearbyStops].sort((a, b) => {
      const aHas = hasArrivals(a.stopId) ? 0 : 1
      const bHas = hasArrivals(b.stopId) ? 0 : 1
      if (aHas !== bHas) return aHas - bHas
      return a.distanceMeters - b.distanceMeters // distance as tiebreaker
    })
  }, [nearbyStops, arrivalsByStop])

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return []
    return stops
      .filter((s) => matchesSearch(s, searchQuery))
      .slice(0, 15)
      .map((s) => ({
        ...s,
        distanceMeters: coords
          ? haversineMeters(coords.lat, coords.lon, s.lat, s.lon)
          : 0,
      }))
  }, [stops, searchQuery, coords])

  // Build arrivals map for search results
  const searchArrivalsByStop = useMemo(() => {
    if (!searchResults.length || !tripUpdates.length) return new Map<string, never[]>()
    const ids = new Set(searchResults.map((s) => s.stopId))
    return buildArrivalsByStop(tripUpdates, ids)
  }, [searchResults, tripUpdates])

  // Route IDs for nearby stops (for alert filtering)
  const nearbyRouteIds = useMemo(
    () => new Set(nearbyStops.flatMap((s) => s.routes)),
    [nearbyStops]
  )

  // Ticking "X sec ago" indicator
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const secsSince = lastUpdated ? Math.round((now - lastUpdated) / 1000) : null

  const loading = geoLoading || stopsLoading || tripsLoading
  const isSearching = searchQuery.trim().length > 0

  return (
    <div className="flex flex-col h-dvh" style={{ backgroundColor: 'lightseagreen' }}>
      {/* Header — pinned, never scrolls */}
      <header className="shrink-0 px-4 pb-3 pt-10 z-20" style={{ backgroundColor: 'lightseagreen' }}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-end justify-between">
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
              <AlertBanner alerts={alerts} nearbyRouteIds={nearbyRouteIds} />
            </div>
          </div>

          {/* Search input */}
          <div className="mt-3 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stops or routes…"
              className="w-full bg-white/20 text-white placeholder-white/50 rounded-full py-2 pl-8 pr-9 text-sm outline-none focus:bg-white/30 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 pb-8 max-w-lg mx-auto space-y-3">
        {/* Loading skeleton */}
        {loading && !isSearching && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/30 rounded-2xl h-32 animate-pulse" />
            ))}
            {slowLoad && (
              <p className="text-center text-white/60 text-sm pt-1">
                Server is waking up, hang tight…
              </p>
            )}
          </div>
        )}

        {/* Trip data error */}
        {!isSearching && tripsError && !tripsLoading && (
          <div className="bg-white rounded-2xl shadow p-5 text-center">
            <p className="text-gray-500 text-sm">Couldn't load arrival times.</p>
            <button
              onClick={() => mutate()}
              className="mt-2 text-xs text-teal-600 font-semibold hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* GPS error (only when not searching) */}
        {!isSearching && !geoLoading && geoError && !coords && (
          <div className="bg-white rounded-2xl shadow p-5 text-center">
            <p className="text-gray-500 text-sm">
              Allow location access to see nearby buses.
            </p>
          </div>
        )}

        {/* Search results */}
        {isSearching && (
          <>
            {searchResults.length === 0 && !stopsLoading ? (
              <div className="bg-white rounded-2xl shadow p-5 text-center">
                <p className="text-gray-500 text-sm">No stops matched "{searchQuery}"</p>
              </div>
            ) : (
              searchResults.map((stop) => {
                const arrivals = searchArrivalsByStop.get(stop.stopId) ?? []
                return (
                  <StopCard
                    key={stop.stopId}
                    stop={stop}
                    arrivals={arrivals}
                    routeMap={routeMap}
                    routeHeadsigns={routeHeadsigns}
                    allStops={stops}
                    alerts={alerts}
                    onSelectTrip={onSelectTrip}
                    onSelectStop={onSelectStop}
                    showTransfers={false}
                  />
                )
              })
            )}
          </>
        )}

        {/* Nearby stop cards */}
        {!isSearching && (
          <>
            {!loading && coords && nearbyStops.length === 0 && (
              <div className="bg-white rounded-2xl shadow p-5 text-center">
                <p className="text-gray-500 text-sm">No bus stops within 320m.</p>
                <p className="text-gray-400 text-xs mt-1">Try moving closer to a bus stop.</p>
              </div>
            )}
            {sortedNearbyStops.map((stop) => {
              const arrivals = arrivalsByStop.get(stop.stopId) ?? []
              return (
                <StopCard
                  key={stop.stopId}
                  stop={stop}
                  arrivals={arrivals}
                  routeMap={routeMap}
                  routeHeadsigns={routeHeadsigns}
                  allStops={stops}
                  alerts={alerts}
                  onSelectTrip={onSelectTrip}
                  onSelectStop={onSelectStop}
                  showTransfers={false}
                />
              )
            })}
          </>
        )}
        </div>
      </main>
    </div>
  )
}
