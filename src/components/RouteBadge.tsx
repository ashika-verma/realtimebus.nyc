import React from 'react'
import type { Route } from '../types'
import { contrastColor } from '../utils/gtfs'

interface RouteBadgeProps {
  routeId?: string
  route?: Route
  small?: boolean
}

export default function RouteBadge({ routeId, route, small = false }: RouteBadgeProps) {
  const bg = route?.routeColor ? `#${route.routeColor}` : '#20B2AA'
  const fg = route?.routeTextColor
    ? `#${route.routeTextColor}`
    : contrastColor(bg.replace('#', ''))

  const label = route?.routeShortName ?? routeId ?? '?'

  const sizeClass = small
    ? 'text-xs min-w-[1.5rem] h-6 px-1.5'
    : 'text-sm min-w-[2rem] h-7 px-2'

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-bold leading-none ${sizeClass}`}
      style={{ backgroundColor: bg, color: fg }}
      title={route?.routeLongName ?? routeId}
    >
      {label}
    </span>
  )
}
