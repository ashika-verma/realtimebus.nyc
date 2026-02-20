import useSWR from 'swr'
import type { FeedMessage, Stop, Route, RouteMap } from '../types'

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
}

export function useTripUpdates(): TripUpdatesResult {
  const { data, error, isLoading, isValidating } = useSWR<FeedMessage>(
    '/api/gtfs/trips',
    fetcher as (url: string) => Promise<FeedMessage>,
    { refreshInterval: REFRESH_INTERVAL }
  )
  return {
    tripUpdates: data?.entity ?? [],
    error,
    isLoading,
    isValidating,
    lastUpdated: data?._fetchedAt ?? null,
  }
}

interface VehiclePositionsResult {
  vehicles: FeedMessage['entity']
  error: Error | undefined
  isLoading: boolean
}

export function useVehiclePositions(): VehiclePositionsResult {
  const { data, error, isLoading } = useSWR<FeedMessage>(
    '/api/gtfs/vehicles',
    fetcher as (url: string) => Promise<FeedMessage>,
    { refreshInterval: REFRESH_INTERVAL }
  )
  return {
    vehicles: data?.entity ?? [],
    error,
    isLoading,
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

function buildRouteMap(routes: Route[] | undefined): RouteMap {
  if (!routes) return {}
  const map: RouteMap = {}
  for (const r of routes) map[r.routeId] = r
  return map
}
