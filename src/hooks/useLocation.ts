import { useState, useEffect } from 'react'

interface Coords {
  lat: number
  lon: number
}

interface LocationState {
  coords: Coords | null
  error: string | null
  loading: boolean
}

export function useLocation(): LocationState {
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
      (pos) => {
        setState({
          coords: { lat: pos.coords.latitude, lon: pos.coords.longitude },
          error: null,
          loading: false,
        })
      },
      (err) => {
        setState({ coords: null, error: err.message, loading: false })
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )

    return () => navigator.geolocation.clearWatch(id)
  }, [])

  return state
}
