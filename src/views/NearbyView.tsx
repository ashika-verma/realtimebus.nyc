import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useDebounce } from '../hooks/useDebounce'
import { useOnline } from '../hooks/useOnline'
import { useVersionCheck } from '../hooks/useVersionCheck'
import { DEFAULT_SETTINGS } from '../config'
import { BusPullIndicator, usePullToRefresh } from '../components/PullToRefresh'
import { useLocation } from '../hooks/useLocation'
import { useSiriArrivals, useVehiclePositions, useStops, useRoutes, useRouteHeadsigns, useAlerts } from '../hooks/useGtfs'
import { stopsNearby, haversineMeters } from '../utils/geo'
import StopCard from '../components/StopCard'
import AlertBanner from '../components/AlertBanner'
import NearbyMapView from '../components/NearbyMapView'
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
  const { mutate: mutateVehicles } = useVehiclePositions()
  const { alerts, mutate: mutateAlerts } = useAlerts()

  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebounce(searchQuery, 300)
  const [slowLoad, setSlowLoad] = useState(false)
  const [showMap, setShowMap] = useState(false)

  // ── Nearby stops (within radius) ──────────────────────────────
  const nearbyStops = useMemo(() => {
    if (!coords || !stops.length) return []
    return stopsNearby(stops, coords.lat, coords.lon, DEFAULT_SETTINGS.nearbyRadiusMeters)
  }, [coords, stops])

  const nearbyStopIds = useMemo(() => nearbyStops.map((s) => s.stopId), [nearbyStops])

  // ── SIRI arrivals for all nearby stops (real-time + scheduled) ─
  const { arrivalsByStop, isLoading: sirisLoading, isValidating, lastUpdated, error: sirisError, mutate: mutateSiri } =
    useSiriArrivals(nearbyStopIds)

  const scrollRef = useRef<HTMLDivElement>(null)
  const handleRefresh = useCallback(async () => {
    await Promise.all([mutateSiri(), mutateVehicles(), mutateAlerts()])
  }, [mutateSiri, mutateVehicles, mutateAlerts])
  const { pullDist, refreshing, dragging } = usePullToRefresh(scrollRef, handleRefresh)

  // After 8s of initial loading show a "server waking up" hint
  useEffect(() => {
    if (!sirisLoading) { setSlowLoad(false); return }
    const id = setTimeout(() => setSlowLoad(true), 8000)
    return () => clearTimeout(id)
  }, [sirisLoading])

  // Search results — driven by debounced query so SIRI isn't hit per keystroke
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) return []
    return stops
      .filter((s) => matchesSearch(s, debouncedQuery))
      .slice(0, 15)
      .map((s) => ({
        ...s,
        distanceMeters: coords
          ? haversineMeters(coords.lat, coords.lon, s.lat, s.lon)
          : 0,
      }))
  }, [stops, debouncedQuery, coords])

  // SIRI arrivals for search results (separate hook — null key when not searching)
  const searchStopIds = useMemo(
    () => searchResults.map((s) => s.stopId),
    [searchResults]
  )
  const { arrivalsByStop: searchArrivalsByStop } = useSiriArrivals(searchStopIds)

  // Sort nearby stops: arrivals first, then by distance
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

  const online = useOnline()
  const isStale = !online || (secsSince !== null && secsSince > 60)
  const updateAvailable = useVersionCheck()

  const loading = geoLoading || stopsLoading || sirisLoading
  const isSearching = debouncedQuery.trim().length > 0

  return (
    <div className="flex flex-col h-dvh" style={{ backgroundColor: 'lightseagreen' }}>
      {/* Pull-to-refresh indicator — lives above the header so the whole page shifts down */}
      <BusPullIndicator pullDist={pullDist} refreshing={refreshing} dragging={dragging} />

      {/* Header — pinned below indicator */}
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
            <div className="flex items-center gap-2">
              {isValidating && (
                <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
              )}
              {secsSince !== null && (
                <span className="text-white/60 text-xs">{secsSince}s ago</span>
              )}
              <AlertBanner alerts={alerts} nearbyRouteIds={nearbyRouteIds} />
              {/* List / Map toggle — only show when we have stops */}
              {coords && !geoLoading && nearbyStops.length > 0 && (
                <button
                  onClick={() => setShowMap((v) => !v)}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                  title={showMap ? 'Show list' : 'Show map'}
                >
                  {showMap ? (
                    /* List icon */
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  ) : (
                    /* Map icon */
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* New version available */}
          {updateAvailable && (
            <div className="mt-2 flex items-center justify-between bg-white/25 rounded-lg px-3 py-1.5">
              <span className="text-white text-xs font-medium">New version available</span>
              <button
                onClick={() => window.location.reload()}
                className="text-white text-xs font-semibold underline underline-offset-2"
              >
                Reload
              </button>
            </div>
          )}

          {/* Offline / stale data warning */}
          {isStale && (
            <div className="mt-2 flex items-center gap-1.5 bg-white/20 rounded-lg px-3 py-1.5">
              <span className="text-white text-xs">
                {online ? '⚠ Arrival times may be outdated' : '⚠ No connection — showing last known data'}
              </span>
            </div>
          )}

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

      {/* Map view */}
      {showMap && coords && !isSearching && (
        <div className="flex-1 relative overflow-hidden">
          <NearbyMapView
            stops={sortedNearbyStops}
            arrivalsByStop={arrivalsByStop}
            userLat={coords.lat}
            userLon={coords.lon}
            routeMap={routeMap}
            onSelectStop={(stopId, name) => {
              setShowMap(false)
              onSelectStop(stopId, name)
            }}
          />
        </div>
      )}

      {/* List view */}
      {(!showMap || isSearching) && (
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
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

        {/* Arrivals error */}
        {!isSearching && sirisError && !sirisLoading && (
          <div className="bg-white rounded-2xl shadow p-5 text-center">
            <p className="text-gray-500 text-sm">Couldn't load arrival times.</p>
            <button
              onClick={() => mutateSiri()}
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
      </div>
      )}
    </div>
  )
}
