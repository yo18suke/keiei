import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearSession,
  googleClientId,
  loadSession,
  signIn as googleSignIn,
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

  useEffect(() => {
    let cancelled = false
    setStatus('working')
    void (async () => {
      const saved = loadSession()
      if (saved && googleClientId()) {
        try {
          const next = await googleSignIn(false)
          if (!cancelled) {
            setUser(next)
            setError('')
          }
        } catch {
          if (!cancelled) setUser(null)
        }
      }
      if (!cancelled) setStatus('ready')
    })()
    return () => {
      cancelled = true
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
