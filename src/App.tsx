import { useEffect, useState } from 'react'
import { GoalStrip } from './GoalStrip'
import { GoalsPage } from './GoalsPage'
import { HistoryPage } from './HistoryPage'
import { StoreProvider } from './store'
import { TodayPage } from './TodayPage'
import { WeekPage } from './WeekPage'
import { dateParts, todayISO } from './dates'

const PAGES = ['today', 'week', 'goals', 'history'] as const
type Page = (typeof PAGES)[number]

const LABELS: Record<Page, string> = {
  today: '今日',
  week: '今週',
  goals: '目標',
  history: '履歴',
}

function parsePage(): Page {
  const h = window.location.hash.replace(/^#\/?/, '')
  if (h === 'week' || h === 'goals' || h === 'history') return h
  return 'today'
}

function Shell() {
  const [page, setPage] = useState<Page>(parsePage)
  const today = dateParts(todayISO())

  useEffect(() => {
    const onHash = () => setPage(parsePage())
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [])

  function go(next: Page) {
    setPage(next)
    const url = `#${next}`
    if (window.location.hash !== url) {
      window.history.pushState(null, '', url)
    }
  }

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          <p className="wordmark">確認</p>
          <p className="tag">経営のリズム</p>
        </div>
        <nav className="nav" aria-label="主要">
          {PAGES.map((p) => (
            <a
              key={p}
              href={`#${p}`}
              className={page === p ? 'nav-link on' : 'nav-link'}
              onClick={(e) => {
                e.preventDefault()
                go(p)
              }}
            >
              {LABELS[p]}
            </a>
          ))}
        </nav>
        {page === 'goals' ? null : <GoalStrip onGoals={() => go('goals')} />}
        <p className="rail-date">
          {today.month}/{today.day}
          <span> {today.weekday}</span>
        </p>
      </aside>

      <div className="canvas">
        <main>
          {page === 'today' ? (
            <TodayPage onWeek={() => go('week')} onGoals={() => go('goals')} />
          ) : null}
          {page === 'week' ? <WeekPage /> : null}
          {page === 'goals' ? <GoalsPage /> : null}
          {page === 'history' ? <HistoryPage /> : null}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
