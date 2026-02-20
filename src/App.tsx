import React, { useState, useEffect } from 'react'
import NearbyView from './views/NearbyView'
import TripView from './views/TripView'
import StopView from './views/StopView'
import type { SelectedTrip } from './types'

type AppView =
  | { view: 'home' }
  | { view: 'stop'; stopId: string; name?: string; backLabel: string }
  | { view: 'trip'; trip: SelectedTrip; backLabel: string }

/** Parse the initial view from the URL path (e.g. /stop/504416). */
function viewFromPath(pathname: string): AppView | null {
  const m = pathname.match(/^\/stop\/([^/?#]+)/)
  if (m) return { view: 'stop', stopId: decodeURIComponent(m[1]), backLabel: 'Home' }
  return null
}

/** Canonical URL path for a given view. */
function pathForView(v: AppView): string {
  if (v.view === 'stop') return `/stop/${encodeURIComponent(v.stopId)}`
  return '/'
}

export default function App() {
  const [current, setCurrent] = useState<AppView>(() => {
    // Deep link takes priority, then history state, then home
    return (
      viewFromPath(window.location.pathname) ??
      (window.history.state as AppView | null)?.view
        ? (window.history.state as AppView)
        : { view: 'home' }
    )
  })

  useEffect(() => {
    // Ensure the initial history entry has state + correct URL
    if (!window.history.state?.view) {
      const init: AppView = viewFromPath(window.location.pathname) ?? { view: 'home' }
      window.history.replaceState(init, '', pathForView(init))
      setCurrent(init)
    }

    const onPop = (e: PopStateEvent) => {
      const state = (e.state as AppView | null) ?? { view: 'home' }
      setCurrent(state)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  /** Push a new history entry, updating both state and URL. */
  const navigate = (next: AppView) => {
    window.history.pushState(next, '', pathForView(next))
    setCurrent(next)
  }

  const goBack = () => window.history.back()

  if (current.view === 'stop') {
    return (
      <StopView
        stopId={current.stopId}
        stopName={current.name}
        backLabel={current.backLabel}
        onBack={goBack}
        onSelectTrip={(trip) =>
          navigate({ view: 'trip', trip, backLabel: current.name ?? 'Back' })
        }
        onSelectStop={(stopId, name) =>
          navigate({ view: 'stop', stopId, name, backLabel: current.name ?? 'Back' })
        }
      />
    )
  }

  if (current.view === 'trip') {
    return (
      <TripView
        trip={current.trip}
        onBack={goBack}
        backLabel={current.backLabel}
        onSelectStop={(stopId, name) =>
          navigate({ view: 'stop', stopId, name, backLabel: current.trip.headsign ?? 'Trip' })
        }
      />
    )
  }

  return (
    <NearbyView
      onSelectTrip={(trip) =>
        navigate({ view: 'trip', trip, backLabel: 'Nearby stops' })
      }
      onSelectStop={(stopId, name) =>
        navigate({ view: 'stop', stopId, name, backLabel: 'Nearby stops' })
      }
    />
  )
}
