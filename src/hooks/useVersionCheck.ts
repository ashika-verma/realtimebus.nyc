import { useState, useEffect, useRef } from 'react'

const POLL_INTERVAL = 2 * 60 * 1000 // 2 minutes

export function useVersionCheck(): boolean {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const initialVersion = useRef<string | null>(null)

  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' })
        if (!r.ok) return
        const { v } = await r.json()
        if (initialVersion.current === null) {
          initialVersion.current = v
        } else if (v !== initialVersion.current) {
          setUpdateAvailable(true)
        }
      } catch {
        // network error — silently ignore
      }
    }

    check()
    const id = setInterval(check, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [])

  return updateAvailable
}
