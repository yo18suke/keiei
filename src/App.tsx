import { useEffect, useState } from 'react'
import { AccountPage } from './AccountPage'
import { HistoryPage } from './HistoryPage'
import { LandingPage } from './LandingPage'
import { Opening } from './Opening'
import { CasesPage } from './CasesPage'
import { OrganizePage } from './OrganizePage'
import { ReviewPage } from './ReviewPage'
import { AuthProvider, useAuth } from './auth'
import { StoreProvider, useStore } from './store'
import { TodayPage } from './TodayPage'
import { asset } from './assets'
import { dateParts, todayISO } from './dates'
import { Button } from './ui'

type AppPage = 'today' | 'review' | 'history' | 'organize' | 'work'
type Page = AppPage | 'landing' | 'account'

const LABELS: Record<AppPage, string> = {
  today: '今日',
  review: 'まとめ',
  history: '履歴',
  organize: 'TODO',
  work: 'Work',
}

const MAIN_PAGES = ['organize', 'work'] as const
const REFLECT_PAGES = ['today', 'review', 'history'] as const
const MOBILE_PAGES = ['today', 'review', 'history', 'organize', 'work'] as const


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
  if (h === 'cases' || h === 'projects') return { page: 'work', date: todayISO() }
  if (h === 'today' || h === 'history' || h === 'review' || h === 'organize' || h === 'work') {
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
  const { user, signOut, driveReady, connectDrive, error } = useAuth()
  const { syncStatus, flushCloud } = useStore()
  const reflecting = page === 'today' || page === 'review' || page === 'history'
  const [reflectOpen, setReflectOpen] = useState(reflecting)

  useEffect(() => {
    setReflectOpen(reflecting)
  }, [reflecting])

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
            <button type="button" className="logo-btn" onClick={goAccount} aria-label="アカウント">
              <img className="logo" src={asset('logo.svg')} width="32" height="32" alt="" />
            </button>
            <div className="brand-copy">
              <p className="wordmark">リフレクションパレット</p>
              <p className="tag">日々の振り返り</p>
            </div>
          </div>
          <nav className="nav nav-desktop" aria-label="主要">
            {MAIN_PAGES.map((p) => (
              <a
                key={p}
                href={`#${p}`}
                className={page === p ? 'nav-link on' : 'nav-link'}
                onClick={(e) => {
                  e.preventDefault()
                  go(p)
                }}
              >
                <i className={`nav-dot ${p}`} aria-hidden />
                {LABELS[p]}
              </a>
            ))}
            <div className="nav-group">
              <button
                type="button"
                className={`nav-link nav-parent${reflectOpen ? ' open' : ''}${reflecting ? ' current' : ''}`}
                aria-expanded={reflectOpen}
                aria-controls="nav-reflect"
                onClick={() => setReflectOpen((next) => !next)}
              >
                <i className="nav-dot reflect" aria-hidden />
                リフレクション
              </button>
              {reflectOpen ? (
                <div id="nav-reflect" className="nav-sub">
                  {REFLECT_PAGES.map((p) => (
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
                </div>
              ) : null}
            </div>
          </nav>
          <nav className="nav nav-mobile" aria-label="主要">
            {MOBILE_PAGES.map((p) => (
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
                <p className="muted">
                  {driveReady ? SYNC_LABEL[syncStatus] : 'この端末（未同期）'}
                </p>
                {driveReady ? null : (
                  <Button variant="quiet" onClick={() => void connectDrive()}>
                    ドライブとつなぐ
                  </Button>
                )}
                {error ? <p className="account-error">{error}</p> : null}
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
                ログイン
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
            {page === 'work' ? <CasesPage /> : null}
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
