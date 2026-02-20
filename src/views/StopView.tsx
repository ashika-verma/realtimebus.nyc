import React, { useMemo } from 'react'
import { useTripUpdates, useStops, useRoutes, useRouteHeadsigns, useAlerts } from '../hooks/useGtfs'
import { useLocation } from '../hooks/useLocation'
import { buildArrivalsByStop } from '../utils/gtfs'
import { haversineMeters } from '../utils/geo'
import StopCard from '../components/StopCard'
import type { SelectedTrip } from '../types'

interface StopViewProps {
  stopId: string
  stopName?: string
  backLabel?: string
  onBack: () => void
  onSelectTrip: (trip: SelectedTrip) => void
  onSelectStop: (stopId: string, name: string) => void
}

export default function StopView({ stopId, stopName, backLabel = 'Back', onBack, onSelectTrip, onSelectStop }: StopViewProps) {
  const { tripUpdates, isLoading, error } = useTripUpdates()
  const { stops } = useStops()
  const { routeMap } = useRoutes()
  const { routeHeadsigns } = useRouteHeadsigns()
  const { alerts } = useAlerts()
  const { coords } = useLocation()

  const stop = useMemo(
    () => stops.find((s) => s.stopId === stopId),
    [stops, stopId],
  )

  const arrivals = useMemo(() => {
    if (!tripUpdates.length) return []
    return buildArrivalsByStop(tripUpdates, new Set([stopId])).get(stopId) ?? []
  }, [tripUpdates, stopId])

  const enrichedStop = useMemo(() => {
    if (!stop) return null
    return {
      ...stop,
      distanceMeters: coords
        ? haversineMeters(coords.lat, coords.lon, stop.lat, stop.lon)
        : 0,
    }
  }, [stop, coords])

  const displayName = stop?.name ?? stopName ?? `Stop ${stopId}`

  return (
    <div className="flex flex-col h-dvh" style={{ backgroundColor: 'lightseagreen' }}>
      {/* Header — pinned, never scrolls */}
      <header className="shrink-0 px-4 pb-3 pt-10 z-20" style={{ backgroundColor: 'lightseagreen' }}>
        <div className="max-w-lg mx-auto">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/80 text-sm mb-3 -ml-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {backLabel}
          </button>
          <h1 className="text-white font-bold text-xl leading-tight">{displayName}</h1>
          <p className="text-white/60 text-xs mt-0.5">Stop #{stopId} · All arrivals</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain">
        <div className="px-4 pb-8 max-w-lg mx-auto space-y-3">
        {isLoading || !enrichedStop ? (
          <div className="bg-white/30 rounded-2xl h-40 animate-pulse" />
        ) : error ? (
          <div className="bg-white rounded-2xl shadow p-5 text-center">
            <p className="text-gray-500 text-sm">Couldn't load arrival times.</p>
          </div>
        ) : (
          <StopCard
            stop={enrichedStop}
            arrivals={arrivals}
            routeMap={routeMap}
            routeHeadsigns={routeHeadsigns}
            allStops={stops}
            alerts={alerts}
            onSelectTrip={onSelectTrip}
            onSelectStop={onSelectStop}
          />
        )}
        </div>
      </main>
    </div>
  )
}
