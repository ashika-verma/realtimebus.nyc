import { useState, useEffect } from 'react'

/**
 * Returns the current timestamp (ms), re-rendering the component every `intervalMs`.
 * Use this to keep time-sensitive displays fresh between SWR refreshes.
 */
export function useNow(intervalMs = 10_000): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
