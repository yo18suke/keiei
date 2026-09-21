import { useEffect, useState } from 'react'
import { AccountPage } from './AccountPage'
import { HistoryPage } from './HistoryPage'
import { LandingPage } from './LandingPage'
import { Opening } from './Opening'
import { OrganizePage } from './OrganizePage'
import { ReviewPage } from './ReviewPage'
import { AuthProvider, useAuth } from './auth'
import { StoreProvider, useStore } from './store'
import { TodayPage } from './TodayPage'
import { asset } from './assets'
import { dateParts, todayISO } from './dates'
import { Button } from './ui'

const PAGES = ['today', 'review', 'history', 'organize'] as const
type AppPage = (typeof PAGES)[number]
type Page = AppPage | 'landing' | 'account'

const LABELS: Record<AppPage, string> = {
  today: '今日',
  review: 'まとめ',
  history: '履歴',
  organize: '整理',
}

const SYNC_LABEL = {
  local: 'この端末',
  saving: '同期しています',
  saved: '同期済み',
  error: '同期できませんでした',
} as const

function parseHash(): { page: Page; date: string } {
  const h = window.location.hash.replace(/^#\/?/, '')
  const todayMatch = h.match(/^today\/(\d{4}-\d{2}-\d{2})$/)
  if (todayMatch) return { page: 'today', date: todayMatch[1] }
  if (h === 'today' || h === 'history' || h === 'review' || h === 'organize') {
    return { page: h, date: todayISO() }
  }
  if (h === 'login' || h === 'register' || h === 'account') {
    return { page: 'account', date: todayISO() }
  }
  return { page: 'landing', date: todayISO() }
}

function AppShell() {
  const [{ page, date }, setRoute] = useState(parseHash)
  const today = dateParts(todayISO())
  const { user, signOut } = useAuth()
  const { syncStatus, flushCloud } = useStore()

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [])

  function go(next: AppPage, nextDate = todayISO()) {
    const url =
      next === 'today' && nextDate !== todayISO() ? `#today/${nextDate}` : `#${next}`
    setRoute({ page: next, date: next === 'today' ? nextDate : todayISO() })
    if (window.location.hash !== url) {
      window.history.pushState(null, '', url)
    }
  }

  function goLanding() {
    setRoute({ page: 'landing', date: todayISO() })
    if (window.location.hash) window.history.pushState(null, '', window.location.pathname + window.location.search)
  }

  function goAccount() {
    setRoute({ page: 'account', date: todayISO() })
    if (window.location.hash !== '#login') window.history.pushState(null, '', '#login')
  }

  if (page === 'landing') {
    return <LandingPage onStart={() => go('today')} onAccount={goAccount} />
  }

  if (page === 'account') {
    return <AccountPage onEnter={() => go('today')} onBack={goLanding} />
  }

  return (
    <>
      <Opening />
      <div className="app">
        <aside className="rail">
          <div className="brand">
            <img className="logo" src={asset('logo.svg')} width="32" height="32" alt="" />
            <div>
              <p className="wordmark">リフレクションパレット</p>
              <p className="tag">日々の振り返り</p>
            </div>
          </div>
          <nav className="nav" aria-label="主要">
            {PAGES.map((p) => (
              <a
                key={p}
                href={`#${p}`}
                className={page === p ? 'nav-link on' : 'nav-link'}
                onClick={(e) => {
                  e.preventDefault()
                  go(p, p === 'today' ? todayISO() : date)
                }}
              >
                <i className={`nav-dot ${p}`} aria-hidden />
                {LABELS[p]}
              </a>
            ))}
          </nav>
          <div className="rail-foot">
            <p className="rail-date">
              {today.month}/{today.day}
              <span> {today.weekday}</span>
            </p>
            {user ? (
              <div className="rail-account">
                <p className="rail-account-email">{user.email}</p>
                <p className="muted">{SYNC_LABEL[syncStatus]}</p>
                <Button
                  variant="quiet"
                  onClick={async () => {
                    await flushCloud()
                    await signOut()
                  }}
                >
                  ログアウト
                </Button>
              </div>
            ) : (
              <Button variant="quiet" onClick={goAccount}>
                登録・ログイン
              </Button>
            )}
          </div>
        </aside>

        <div className="canvas">
          <main>
            {page === 'today' ? (
              <TodayPage date={date} onDate={(d) => go('today', d)} onOrganize={() => go('organize')} />
            ) : null}
            {page === 'review' ? <ReviewPage onOpenDay={(d) => go('today', d)} /> : null}
            {page === 'history' ? <HistoryPage onOpenDay={(d) => go('today', d)} /> : null}
            {page === 'organize' ? <OrganizePage /> : null}
          </main>
        </div>
      </div>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <AppShell />
      </StoreProvider>
    </AuthProvider>
  )
}
