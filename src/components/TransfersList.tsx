import React from 'react'
import RouteBadge from './RouteBadge'
import { haversineMeters } from '../utils/geo'
import type { Stop, RouteMap } from '../types'

interface TransfersListProps {
  stop: Stop & { distanceMeters?: number }
  allStops: Stop[]
  routeMap: RouteMap
}

export default function TransfersList({ stop, allStops, routeMap }: TransfersListProps) {
  const nearby = allStops
    .filter((s) => s.stopId !== stop.stopId)
    .map((s) => ({
      ...s,
      dist: haversineMeters(stop.lat, stop.lon, s.lat, s.lon),
    }))
    .filter((s) => s.dist <= 320 && s.routes.length > 0)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5)

  if (nearby.length === 0) return null

  return (
    <div className="border-t border-gray-100 px-4 py-2">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        Transfers nearby
      </p>
      <div className="space-y-1.5">
        {nearby.map((s) => (
          <div key={s.stopId} className="flex items-start gap-2">
            <span className="text-xs text-gray-500 w-8 text-right shrink-0 pt-0.5">
              {Math.round(s.dist)}m
            </span>
            <div>
              <p className="text-xs text-gray-700 leading-tight">{s.name}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {s.routes.slice(0, 6).map((rId) => (
                  <RouteBadge key={rId} routeId={rId} route={routeMap[rId]} small />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
