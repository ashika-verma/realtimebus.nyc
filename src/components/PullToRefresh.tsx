import React, {
  useRef, useState, useEffect, useCallback,
  type RefObject, type CSSProperties,
} from 'react'

const THRESHOLD = 72
const MAX_PULL = 150

// ─── Bus SVG ─────────────────────────────────────────────────────────────────

function Wheel({ cx, cy, spin }: { cx: number; cy: number; spin: boolean }) {
  const style: CSSProperties = spin
    ? { animation: 'busWheelSpin 0.45s linear infinite', transformBox: 'fill-box', transformOrigin: 'center' }
    : {}
  return (
    <g style={style}>
      <circle cx={cx} cy={cy} r={7} fill="#1a1a2e" />
      <circle cx={cx} cy={cy} r={3.5} fill="#3a3a5e" />
      <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} stroke="#555" strokeWidth="1.5" />
      <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} stroke="#555" strokeWidth="1.5" />
    </g>
  )
}

function BusSVG({ spin, bounce }: { spin: boolean; bounce: boolean }) {
  return (
    <svg
      width="88" height="46" viewBox="0 0 88 46" fill="none"
      style={{
        transform: bounce ? 'translateY(-5px)' : 'translateY(0)',
        transition: 'transform 180ms cubic-bezier(0.34,1.56,0.64,1)',
        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.25))',
      }}
    >
      <rect x="10" y="26" width="64" height="10" rx="2" fill="#167a7a" />
      <rect x="2" y="7" width="76" height="22" rx="5" fill="#20B2AA" />
      <rect x="2" y="7" width="76" height="7" rx="5" fill="#18a0a0" />
      {[9, 22, 35, 48].map((x) => (
        <rect key={x} x={x} y={13} width="10" height="8" rx="2" fill="white" opacity="0.8" />
      ))}
      <rect x="63" y="11" width="11" height="9" rx="2" fill="white" opacity="0.75" />
      <rect x="76" y="21" width="8" height="8" rx="3" fill="#167a7a" />
      <rect x="77" y="16" width="5" height="6" rx="1.5" fill="#FFF9C4" />
      <rect x="2" y="13" width="5" height="15" rx="1" fill="#18a0a0" />
      <rect x="27" y="14" width="22" height="10" rx="2" fill="#0063a5" />
      <text x="38" y="22" textAnchor="middle" fill="white" fontSize="6.5" fontWeight="bold" fontFamily="sans-serif">
        MTA
      </text>
      <Wheel cx={20} cy={37} spin={spin} />
      <Wheel cx={64} cy={37} spin={spin} />
    </svg>
  )
}

// ─── Exported indicator ───────────────────────────────────────────────────────

interface IndicatorProps {
  pullDist: number
  refreshing: boolean
  dragging: boolean
}

export function BusPullIndicator({ pullDist, refreshing, dragging }: IndicatorProps) {
  const progress = Math.min(pullDist / THRESHOLD, 1)
  const atThreshold = pullDist >= THRESHOLD
  const indicatorHeight = refreshing ? THRESHOLD : pullDist
  const transition = dragging ? 'none' : 'height 280ms cubic-bezier(0.4,0,0.2,1)'

  const label = refreshing
    ? 'Fetching buses…'
    : atThreshold
      ? 'Release for fresh arrivals!'
      : 'Pull to refresh'

  return (
    <div
      aria-hidden
      style={{
        height: `${indicatorHeight}px`,
        transition,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: '6px',
        gap: '2px',
      }}
    >
      <div style={{
        opacity: progress,
        transform: `scale(${0.5 + progress * 0.5})`,
        transition: dragging ? 'none' : 'opacity 200ms, transform 200ms',
      }}>
        <BusSVG spin={refreshing} bounce={atThreshold && !refreshing} />
      </div>
      <p style={{
        margin: 0,
        fontSize: '11px',
        fontWeight: 500,
        color: 'rgba(255,255,255,0.8)',
        opacity: progress,
        transition: 'opacity 150ms',
        letterSpacing: '0.01em',
      }}>
        {label}
      </p>
    </div>
  )
}

// ─── Exported hook ────────────────────────────────────────────────────────────

export interface PullState {
  pullDist: number
  refreshing: boolean
  dragging: boolean
}

export function usePullToRefresh(
  scrollRef: RefObject<HTMLElement | null>,
  onRefresh: () => Promise<void> | void,
): PullState {
  const startYRef = useRef(0)
  const activeRef = useRef(false)
  const distRef = useRef(0)

  const [pullDist, setPullDist] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [dragging, setDragging] = useState(false)

  const doRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await onRefresh()
    } finally {
      await new Promise<void>((res) => setTimeout(res, 700))
      setRefreshing(false)
      setPullDist(0)
      distRef.current = 0
    }
  }, [onRefresh])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop > 2) return
      startYRef.current = e.touches[0].clientY
      activeRef.current = true
      setDragging(true)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!activeRef.current) return
      const dy = e.touches[0].clientY - startYRef.current
      if (dy <= 0) { distRef.current = 0; setPullDist(0); return }
      e.preventDefault()
      const dist = MAX_PULL * (1 - Math.exp(-dy / MAX_PULL))
      distRef.current = dist
      setPullDist(dist)
    }

    const finish = () => {
      if (!activeRef.current) return
      activeRef.current = false
      setDragging(false)
      if (distRef.current >= THRESHOLD) {
        doRefresh()
      } else {
        setPullDist(0)
        distRef.current = 0
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', finish, { passive: true })
    el.addEventListener('touchcancel', finish, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', finish)
      el.removeEventListener('touchcancel', finish)
    }
  }, [doRefresh, scrollRef])

  return { pullDist, refreshing, dragging }
}
