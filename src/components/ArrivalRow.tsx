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
  const good = arriving || catchable

  return (
    <button
      onClick={() => onClick?.(arrival)}
      disabled={departed}
      className={[
        // border-l-4 (4px) + pl-3 (12px) = 16px total left space, same as original pl-4
        'w-full flex items-center gap-3 border-l-4 pl-3 pr-4 py-2.5 text-left transition-colors',
        departed
          ? 'opacity-40 cursor-default border-transparent'
          : good
            ? 'border-teal-500 hover:bg-teal-50 cursor-pointer'
            : 'border-orange-400 hover:bg-orange-50 cursor-pointer',
      ].join(' ')}
    >
      {/* Primary: when to leave */}
      <span
        className={[
          'font-bold text-sm shrink-0 whitespace-nowrap',
          departed ? 'text-gray-400' : arriving ? 'text-teal-600' : good ? 'text-teal-700' : 'text-orange-600',
        ].join(' ')}
      >
        {leaveLabel}
      </span>

      {/* Route badge */}
      <RouteBadge routeId={arrival.routeId} route={arrival.routeId ? routeMap[arrival.routeId] : undefined} />

      {/* Secondary: actual bus arrival time */}
      {!departed && !arriving && (
        <span className="text-xs text-gray-400 ml-auto shrink-0">
          bus {busLabel}
        </span>
      )}
    </button>
  )
}
