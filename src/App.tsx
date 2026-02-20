import React, { useState, useEffect } from 'react'
import NearbyView from './views/NearbyView'
import TripView from './views/TripView'
import StopView from './views/StopView'
import type { SelectedTrip } from './types'

type AppView =
  | { view: 'home' }
  | { view: 'stop'; stopId: string; name?: string; backLabel: string }
  | { view: 'trip'; trip: SelectedTrip; backLabel: string }

export default function App() {
  const [current, setCurrent] = useState<AppView>(() => {
    // On first load, restore from history state if present
    const s = window.history.state as AppView | null
    return s?.view ? s : { view: 'home' }
  })

  useEffect(() => {
    // Ensure the initial history entry has state so popstate fires correctly
    if (!window.history.state?.view) {
      window.history.replaceState({ view: 'home' } satisfies AppView, '')
    }

    const onPop = (e: PopStateEvent) => {
      const state = (e.state as AppView | null) ?? { view: 'home' }
      setCurrent(state)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  /** Push a new history entry and update React state together. */
  const navigate = (next: AppView) => {
    window.history.pushState(next, '')
    setCurrent(next)
  }

  /** Go back — popstate listener handles the state update. */
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
