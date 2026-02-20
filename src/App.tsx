import React, { useState } from 'react'
import NearbyView from './views/NearbyView'
import TripView from './views/TripView'
import StopView from './views/StopView'
import type { SelectedTrip } from './types'

interface SelectedStop {
  stopId: string
  name?: string
  fromTrip?: SelectedTrip
}

export default function App() {
  const [selectedTrip, setSelectedTrip] = useState<SelectedTrip | null>(null)
  const [selectedStop, setSelectedStop] = useState<SelectedStop | null>(null)

  const handleSelectStop = (stopId: string, name: string | undefined, fromTrip?: SelectedTrip) => {
    setSelectedStop({ stopId, name, fromTrip })
  }

  if (selectedStop) {
    const fromTrip = selectedStop.fromTrip
    return (
      <StopView
        stopId={selectedStop.stopId}
        stopName={selectedStop.name}
        backLabel={fromTrip ? 'Back to trip' : 'Nearby stops'}
        onBack={() => {
          setSelectedStop(null)
          if (!fromTrip) setSelectedTrip(null)
        }}
        onSelectTrip={(trip) => {
          setSelectedStop(null)
          setSelectedTrip(trip)
        }}
        onSelectStop={(stopId, name) => setSelectedStop({ stopId, name, fromTrip })}
      />
    )
  }

  if (selectedTrip) {
    return (
      <TripView
        trip={selectedTrip}
        onBack={() => setSelectedTrip(null)}
        onSelectStop={(stopId, name) => handleSelectStop(stopId, name, selectedTrip)}
      />
    )
  }

  return (
    <NearbyView
      onSelectTrip={setSelectedTrip}
      onSelectStop={(stopId, name) => handleSelectStop(stopId, name)}
    />
  )
}
