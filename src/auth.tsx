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
  connectTasksAccess,
  disconnectTasks,
  ensureGoogleSso,
  getAccessToken,
  getTasksAccessToken,
  googleClientId,
  hasGoogleSession,
  loadSession,
  loadTasksAccounts,
  onGoogleCredential,
  promptGoogleSso,
  signIn as googleSignIn,
  signInFromCredential,
  signOut as googleSignOut,
  type AuthUser,
} from './googleAuth'
import { listTaskLists } from './calendar'
import { forgetCloudFile } from './cloud'

type AuthStatus = 'idle' | 'ready' | 'working'

type Auth = {
  user: AuthUser | null
  tasksUsers: AuthUser[]
  status: AuthStatus
  ready: boolean
  error: string
  driveReady: boolean
  calendarReady: boolean
  signIn: () => Promise<boolean>
  connectDrive: () => Promise<boolean>
  connectCalendar: () => Promise<boolean>
  disconnectCalendar: (email?: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<Auth | null>(null)

function refreshTasksUsers() {
  return loadTasksAccounts()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [tasksUsers, setTasksUsers] = useState<AuthUser[]>([])
  const [status, setStatus] = useState<AuthStatus>('idle')
  const [error, setError] = useState('')
  const [driveReady, setDriveReady] = useState(false)
  const [calendarReady, setCalendarReady] = useState(false)
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
          setDriveReady(hasGoogleSession())
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
      if (saved) {
        if (alive.current) setUser(saved)
        if (googleClientId()) {
          try {
            const next = await googleSignIn(false)
            if (alive.current) {
              setUser(next)
              setDriveReady(hasGoogleSession())
              setError('')
            }
          } catch {
            if (alive.current) setDriveReady(false)
          }
        }
      }
      const savedTasks = refreshTasksUsers()
      if (alive.current) {
        setTasksUsers(savedTasks)
        setCalendarReady(savedTasks.length > 0)
      }
      if (savedTasks.length && googleClientId()) {
        for (const account of savedTasks) {
          try {
            await getTasksAccessToken(account.email, false)
            await listTaskLists(account.email, false)
          } catch {
            /* 保存済みアカウントは残し、必要ならあとでつなぎ直す */
          }
        }
        if (alive.current) {
          const next = refreshTasksUsers()
          setTasksUsers(next)
          setCalendarReady(next.length > 0)
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
      setDriveReady(hasGoogleSession())
      setStatus('ready')
      return true
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'ログインできませんでした'
      if (message !== 'ログインをキャンセルしました' && message !== 'SILENT_FAIL') setError(message)
      setStatus('ready')
      return false
    }
  }, [])

  const connectDrive = useCallback(async () => {
    setError('')
    setStatus('working')
    try {
      await getAccessToken(true)
      setDriveReady(hasGoogleSession())
      setStatus('ready')
      return hasGoogleSession()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'ドライブに接続できませんでした'
      if (message !== 'ログインをキャンセルしました' && message !== 'SILENT_FAIL') setError(message)
      setDriveReady(false)
      setStatus('ready')
      return false
    }
  }, [])

  const connectCalendar = useCallback(async () => {
    setError('')
    setStatus('working')
    try {
      await connectTasksAccess()
      const next = refreshTasksUsers()
      setTasksUsers(next)
      setCalendarReady(next.length > 0)
      setStatus('ready')
      return true
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'タスクに接続できませんでした'
      if (message !== 'ログインをキャンセルしました' && message !== 'SILENT_FAIL') setError(message)
      setCalendarReady(refreshTasksUsers().length > 0)
      setStatus('ready')
      return false
    }
  }, [])

  const disconnectCalendar = useCallback(async (email?: string) => {
    await disconnectTasks(email)
    const next = refreshTasksUsers()
    setTasksUsers(next)
    setCalendarReady(next.length > 0)
  }, [])

  const signOut = useCallback(async () => {
    setStatus('working')
    await googleSignOut()
    forgetCloudFile()
    clearSession()
    setUser(null)
    setTasksUsers([])
    setDriveReady(false)
    setCalendarReady(false)
    setError('')
    setStatus('ready')
  }, [])

  const value = useMemo<Auth>(
    () => ({
      user,
      tasksUsers,
      status,
      ready: status === 'ready',
      error,
      driveReady,
      calendarReady,
      signIn,
      connectDrive,
      connectCalendar,
      disconnectCalendar,
      signOut,
    }),
    [calendarReady, connectCalendar, connectDrive, disconnectCalendar, driveReady, error, signIn, signOut, status, tasksUsers, user],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('AuthProvider がありません')
  return ctx
}
