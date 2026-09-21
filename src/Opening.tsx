import { useEffect, useState } from 'react'

export function Opening() {
  const [phase, setPhase] = useState<'play' | 'leave' | 'off'>('play')

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const leaveAt = reduced ? 120 : 1500
    const offAt = reduced ? 280 : 2000
    const leave = window.setTimeout(() => setPhase('leave'), leaveAt)
    const off = window.setTimeout(() => setPhase('off'), offAt)
    return () => {
      window.clearTimeout(leave)
      window.clearTimeout(off)
    }
  }, [])

  if (phase === 'off') return null

  return (
    <div className={phase === 'leave' ? 'opening leave' : 'opening'} role="status">
      <div className="opening-mark" aria-hidden>
        <i className="opening-dot coral" />
        <i className="opening-dot indigo" />
        <i className="opening-dot green" />
        <i className="opening-dot gold" />
      </div>
      <p className="opening-name">リフレクションパレット</p>
      <p className="opening-tag">日々の振り返り</p>
    </div>
  )
}
