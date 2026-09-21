import { useEffect, useRef, useState } from 'react'
import { addDays, dateParts, todayISO, weekDates, weekStart } from './dates'
import { useStore } from './store'
import { asTaskLane } from './types'
import { dayTodoStats, openOn, tasksPlacedOn } from './todos'
import { Button } from './ui'

type BoardView = 'week' | 'day'
const VIEW_KEY = 'keiei.boardView'

function loadView(): BoardView {
  try {
    const saved = localStorage.getItem(VIEW_KEY)
    if (saved === 'week' || saved === 'day') return saved
  } catch {
    /* ignore */
  }
  return window.matchMedia('(max-width: 840px)').matches ? 'day' : 'week'
}

function saveView(view: BoardView) {
  try {
    localStorage.setItem(VIEW_KEY, view)
  } catch {
    /* ignore */
  }
}

function Ring({ percent }: { percent: number }) {
  const p = Math.min(100, Math.max(0, percent))
  return (
    <div className="todo-ring" aria-label={`達成率 ${p}%`}>
      <svg viewBox="0 0 36 36">
        <circle className="todo-ring-track" cx="18" cy="18" r="14" />
        <circle
          className="todo-ring-value"
          cx="18"
          cy="18"
          r="14"
          pathLength="100"
          strokeDasharray={`${p} 100`}
        />
      </svg>
      <span>{p}%</span>
    </div>
  )
}

