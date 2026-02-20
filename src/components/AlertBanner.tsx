import React, { useState } from 'react'
import type { GtfsAlert } from '../types'

interface AlertBannerProps {
  alerts: GtfsAlert[]
  nearbyRouteIds: Set<string>
}

function getEnglishText(alertText: GtfsAlert['headerText']): string | null {
  if (!alertText?.translation?.length) return null
  return (
    alertText.translation.find((t) => t.language === 'en')?.text ??
    alertText.translation[0]?.text ??
    null
  )
}

export default function AlertBanner({ alerts, nearbyRouteIds }: AlertBannerProps) {
  const [open, setOpen] = useState(false)

  const relevant = alerts.filter((a) =>
    a.informedEntity?.some((e) => e.routeId && nearbyRouteIds.has(e.routeId))
  )

  if (relevant.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors"
      >
        <span>⚠</span>
        <span>{relevant.length} alert{relevant.length !== 1 ? 's' : ''}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-30 w-80 max-h-72 overflow-y-auto bg-white rounded-2xl shadow-lg">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Service Alerts</span>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {relevant.map((alert, i) => {
              const header = getEnglishText(alert.headerText)
              const desc = getEnglishText(alert.descriptionText)
              const effect = alert.effect?.replace(/_/g, ' ') ?? null
              return (
                <div key={i} className="px-4 py-3">
                  {effect && (
                    <span className="inline-block mb-1 text-xs font-semibold text-amber-600 uppercase tracking-wide">
                      {effect}
                    </span>
                  )}
                  {header && (
                    <p className="text-sm text-gray-800 line-clamp-2">{header}</p>
                  )}
                  {desc && desc !== header && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{desc}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
