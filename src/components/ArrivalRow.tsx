import React from 'react'
import RouteBadge from './RouteBadge'
import { formatLeaveIn, formatArrival, isCatchable } from '../utils/geo'
import { useNow } from '../hooks/useNow'
import type { ArrivalInfo, RouteMap } from '../types'

interface ArrivalRowProps {
  arrival: ArrivalInfo
  walkTimeSec: number
  routeMap: RouteMap
  onClick?: (arrival: ArrivalInfo) => void
}

export default function ArrivalRow({ arrival, walkTimeSec, routeMap, onClick }: ArrivalRowProps) {
  useNow(10_000) // re-render every 10s so times stay fresh between SWR refreshes

  const arrTime = arrival.arrival?.time ?? arrival.departure?.time
  if (!arrTime) return null

  const catchable = isCatchable(arrTime, walkTimeSec)
  const leaveLabel = formatLeaveIn(arrTime, walkTimeSec)
  const busLabel = formatArrival(arrTime)

  const departed = leaveLabel === 'departed'
  const arriving = leaveLabel === 'arriving'

  // Color for the left-border signal stripe
  const borderColor = departed
    ? 'transparent'
    : arriving || catchable
      ? '#14b8a6'   // teal-500
      : '#f97316'   // orange-500

  return (
    <button
      onClick={() => onClick?.(arrival)}
      disabled={departed}
      className={[
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
        departed
          ? 'opacity-40 cursor-default'
          : catchable || arriving
            ? 'hover:bg-teal-50 cursor-pointer'
            : 'hover:bg-orange-50 cursor-pointer',
      ].join(' ')}
      style={{ boxShadow: `inset 3px 0 0 ${borderColor}` }}
    >
      {/* Primary label: when to leave */}
      <span
        className={[
          'font-bold text-sm w-24 shrink-0',
          departed
            ? 'text-gray-400'
            : arriving
              ? 'text-teal-600'
              : catchable
                ? 'text-teal-700'
                : 'text-orange-600',
        ].join(' ')}
      >
        {leaveLabel}
      </span>

      {/* Route badge */}
      <RouteBadge routeId={arrival.routeId} route={arrival.routeId ? routeMap[arrival.routeId] : undefined} />

      {/* Bus arrival time (secondary context) */}
      {!departed && !arriving && (
        <span className="text-xs text-gray-400 ml-auto shrink-0">
          bus {busLabel}
        </span>
      )}
    </button>
  )
}
