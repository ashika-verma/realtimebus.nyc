import React, { createContext, useContext, useState, useEffect } from 'react'

interface Coords {
  lat: number
  lon: number
}

export interface LocationState {
  coords: Coords | null
  error: string | null
  loading: boolean
}

export const LocationContext = createContext<LocationState>({
  coords: null,
  error: null,
  loading: true,
})

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LocationState>({
    coords: null,
    error: null,
    loading: true,
  })

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({ coords: null, error: 'Geolocation not supported', loading: false })
      return
    }

    const id = navigator.geolocation.watchPosition(
      (pos) =>
        setState({
          coords: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          error: null,
          loading: false,
        }),
      (err) => setState({ coords: null, error: err.message, loading: false }),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    )

    return () => navigator.geolocation.clearWatch(id)
  }, [])

  return <LocationContext.Provider value={state}>{children}</LocationContext.Provider>
}

export function useLocation(): LocationState {
  return useContext(LocationContext)
}
