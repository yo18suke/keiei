import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { todayISO, weekDates, weekStart } from './dates'
import { useStore } from './store'
import { TaskCard } from './TaskCard'
import { caseTaskStats } from './todos'
import { asCaseColor, asTaskLane, CASE_COLORS, nextCaseColor, type TaskLane, type TaskRepeat, type WorkCase, type WorkTask } from './types'
import { Button } from './ui'

const LANES: { id: TaskLane; label: string }[] = [
  { id: 'open', label: '未完了' },
  { id: 'progress', label: '進捗中' },
  { id: 'done', label: '完了' },
]

function cycleCaseColor(current: string) {
  const i = CASE_COLORS.indexOf(asCaseColor(current) as (typeof CASE_COLORS)[number])
  return CASE_COLORS[(i + 1) % CASE_COLORS.length]
}

export function CasesPage() {
  const {
    state,
    addCase,
    renameCase,
    setCaseColor,
    completeCase,
    reopenCase,
    removeCase,
    addTask,
    renameTask,
    moveTask,
    scheduleTask,
    setTaskRepeat,
    removeTask,
  } = useStore()
  const [showDone, setShowDone] = useState(false)
  const [filterId, setFilterId] = useState('')
  const [caseName, setCaseName] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overLane, setOverLane] = useState<TaskLane | null>(null)

  const lanes = showDone ? LANES : LANES.filter((lane) => lane.id !== 'done')
  const cases = state.cases ?? []
  const visibleCases = showDone ? cases : cases.filter((row) => !row.doneAt)
  const tasks = state.tasks ?? []
  const caseOf = (id: string) => cases.find((row) => row.id === id)
  const weekDays = weekDates(weekStart(todayISO()))
  const colorForNew = nextCaseColor(cases)
  const openCase = openId ? caseOf(openId) : undefined
  const filterCase = filterId && visibleCases.some((row) => row.id === filterId) ? caseOf(filterId) : undefined
  const filterStats = filterCase ? caseTaskStats(tasks, filterCase.id) : undefined
  const scoped = filterCase ? tasks.filter((task) => task.caseId === filterCase.id) : tasks

  function tasksIn(lane: TaskLane) {
    return scoped.filter((task) => asTaskLane(task.lane) === lane)
  }

  function pickCase(id: string) {
    setFilterId((current) => (current === id ? '' : id))
  }

  function submitCase() {
    addCase(caseName, colorForNew)
    setCaseName('')
  }

  return (
    <div className="page page-work">
      <div className="page-head">
        <div>
          <p className="kicker">進捗を見る</p>
          <h1>Work</h1>
          <p className="muted">案件を選ぶと、その進みだけが見える。タイルを開いて作業を足す。</p>
        </div>
        <div className="page-head-side">
          <a className="page-head-link" href="#organize">
            TODOへ
          </a>
          <div className="filter-tabs" role="group" aria-label="完了の表示">
            <button
              type="button"
              className={showDone ? 'filter-tab' : 'filter-tab on'}
              aria-pressed={!showDone}
              onClick={() => setShowDone(false)}
            >
              完了を隠す
            </button>
            <button
              type="button"
              className={showDone ? 'filter-tab on' : 'filter-tab'}
              aria-pressed={showDone}
              onClick={() => setShowDone(true)}
            >
              完了を表示
            </button>
          </div>
        </div>
      </div>

      <ul className="case-tiles">
        {visibleCases.map((row) => {
          const color = asCaseColor(row.color)
          const stats = caseTaskStats(tasks, row.id)
          return (
            <li key={row.id}>
              <button
                type="button"
                className={[row.doneAt ? 'case-tile done' : 'case-tile', filterCase?.id === row.id ? 'on' : '']
                  .filter(Boolean)
                  .join(' ')}
                style={{ '--case': color } as CSSProperties}
                onClick={() => {
                  setFilterId(row.id)
                  setOpenId(row.id)
                }}
              >
                <span className="case-tile-bar" style={{ background: color }} aria-hidden />
                <span className="case-tile-body">
                  <strong>{row.name}</strong>
                  {stats.total === 0 ? (
                    <span className="muted">作業はまだない。開いて足す。</span>
                  ) : (
                    <span className="muted">
                      {stats.done}/{stats.total} 完了 · {stats.percent}%
                    </span>
                  )}
                  <span className="case-tile-meter" aria-hidden>
                    <i style={{ width: `${stats.percent}%`, background: color }} />
                  </span>
                  <span className="case-tile-meta">
                    未完了 {stats.open} · 進捗中 {stats.progress}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
        <li>
          <form
            className="case-tile case-tile-new"
            onSubmit={(event) => {
              event.preventDefault()
              submitCase()
            }}
          >
            <span className="case-tile-bar" style={{ background: colorForNew }} aria-hidden />
            <span className="case-tile-body">
              <strong>新しい案件</strong>
              <input
                value={caseName}
                placeholder="案件名"
                aria-label="新しい案件名"
                onChange={(event) => setCaseName(event.target.value)}
              />
              <Button type="submit" variant="primary">
                追加
              </Button>
            </span>
          </form>
        </li>
      </ul>

      {visibleCases.length === 0 && cases.length > 0 ? (
        <p className="muted">完了した案件は「完了を表示」で見られます。</p>
      ) : null}

      {visibleCases.length > 0 ? (
        <div className="case-filter" role="tablist" aria-label="案件で絞る">
          <button
            type="button"
            role="tab"
            aria-selected={!filterId}
            className={filterCase ? 'case-chip' : 'case-chip on'}
            onClick={() => setFilterId('')}
          >
            すべて
          </button>
          {visibleCases.map((row) => {
            const color = asCaseColor(row.color)
            const stats = caseTaskStats(tasks, row.id)
            const on = filterCase?.id === row.id
            return (
              <button
                key={row.id}
                type="button"
                role="tab"
                aria-selected={on}
                className={on ? 'case-chip on' : 'case-chip'}
                style={{ '--case': color } as CSSProperties}
                onClick={() => pickCase(row.id)}
              >
                <i aria-hidden />
                <span>{row.name}</span>
                {stats.total ? <span className="muted">{stats.percent}%</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}

      {filterCase && filterStats ? (
        <p className="case-filter-status">
          <strong>{filterCase.name}</strong>
          <span className="muted">
            {' '}
            未完了 {filterStats.open} · 進捗中 {filterStats.progress}
            {filterStats.total ? ` · ${filterStats.percent}%` : ''}
          </span>
        </p>
      ) : null}

      <div className="board" style={{ '--lane-count': lanes.length } as CSSProperties}>
        {lanes.map((lane) => {
          const items = tasksIn(lane.id)
          return (
            <section
              key={lane.id}
              className={`lane lane-${lane.id}${overLane === lane.id ? ' over' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                setOverLane(lane.id)
              }}
              onDragLeave={() => {
                if (overLane === lane.id) setOverLane(null)
              }}
              onDrop={(event) => {
                event.preventDefault()
                const id = event.dataTransfer.getData('text/plain') || dragId
                if (id) moveTask(id, lane.id)
                setDragId(null)
                setOverLane(null)
              }}
            >
              <header className="lane-head">
                <h2>{lane.label}</h2>
                <p>{items.length}</p>
              </header>
              {items.length === 0 ? (
                <p className="muted lane-empty">
                  {lane.id === 'progress'
                    ? '今手を付けている作業を置く。'
                    : lane.id === 'open'
                      ? 'まだ終わっていない作業を置く。'
                      : '完了した作業はここに溜まる。'}
                </p>
              ) : (
                <ul className="lane-cards">
                  {items.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      caseName={caseOf(task.caseId)?.name ?? '案件なし'}
                      color={asCaseColor(caseOf(task.caseId)?.color)}
                      scheduledOn={task.scheduledOn}
                      weekDays={weekDays}
                      dragging={dragId === task.id}
                      onRename={(title) => renameTask(task.id, title)}
                      onMove={(next) => moveTask(task.id, next)}
                      onSchedule={(next) => scheduleTask(task.id, next)}
                      onRepeat={(next) => setTaskRepeat(task.id, next)}
                      onRemove={() => removeTask(task.id)}
                      onDragStart={() => setDragId(task.id)}
                      onDragEnd={() => {
                        setDragId(null)
                        setOverLane(null)
                      }}
                    />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>

      {openCase ? (
        <CaseModal
          row={openCase}
          tasks={tasks.filter((task) => task.caseId === openCase.id)}
          weekDays={weekDays}
          onClose={() => setOpenId(null)}
          onRename={(name) => renameCase(openCase.id, name)}
          onColor={(color) => setCaseColor(openCase.id, color)}
          onComplete={() => completeCase(openCase.id)}
          onReopen={() => reopenCase(openCase.id)}
          onDelete={() => {
            if (filterId === openCase.id) setFilterId('')
            removeCase(openCase.id)
            setOpenId(null)
          }}
          onAdd={(title) => addTask(openCase.id, title, 'open')}
          onRenameTask={(id, title) => renameTask(id, title)}
          onMove={(id, lane) => moveTask(id, lane)}
          onSchedule={(id, date) => scheduleTask(id, date)}
          onRepeat={(id, repeat) => setTaskRepeat(id, repeat)}
          onRemove={(id) => removeTask(id)}
        />
      ) : null}
    </div>
  )
}

function CaseModal({
  row,
  tasks,
  weekDays,
  onClose,
  onRename,
  onColor,
  onComplete,
  onReopen,
  onDelete,
  onAdd,
  onRenameTask,
  onMove,
  onSchedule,
  onRepeat,
  onRemove,
}: {
  row: WorkCase
  tasks: WorkTask[]
  weekDays: string[]
  onClose: () => void
  onRename: (name: string) => void
  onColor: (color: string) => void
  onComplete: () => void
  onReopen: () => void
  onDelete: () => void
  onAdd: (title: string) => void
  onRenameTask: (id: string, title: string) => void
  onMove: (id: string, lane: TaskLane) => void
  onSchedule: (id: string, date: string) => void
  onRepeat: (id: string, repeat: TaskRepeat | undefined) => void
  onRemove: (id: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [askDelete, setAskDelete] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const color = asCaseColor(row.color)
  const stats = caseTaskStats(tasks, row.id)
  const done = Boolean(row.doneAt)

  useEffect(() => {
    setAskDelete(false)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const add = dialog.current?.querySelector<HTMLInputElement>('input[aria-label$="作業を追加"]')
    ;(add ?? dialog.current?.querySelector<HTMLInputElement>('input[aria-label="案件名"]'))?.focus()
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [row.id])

  return (
    <div className="modal-back" onClick={onClose}>
      <div
        ref={dialog}
        className="modal case-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="case-modal-head">
          <div className="case-modal-title">
            <button
              type="button"
              className="case-swatch"
              style={{ background: color }}
              aria-label="案件の色を変える"
              onClick={() => onColor(cycleCaseColor(color))}
            />
            <input
              id="case-modal-title"
              className="case-name"
              defaultValue={row.name}
              key={row.name}
              aria-label="案件名"
              onBlur={(event) => onRename(event.target.value)}
            />
          </div>
          <div className="case-modal-actions">
            {askDelete ? (
              <>
                <Button
                  variant="primary"
                  onClick={() => {
                    onDelete()
                  }}
                >
                  削除する
                </Button>
                <Button variant="quiet" onClick={() => setAskDelete(false)}>
                  やめる
                </Button>
              </>
            ) : (
              <>
                {done ? (
                  <Button variant="quiet" onClick={onReopen}>
                    戻す
                  </Button>
                ) : (
                  <Button variant="quiet" onClick={onComplete}>
                    完了
                  </Button>
                )}
                <Button variant="quiet" onClick={() => setAskDelete(true)}>
                  削除
                </Button>
                <Button variant="quiet" onClick={onClose}>
                  閉じる
                </Button>
              </>
            )}
          </div>
        </header>
        <p className="muted">
          {askDelete
            ? 'この案件と、中の作業を消します。'
            : stats.total === 0
              ? '作業を足すと、ここに並びます。'
              : `${stats.done}/${stats.total} 完了 · 未完了 ${stats.open} · 進捗中 ${stats.progress}`}
        </p>
        {done ? null : (
          <form
            className="case-add"
            onSubmit={(event) => {
              event.preventDefault()
              onAdd(draft)
              setDraft('')
            }}
          >
            <input
              value={draft}
              placeholder="作業を追加"
              aria-label={`${row.name}に作業を追加`}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="submit" variant="primary">
              追加
            </Button>
          </form>
        )}
        {tasks.length === 0 ? null : (
          <ul className="lane-cards case-modal-tasks">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                caseName={row.name}
                color={color}
                scheduledOn={task.scheduledOn}
                weekDays={weekDays}
                dragging={dragId === task.id}
                onRename={(title) => onRenameTask(task.id, title)}
                onMove={(lane) => onMove(task.id, lane)}
                onSchedule={(date) => onSchedule(task.id, date)}
                onRepeat={(repeat) => onRepeat(task.id, repeat)}
                onRemove={() => onRemove(task.id)}
                onDragStart={() => setDragId(task.id)}
                onDragEnd={() => setDragId(null)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
