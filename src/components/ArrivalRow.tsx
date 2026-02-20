import React from 'react'
import RouteBadge from './RouteBadge'
import { formatArrival, isCatchable } from '../utils/geo'
import type { ArrivalInfo, RouteMap, SelectedTrip } from '../types'

interface ArrivalRowProps {
  arrival: ArrivalInfo
  walkTimeSec: number
  routeMap: RouteMap
  onClick?: (arrival: ArrivalInfo) => void
}

export default function ArrivalRow({ arrival, walkTimeSec, routeMap, onClick }: ArrivalRowProps) {
  const arrTime = arrival.arrival?.time ?? arrival.departure?.time
  if (!arrTime) return null

  const catchable = isCatchable(arrTime, walkTimeSec)
  const timeLabel = formatArrival(arrTime)
  const route = arrival.routeId ? routeMap[arrival.routeId] : undefined

  const missed = timeLabel === 'departed'
  const arriving = timeLabel === 'arriving'

  return (
    <button
      onClick={() => onClick?.(arrival)}
      className={[
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
        missed
          ? 'opacity-40 cursor-default'
          : catchable
            ? 'hover:bg-teal-50 cursor-pointer'
            : 'hover:bg-orange-50 cursor-pointer',
        catchable && !missed ? 'bg-teal-50/60' : '',
      ].join(' ')}
      disabled={missed}
    >
      {/* Time */}
      <span
        className={[
          'font-bold text-base w-20 shrink-0',
          missed
            ? 'text-gray-400'
            : arriving
              ? 'text-teal-600'
              : catchable
                ? 'text-gray-900'
                : 'text-orange-600',
        ].join(' ')}
      >
        {timeLabel}
      </span>

      {/* Route badge */}
      <RouteBadge routeId={arrival.routeId} route={route} />

      {/* Spacer + indicator dot */}
      <span className="flex-1" />
      {!missed && (
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${catchable ? 'bg-teal-500' : 'bg-orange-400'}`}
          title={catchable ? 'Catchable' : 'Tight — might miss it'}
        />
      )}
    </button>
  )
}
