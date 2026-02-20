import useSWR from 'swr'
import { useState } from 'react'
import type { FeedMessage, Stop, Route, RouteMap, RouteHeadsigns, GtfsAlert } from '../types'
import { usePageVisible } from './usePageVisible'

const fetcher = (url: string): Promise<FeedMessage | Stop[] | Route[]> =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return r.json()
  })

const REFRESH_INTERVAL = 15000 // 15 seconds

interface TripUpdatesResult {
  tripUpdates: FeedMessage['entity']
  error: Error | undefined
  isLoading: boolean
  isValidating: boolean
  lastUpdated: number | null
  mutate: () => void
}

export function useTripUpdates(): TripUpdatesResult {
  const visible = usePageVisible()
  // Track client-side fetch time, not the server cache timestamp (_fetchedAt).
  // This way the "Xs ago" counter resets on every successful fetch, including
  // pull-to-refresh, even when the server returns the same cached payload.
  const [lastFetched, setLastFetched] = useState<number | null>(null)
  const { data, error, isLoading, isValidating, mutate } = useSWR<FeedMessage>(
    '/api/gtfs/trips',
    fetcher as (url: string) => Promise<FeedMessage>,
    {
      refreshInterval: visible ? REFRESH_INTERVAL : 0,
      onSuccess: () => setLastFetched(Date.now()),
    }
  )
  return {
    tripUpdates: data?.entity ?? [],
    error,
    isLoading,
    isValidating,
    lastUpdated: lastFetched,
    mutate,
  }
}

interface VehiclePositionsResult {
  vehicles: FeedMessage['entity']
  error: Error | undefined
  isLoading: boolean
  mutate: () => void
}

export function useVehiclePositions(): VehiclePositionsResult {
  const visible = usePageVisible()
  const { data, error, isLoading, mutate } = useSWR<FeedMessage>(
    '/api/gtfs/vehicles',
    fetcher as (url: string) => Promise<FeedMessage>,
    { refreshInterval: visible ? REFRESH_INTERVAL : 0 }
  )
  return {
    vehicles: data?.entity ?? [],
    error,
    isLoading,
    mutate,
  }
}

interface StopsResult {
  stops: Stop[]
  error: Error | undefined
  isLoading: boolean
}

export function useStops(): StopsResult {
  const { data, error, isLoading } = useSWR<Stop[]>(
    '/api/stops',
    fetcher as (url: string) => Promise<Stop[]>,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )
  return { stops: data ?? [], error, isLoading }
}

interface RoutesResult {
  routes: Route[]
  routeMap: RouteMap
  error: Error | undefined
  isLoading: boolean
}

export function useRoutes(): RoutesResult {
  const { data, error, isLoading } = useSWR<Route[]>(
    '/api/routes',
    fetcher as (url: string) => Promise<Route[]>,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )
  return {
    routes: data ?? [],
    routeMap: buildRouteMap(data),
    error,
    isLoading,
  }
}

export function useRouteHeadsigns(): { routeHeadsigns: RouteHeadsigns; isLoading: boolean } {
  const { data, isLoading } = useSWR<RouteHeadsigns>(
    '/api/route-headsigns',
    fetcher as unknown as (url: string) => Promise<RouteHeadsigns>,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )
  return { routeHeadsigns: data ?? {}, isLoading }
}

export function useAlerts(): { alerts: GtfsAlert[]; isLoading: boolean; mutate: () => void } {
  const { data, isLoading, mutate } = useSWR<FeedMessage>(
    '/api/gtfs/alerts',
    fetcher as (url: string) => Promise<FeedMessage>,
    { refreshInterval: 60_000, revalidateOnFocus: false }
  )
  const alerts = (data?.entity ?? []).map((e) => e.alert).filter(Boolean) as GtfsAlert[]
  return { alerts, isLoading, mutate }
}

function buildRouteMap(routes: Route[] | undefined): RouteMap {
  if (!routes) return {}
  const map: RouteMap = {}
  for (const r of routes) map[r.routeId] = r
  return map
}
