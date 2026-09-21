import { useEffect, useRef, useState } from 'react'
import { useAuth } from './auth'
import {
  ensureGoogleSso,
  googleClientId,
  renderGoogleSignInButton,
} from './googleAuth'
import { Button } from './ui'

export function GoogleSignInButton({
  onSignedIn,
}: {
  onSignedIn?: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const { user, status, signIn, error } = useAuth()
  const [fallback, setFallback] = useState(false)
  const seenUser = useRef(Boolean(user))
  const working = status === 'working'

  useEffect(() => {
    if (user && !seenUser.current) onSignedIn?.()
    seenUser.current = Boolean(user)
  }, [onSignedIn, user])

  useEffect(() => {
    const el = host.current
    if (!el || user) return
    let alive = true
    const timer = window.setTimeout(() => {
      if (alive && el.childElementCount === 0) setFallback(true)
    }, 2500)
    void (async () => {
      try {
        const ok = await ensureGoogleSso()
        if (!alive || !ok) {
          if (alive) setFallback(true)
          return
        }
        const width = el.getBoundingClientRect().width || 320
        if (!renderGoogleSignInButton(el, width) && alive) setFallback(true)
      } catch {
        if (alive) setFallback(true)
      }
    })()
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [user])

  if (user) return null
  if (!googleClientId()) return null

  return (
    <div className="google-signin">
      <div ref={host} className="google-signin-slot" hidden={fallback} />
      {fallback ? (
        <Button variant="primary" disabled={working} onClick={() => void signIn().then((ok) => ok && onSignedIn?.())}>
          {working ? '接続しています…' : 'Googleで続ける'}
        </Button>
      ) : null}
      {error ? <p className="account-error">{error}</p> : null}
    </div>
  )
}
