import React, { useState } from 'react'
import NearbyView from './views/NearbyView'
import TripView from './views/TripView'
import type { SelectedTrip } from './types'

export default function App() {
  const [selectedTrip, setSelectedTrip] = useState<SelectedTrip | null>(null)

  if (selectedTrip) {
    return <TripView trip={selectedTrip} onBack={() => setSelectedTrip(null)} />
  }

  return <NearbyView onSelectTrip={setSelectedTrip} />
}
