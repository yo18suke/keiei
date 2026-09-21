import { useEffect, useState } from 'react'

const KEY = 'rp.opening'

function alreadyPlayed() {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function markPlayed() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* ignore */
  }
}

export function Opening() {
  const [phase, setPhase] = useState<'play' | 'leave' | 'off'>(() =>
    alreadyPlayed() ? 'off' : 'play',
  )

  useEffect(() => {
    if (alreadyPlayed()) {
      setPhase('off')
      return
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const leave = window.setTimeout(() => setPhase('leave'), reduced ? 120 : 1500)
    const off = window.setTimeout(() => {
      markPlayed()
      setPhase('off')
    }, reduced ? 280 : 2000)
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
