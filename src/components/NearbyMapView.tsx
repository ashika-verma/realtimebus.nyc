import React, { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import RouteBadge from './RouteBadge'
import type { Stop, ArrivalInfo, RouteMap } from '../types'

interface NearbyMapViewProps {
  stops: (Stop & { distanceMeters: number })[]
  arrivalsByStop: Map<string, ArrivalInfo[]>
  userLat: number
  userLon: number
  routeMap: RouteMap
  onSelectStop: (stopId: string, name: string) => void
}

// Fit the map to include the user + all nearby stops whenever the stop list changes
function BoundsUpdater({
  stops,
  userLat,
  userLon,
}: {
  stops: Stop[]
  userLat: number
  userLon: number
}) {
  const map = useMap()
  useEffect(() => {
    const points: [number, number][] = [
      [userLat, userLon],
      ...stops.map((s) => [s.lat, s.lon] as [number, number]),
    ]
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 17 })
    } else {
      map.setView([userLat, userLon], 17)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only on mount — user can pan/zoom freely after
  return null
}

function makeStopIcon(hasArrivals: boolean): L.DivIcon {
  const bg = hasArrivals ? '#0d9488' : '#9ca3af' // teal-600 or gray-400
  return L.divIcon({
    html: `<div style="
      width:14px;height:14px;
      background:${bg};
      border:2.5px solid white;
      border-radius:50%;
      box-shadow:0 1px 3px rgba(0,0,0,.35)
    "></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  })
}

const userIcon = L.divIcon({
  html: `<div style="
    width:16px;height:16px;
    background:#3b82f6;
    border:3px solid white;
    border-radius:50%;
    box-shadow:0 1px 4px rgba(0,0,0,.45)
  "></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function stopHasArrivals(arrivals: ArrivalInfo[]): boolean {
  const now = Date.now() / 1000
  return arrivals.some((r) => {
    const t = Number(r.arrival?.time ?? r.departure?.time ?? 0)
    return t > 0 && t - now > -120
  })
}

export default function NearbyMapView({
  stops,
  arrivalsByStop,
  userLat,
  userLon,
  routeMap,
  onSelectStop,
}: NearbyMapViewProps) {
  const stopIcons = useMemo(() => {
    const m = new Map<string, L.DivIcon>()
    for (const s of stops) {
      const arrivals = arrivalsByStop.get(s.stopId) ?? []
      m.set(s.stopId, makeStopIcon(stopHasArrivals(arrivals)))
    }
    return m
  }, [stops, arrivalsByStop])

  return (
    <MapContainer
      center={[userLat, userLon]}
      zoom={16}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <BoundsUpdater stops={stops} userLat={userLat} userLon={userLon} />

      {/* User location dot */}
      <Marker position={[userLat, userLon]} icon={userIcon} />

      {/* Stop markers */}
      {stops.map((stop) => (
        <Marker
          key={stop.stopId}
          position={[stop.lat, stop.lon]}
          icon={stopIcons.get(stop.stopId) ?? makeStopIcon(false)}
        >
          <Popup minWidth={180}>
            <div style={{ fontFamily: 'system-ui, sans-serif' }}>
              <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, color: '#111827' }}>
                {stop.name}
              </p>
              <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                #{stop.stopId} · {Math.round(stop.distanceMeters)}m away
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                {stop.routes.slice(0, 10).map((r) => (
                  <RouteBadge key={r} routeId={r} route={routeMap[r]} small />
                ))}
              </div>
              <button
                onClick={() => onSelectStop(stop.stopId, stop.name)}
                style={{
                  width: '100%',
                  background: '#0d9488',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 0',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                View arrivals →
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
