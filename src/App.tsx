import { useEffect, useState } from 'react'
import { HistoryPage } from './HistoryPage'
import { Opening } from './Opening'
import { OrganizePage } from './OrganizePage'
import { ReviewPage } from './ReviewPage'
import { StoreProvider } from './store'
import { TodayPage } from './TodayPage'
import { dateParts, todayISO } from './dates'

const PAGES = ['today', 'review', 'history', 'organize'] as const
type Page = (typeof PAGES)[number]

const LABELS: Record<Page, string> = {
  today: '今日',
  review: 'まとめ',
  history: '履歴',
  organize: '整理',
}

function parseHash(): { page: Page; date: string } {
  const h = window.location.hash.replace(/^#\/?/, '')
  const todayMatch = h.match(/^today\/(\d{4}-\d{2}-\d{2})$/)
  if (todayMatch) return { page: 'today', date: todayMatch[1] }
  if (h === 'history' || h === 'review' || h === 'organize') return { page: h, date: todayISO() }
  return { page: 'today', date: todayISO() }
}

function Shell() {
  const [{ page, date }, setRoute] = useState(parseHash)
  const today = dateParts(todayISO())

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [])

  function go(next: Page, nextDate = todayISO()) {
    const url =
      next === 'today' && nextDate !== todayISO() ? `#today/${nextDate}` : `#${next}`
    setRoute({ page: next, date: next === 'today' ? nextDate : todayISO() })
    if (window.location.hash !== url) {
      window.history.pushState(null, '', url)
    }
  }

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          <img className="logo" src="/logo.svg" width="32" height="32" alt="" />
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
        <p className="rail-date">
          {today.month}/{today.day}
          <span> {today.weekday}</span>
        </p>
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
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Opening />
      <Shell />
    </StoreProvider>
  )
}
