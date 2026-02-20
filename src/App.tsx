import React, { useState } from 'react'
import NearbyView from './views/NearbyView'
import TripView from './views/TripView'
import StopView from './views/StopView'
import type { SelectedTrip } from './types'

interface SelectedStop {
  stopId: string
  name?: string
  fromTrip: SelectedTrip
}

export default function App() {
  const [selectedTrip, setSelectedTrip] = useState<SelectedTrip | null>(null)
  const [selectedStop, setSelectedStop] = useState<SelectedStop | null>(null)

  if (selectedStop) {
    return (
      <StopView
        stopId={selectedStop.stopId}
        stopName={selectedStop.name}
        onBack={() => setSelectedStop(null)}
        onSelectTrip={(trip) => {
          setSelectedStop(null)
          setSelectedTrip(trip)
        }}
      />
    )
  }

  if (selectedTrip) {
    return (
      <TripView
        trip={selectedTrip}
        onBack={() => setSelectedTrip(null)}
        onSelectStop={(stopId, name) =>
          setSelectedStop({ stopId, name, fromTrip: selectedTrip })
        }
      />
    )
  }

  return <NearbyView onSelectTrip={setSelectedTrip} />
}
