import React, { useMemo, useState } from 'react'
import { useSiriArrivals, useStops, useRoutes, useRouteHeadsigns, useAlerts } from '../hooks/useGtfs'
import { useLocation } from '../hooks/useLocation'
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
  const { arrivalsByStop, isLoading, error } = useSiriArrivals([stopId])
  const { stops } = useStops()
  const { routeMap } = useRoutes()
  const { routeHeadsigns } = useRouteHeadsigns()
  const { alerts } = useAlerts()
  const { coords } = useLocation()

  const stop = useMemo(
    () => stops.find((s) => s.stopId === stopId),
    [stops, stopId],
  )

  const arrivals = arrivalsByStop.get(stopId) ?? []

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
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = `${window.location.origin}/stop/${stopId}`
    if (navigator.share) {
      await navigator.share({ title: displayName, url }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(url).catch(() => {})
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-white font-bold text-xl leading-tight">{displayName}</h1>
            <button
              onClick={handleShare}
              className="shrink-0 flex items-center gap-1 text-white/70 hover:text-white text-xs mt-0.5 transition-colors"
              title="Share this stop"
            >
              {copied ? (
                <span className="text-white/90 font-medium">Copied!</span>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              )}
            </button>
          </div>
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
