// ─── GTFS Static ─────────────────────────────────────────────────────────────

export interface Stop {
  stopId: string
  name: string
  lat: number
  lon: number
  routes: string[]
  /** Populated at runtime after nearby search */
  distanceMeters?: number
}

export interface Route {
  routeId: string
  routeShortName: string
  routeLongName: string
  routeColor: string | null
  routeTextColor: string | null
}

export type RouteMap = Record<string, Route>

/** routeId → { "0": headsign, "1": headsign } */
export type RouteHeadsigns = Record<string, Record<string, string>>

// ─── GTFS-RT ─────────────────────────────────────────────────────────────────

export interface StopTimeEvent {
  time?: number | string
  delay?: number
}

export interface StopTimeUpdate {
  stopSequence?: number
  stopId?: string
  arrival?: StopTimeEvent
  departure?: StopTimeEvent
  scheduleRelationship?: string
}

export interface TripDescriptor {
  tripId?: string
  routeId?: string
  tripHeadsign?: string
  directionId?: number
  scheduleRelationship?: string
}

export interface VehicleDescriptor {
  id?: string
  label?: string
}

export interface TripUpdate {
  trip?: TripDescriptor
  vehicle?: VehicleDescriptor
  stopTimeUpdate?: StopTimeUpdate[]
}

export interface Position {
  latitude?: number
  longitude?: number
  bearing?: number
  speed?: number
}

export interface VehiclePosition {
  trip?: TripDescriptor
  vehicle?: VehicleDescriptor
  position?: Position
  currentStopSequence?: number
  stopId?: string
  currentStatus?: string
}

export interface AlertTranslation { text?: string; language?: string }
export interface AlertText { translation?: AlertTranslation[] }
export interface AlertPeriod { start?: number; end?: number }
export interface AlertInformedEntity { agencyId?: string; routeId?: string; stopId?: string }
export interface GtfsAlert {
  activePeriod?: AlertPeriod[]
  informedEntity?: AlertInformedEntity[]
  cause?: string
  effect?: string
  headerText?: AlertText
  descriptionText?: AlertText
}

export interface FeedEntity {
  id: string
  tripUpdate?: TripUpdate
  vehicle?: VehiclePosition
  alert?: GtfsAlert
}

export interface FeedMessage {
  entity: FeedEntity[]
  _fetchedAt?: number
}

// ─── App-level ────────────────────────────────────────────────────────────────

/** Enriched arrival row built from TripUpdate or SIRI stop-monitoring */
export interface ArrivalInfo {
  tripId?: string
  routeId?: string
  headsign?: string | null
  directionId?: number | null
  vehicleId?: string | null
  stopSequence?: number
  arrival?: StopTimeEvent | null
  departure?: StopTimeEvent | null
  scheduleRelationship?: string
  /** Stops between the bus and this stop (from SIRI Distances) */
  stopsAway?: number | null
  /** True when only a scheduled time is available (no real-time GPS prediction) */
  isScheduled?: boolean
}

/** What gets passed when navigating to TripView */
export interface SelectedTrip {
  tripId: string
  vehicleId?: string | null
  routeId: string
  headsign?: string | null
  stopId: string
}

/** Stop enriched with stop-time data for TripTimeline */
export interface TimelineStop extends StopTimeUpdate {
  name?: string
}
