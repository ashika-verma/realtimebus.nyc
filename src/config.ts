/**
 * App-wide settings with sensible defaults.
 * Future: persist these to localStorage and expose a Settings screen.
 */
export const DEFAULT_SETTINGS = {
  /** Radius (meters) for the nearby stop search. 800m ≈ 10 min walk at 1.33 m/s. */
  nearbyRadiusMeters: 800,
} as const

export type AppSettings = typeof DEFAULT_SETTINGS