export function WeekBoard() {
  const today = todayISO()
  const { state, addTask, toggleTaskDone, carryTasks, renameTask } = useStore()
  const [week, setWeek] = useState(() => weekStart(today))
  const [view, setView] = useState<BoardView>(loadView)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [caseId, setCaseId] = useState('')
  const cases = (state.cases ?? []).filter((row) => !row.doneAt)
  const tasks = state.tasks ?? []
  const thisWeek = weekStart(today)
  const dates = weekDates(week)
  const pickCase = caseId && cases.some((row) => row.id === caseId) ? caseId : cases[0]?.id ?? ''
  const boardRef = useRef<HTMLDivElement>(null)
  const colRefs = useRef<Record<string, HTMLElement | null>>({})
  const [focus, setFocus] = useState(() => (dates.includes(today) ? today : dates[0]))
  const visible = view === 'day' ? dates.filter((date) => date === focus) : dates
  const focusParts = dateParts(focus)

  function changeView(next: BoardView) {
    setView(next)
    saveView(next)
    if (next === 'day') {
      const day = dates.includes(today) ? today : dates.includes(focus) ? focus : dates[0]
      setFocus(day)
    }
  }

  function showDay(date: string) {
    setFocus(date)
    setWeek(weekStart(date))
    if (view === 'week') {
      const board = boardRef.current
      const col = colRefs.current[date]
      if (!board || !col) return
      board.scrollTo({ left: col.offsetLeft - board.offsetLeft, behavior: 'smooth' })
    }
  }

  function shiftFocus(days: number) {
    showDay(addDays(focus, days))
  }

  useEffect(() => {
    if (view !== 'week') return
    const nextDates = weekDates(week)
    const next = nextDates.includes(today) ? today : nextDates.includes(focus) ? focus : nextDates[0]
    setFocus(next)
    const frame = window.requestAnimationFrame(() => {
      const board = boardRef.current
      const col = colRefs.current[next]
      if (!board || !col) return
      board.scrollTo({ left: col.offsetLeft - board.offsetLeft })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [week, today, view])

  return (
    <section className={`week-board-wrap view-${view}`}>
      <header className="section-head">
        <p className="kicker">今週のやること</p>
        <div className="section-title-row week-board-title">
          <h2>
            {view === 'day'
              ? `${focusParts.month}/${focusParts.day}（${focusParts.weekday}）`
              : `${dateParts(week).month}/${dateParts(week).day} – ${dateParts(addDays(week, 6)).month}/${dateParts(addDays(week, 6)).day}`}
          </h2>
          <div className="filter-tabs" role="tablist" aria-label="表示">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'week'}
              className={view === 'week' ? 'filter-tab on' : 'filter-tab'}
              onClick={() => changeView('week')}
            >
              週
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'day'}
              className={view === 'day' ? 'filter-tab on' : 'filter-tab'}
              onClick={() => changeView('day')}
            >
              日
            </button>
          </div>
          <div className="date-nav">
            {view === 'day' ? (
              <>
                <Button variant="quiet" onClick={() => shiftFocus(-1)}>
                  前の日
                </Button>
                {focus === today ? null : (
                  <Button variant="quiet" onClick={() => showDay(today)}>
                    今日へ
                  </Button>
                )}
                <Button variant="quiet" onClick={() => shiftFocus(1)}>
                  次の日
                </Button>
              </>
            ) : (
              <>
                <Button variant="quiet" onClick={() => setWeek(addDays(week, -7))}>
                  前の週
                </Button>
                {week === thisWeek ? null : (
                  <Button variant="quiet" onClick={() => setWeek(thisWeek)}>
                    今週へ
                  </Button>
                )}
                <Button variant="quiet" onClick={() => setWeek(addDays(week, 7))}>
                  次の週
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      {cases.length === 0 ? (
        <p className="muted">先に下の案件を足すと、曜日にやることが置けます。</p>
      ) : null}
      <div className="week-board-days" role="tablist" aria-label="曜日">
        {dates.map((date) => {
          const parts = dateParts(date)
          return (
            <button
              key={date}
              type="button"
              role="tab"
              aria-selected={date === focus}
              className={date === focus ? 'week-board-day on' : 'week-board-day'}
              onClick={() => showDay(date)}
            >
              {parts.weekday}
              <span>
                {parts.month}/{parts.day}
              </span>
            </button>
          )
        })}
      </div>
      <div className="week-board" ref={boardRef}>
        {visible.map((date) => {
          const parts = dateParts(date)
          const stats = dayTodoStats(tasks, date)
          const placed = tasksPlacedOn(tasks, date)
          const leftover = openOn(tasks, date)
          const isToday = date === today
          return (
            <section
              key={date}
              ref={(node) => {
                colRefs.current[date] = node
              }}
              data-date={date}
              className={isToday ? 'week-col today' : 'week-col'}
            >
              <header className="week-col-head">
                <p>{parts.weekday}</p>
                <p>
                  {parts.month}/{parts.day}
                </p>
              </header>
              <div className="week-col-body">
                <Ring percent={stats.percent} />
                <p className="week-col-label">やること</p>
                <ul className="week-todos">
                  {placed.map((task) => {
                    const done = asTaskLane(task.lane) === 'done'
                    return (
                      <li key={task.id} className={done ? 'week-todo done' : 'week-todo'}>
                        <input
                          type="checkbox"
                          checked={done}
                          aria-label={`${task.title}を完了`}
                          onChange={() => toggleTaskDone(task.id, date)}
                        />
                        <input
                          className="input-inline"
                          defaultValue={task.title}
                          key={task.title}
                          aria-label="やること"
                          onBlur={(event) => renameTask(task.id, event.target.value)}
                        />
                      </li>
                    )
                  })}
                </ul>
                <form
                  className="week-add"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!pickCase) return
                    addTask(pickCase, drafts[date] ?? '', 'open', date)
                    setDrafts((prev) => ({ ...prev, [date]: '' }))
                  }}
                >
                  {cases.length > 1 ? (
                    <select
                      value={pickCase}
                      aria-label="案件"
                      onChange={(event) => setCaseId(event.target.value)}
                    >
                      {cases.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    value={drafts[date] ?? ''}
                    placeholder="追加"
                    aria-label={`${parts.weekday}のやることを足す`}
                    disabled={!pickCase}
                    onChange={(event) => setDrafts((prev) => ({ ...prev, [date]: event.target.value }))}
                  />
                </form>
                {leftover.length > 0 ? (
                  <Button variant="quiet" onClick={() => carryTasks(date)}>
                    未完了を翌日へ
                  </Button>
                ) : null}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}

export function DayTodos({ date, onOrganize }: { date: string; onOrganize?: () => void }) {
  const { state, toggleTaskDone, carryTasks } = useStore()
  const tasks = state.tasks ?? []
  const cases = state.cases ?? []
  const placed = tasksPlacedOn(tasks, date)
  const yesterday = addDays(date, -1)
  const leftover = openOn(tasks, yesterday)
  const stats = dayTodoStats(tasks, date)

  return (
    <section className="section section-panel tone-green">
      <header className="section-head">
        <p className="kicker">やること</p>
        <div className="section-title-row">
          <h2>この日のTODO</h2>
          {stats.total ? <p className="muted">{stats.percent}%</p> : null}
        </div>
      </header>
      {leftover.length > 0 ? (
        <button type="button" className="banner banner-link" onClick={() => carryTasks(yesterday)}>
          前日の未完了が{leftover.length}件あります。この日へ移す。
        </button>
      ) : null}
      {placed.length === 0 ? (
        <p className="muted">この日に置いたTODOはない。TODOの週ボードから曜日へ置けます。</p>
      ) : (
        <ul className="week-todos day-todos">
          {placed.map((task) => {
            const done = asTaskLane(task.lane) === 'done'
            const caseName = cases.find((row) => row.id === task.caseId)?.name
            return (
              <li key={task.id} className={done ? 'week-todo done' : 'week-todo'}>
                <input
                  type="checkbox"
                  checked={done}
                  aria-label={`${task.title}を完了`}
                  onChange={() => toggleTaskDone(task.id, date)}
                />
                <div>
                  {caseName ? <p className="kicker">{caseName}</p> : null}
                  <p>{task.title}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {onOrganize ? (
        <div className="row-actions">
          <Button variant="quiet" onClick={onOrganize}>
            TODOを開く
          </Button>
        </div>
      ) : null}
    </section>
  )
}
