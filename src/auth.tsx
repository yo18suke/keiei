import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  clearSession,
  ensureGoogleSso,
  googleClientId,
  loadSession,
  onGoogleCredential,
  promptGoogleSso,
  signIn as googleSignIn,
  signInFromCredential,
  signOut as googleSignOut,
  type AuthUser,
} from './googleAuth'
import { forgetCloudFile } from './cloud'

type AuthStatus = 'idle' | 'ready' | 'working'

type Auth = {
  user: AuthUser | null
  status: AuthStatus
  ready: boolean
  error: string
  signIn: () => Promise<boolean>
  signOut: () => Promise<void>
}

const AuthContext = createContext<Auth | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('idle')
  const [error, setError] = useState('')
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    setStatus('working')
    onGoogleCredential((credential) => {
      setStatus('working')
      setError('')
      void (async () => {
        try {
          const next = await signInFromCredential(credential)
          if (!alive.current) return
          setUser(next)
          setError('')
        } catch (caught) {
          if (!alive.current) return
          const message = caught instanceof Error ? caught.message : 'ログインできませんでした'
          if (message !== 'ログインをキャンセルしました' && message !== 'SILENT_FAIL') setError(message)
        } finally {
          if (alive.current) setStatus('ready')
        }
      })()
    })
    void (async () => {
      const saved = loadSession()
      if (saved && googleClientId()) {
        try {
          const next = await googleSignIn(false)
          if (alive.current) {
            setUser(next)
            setError('')
          }
        } catch {
          if (alive.current) setUser(null)
        }
      }
      try {
        const ok = await ensureGoogleSso()
        if (alive.current && ok && !loadSession()) promptGoogleSso()
      } catch {
        /* 公式ボタンが使えなくても、従来のログインは残す */
      }
      if (alive.current) setStatus('ready')
    })()
    return () => {
      alive.current = false
    }
  }, [])

  const signIn = useCallback(async () => {
    setError('')
    setStatus('working')
    try {
      const next = await googleSignIn(true)
      setUser(next)
      setStatus('ready')
      return true
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'ログインできませんでした'
      if (message !== 'ログインをキャンセルしました' && message !== 'SILENT_FAIL') setError(message)
      setStatus('ready')
      return false
    }
  }, [])

  const signOut = useCallback(async () => {
    setStatus('working')
    await googleSignOut()
    forgetCloudFile()
    clearSession()
    setUser(null)
    setError('')
    setStatus('ready')
  }, [])

  const value = useMemo<Auth>(
    () => ({
      user,
      status,
      ready: status === 'ready',
      error,
      signIn,
      signOut,
    }),
    [error, signIn, signOut, status, user],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider がありません')
  return ctx
}
