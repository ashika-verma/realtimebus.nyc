import React from 'react'
import { formatArrival } from '../utils/geo'
import type { TimelineStop } from '../types'

interface TripTimelineProps {
  stops: TimelineStop[]
  vehicleStop?: string | null
  routeColor?: string
  onSelectStop?: (stopId: string, name?: string) => void
}

export default function TripTimeline({
  stops,
  vehicleStop,
  routeColor = '#20B2AA',
  onSelectStop,
}: TripTimelineProps) {
  const now = Date.now() / 1000

  const nextStopIdx = stops.findIndex((s) => {
    const t = Number(s.arrival?.time ?? s.departure?.time ?? 0)
    return t > 0 && t > now
  })

  return (
    <div className="relative">
      {stops.map((stop, idx) => {
        const time = stop.arrival?.time ?? stop.departure?.time
        const isPast = time ? Number(time) < now - 30 : idx < nextStopIdx
        const isNext = idx === nextStopIdx
        const isLive = !!vehicleStop && stop.stopId === vehicleStop
        const isTerminal = idx === 0 || idx === stops.length - 1

        return (
          <div key={`${stop.stopId ?? ''}-${idx}`} className="flex items-start gap-3 relative">
            {/* Vertical line + dot column */}
            <div className="flex flex-col items-center" style={{ width: 12 }}>
              {idx > 0 && (
                <div
                  className="w-0.5 flex-1 min-h-[12px]"
                  style={{ backgroundColor: isPast ? '#d1d5db' : routeColor }}
                />
              )}

              <div className="relative flex items-center justify-center">
                {isNext && (
                  <span
                    className="absolute w-4 h-4 rounded-full opacity-40 animate-ping"
                    style={{ backgroundColor: routeColor }}
                  />
                )}
                <span
                  className={`relative w-3 h-3 border-2 ${isTerminal ? '' : 'rounded-full'} z-10`}
                  style={{
                    borderColor: isPast ? '#d1d5db' : routeColor,
                    backgroundColor: isPast ? '#e5e7eb' : isNext ? 'white' : routeColor,
                  }}
                />
              </div>

              {idx < stops.length - 1 && (
                <div
                  className="w-0.5 flex-1 min-h-[12px]"
                  style={{ backgroundColor: isPast ? '#d1d5db' : routeColor }}
                />
              )}
            </div>

            {/* Stop info */}
            <button
              className={`pb-4 flex-1 pt-0.5 text-left ${isPast ? 'opacity-40' : 'hover:opacity-70'} transition-opacity`}
              onClick={() => stop.stopId && onSelectStop?.(stop.stopId, stop.name)}
              disabled={!onSelectStop || !stop.stopId}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-sm leading-tight ${
                    isNext ? 'font-bold text-gray-900' : 'text-gray-700'
                  }`}
                >
                  {stop.name ?? stop.stopId}
                  {isLive && (
                    <span
                      className="ml-1.5 text-xs font-normal text-white px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: routeColor }}
                    >
                      bus here
                    </span>
                  )}
                </span>
                {time != null && (
                  <span
                    className={`text-sm font-mono shrink-0 ${
                      isPast ? 'text-gray-400' : isNext ? 'font-bold' : 'text-gray-500'
                    }`}
                    style={isNext ? { color: routeColor } : {}}
                  >
                    {formatArrival(time)}
                  </span>
                )}
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}
