import React from 'react'

interface StopDotProps {
  isTerminal?: boolean
  isPast?: boolean
  isNext?: boolean
  isLive?: boolean
  routeColor?: string
}

export default function StopDot({
  isTerminal = false,
  isPast = false,
  isNext = false,
  routeColor = '#20B2AA',
}: StopDotProps) {
  const base = 'w-3 h-3 border-2 shrink-0 relative z-10'

  if (isTerminal) {
    return (
      <span
        className={`${base} ${isPast ? 'bg-gray-300 border-gray-300' : 'border-current'}`}
        style={!isPast ? { borderColor: routeColor, backgroundColor: routeColor } : {}}
      />
    )
  }

  return (
    <span
      className={`${base} rounded-full ${
        isPast
          ? 'bg-gray-200 border-gray-200'
          : isNext
            ? 'border-white bg-white'
            : 'bg-white'
      }`}
      style={!isPast ? { borderColor: routeColor } : {}}
    />
  )
}
