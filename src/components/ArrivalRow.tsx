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
  const scheduled = !!arrival.isScheduled

  // Border color: gray for scheduled (no GPS yet), teal/orange for real-time
  const borderClass = departed
    ? 'border-transparent'
    : scheduled
      ? 'border-gray-300'
      : good
        ? 'border-teal-500'
        : 'border-orange-400'

  const hoverClass = departed || scheduled
    ? ''
    : good ? 'hover:bg-teal-50' : 'hover:bg-orange-50'

  // Secondary label: stops away (real-time) or "sched" (no GPS)
  const secondaryLabel = scheduled
    ? 'sched'
    : arrival.stopsAway != null && arrival.stopsAway > 0
      ? `${arrival.stopsAway} stop${arrival.stopsAway === 1 ? '' : 's'}`
      : `bus ${busLabel}`

  return (
    <button
      onClick={() => onClick?.(arrival)}
      disabled={departed}
      className={[
        'w-full flex items-center gap-3 border-l-4 pl-3 pr-4 py-2.5 text-left transition-colors',
        borderClass,
        hoverClass,
        departed ? 'opacity-40 cursor-default' : 'cursor-pointer',
      ].join(' ')}
    >
      {/* Primary: when to leave */}
      <span
        className={[
          'font-bold text-sm shrink-0 whitespace-nowrap',
          departed
            ? 'text-gray-400'
            : scheduled
              ? 'text-gray-500'
              : arriving
                ? 'text-teal-600'
                : good
                  ? 'text-teal-700'
                  : 'text-orange-600',
        ].join(' ')}
      >
        {leaveLabel}
      </span>

      {/* Route badge */}
      <RouteBadge routeId={arrival.routeId} route={arrival.routeId ? routeMap[arrival.routeId] : undefined} />

      {/* Secondary: stops away / bus time / sched */}
      {!departed && !arriving && (
        <span className={[
          'text-xs ml-auto shrink-0',
          scheduled ? 'text-gray-300 italic' : 'text-gray-400',
        ].join(' ')}>
          {secondaryLabel}
        </span>
      )}
    </button>
  )
}
