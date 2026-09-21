import { useState, type CSSProperties } from 'react'
import { dateParts, todayISO, weekDates, weekStart, weekdayJa } from './dates'
import { useStore } from './store'
import { Button } from './ui'
import { WeekBoard } from './WeekBoard'
import { asCaseColor, asTaskLane, CASE_COLORS, nextCaseColor, type TaskLane, type WorkTask } from './types'

const LANES: { id: TaskLane; label: string }[] = [
  { id: 'open', label: '未完了' },
  { id: 'progress', label: '進捗中' },
  { id: 'done', label: '完了' },
]

const MOVES: { id: TaskLane; label: string }[] = [
  { id: 'progress', label: '進捗中へ' },
  { id: 'open', label: '未完了へ' },
  { id: 'done', label: '完了へ' },
]

function ColorPicks({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (color: string) => void
  label: string
}) {
  return (
    <div className="color-picks" role="radiogroup" aria-label={label}>
      {CASE_COLORS.map((color) => {
        const on = color === value
        return (
          <button
            key={color}
            type="button"
            className={on ? 'color-pick on' : 'color-pick'}
            style={{ background: color }}
            aria-label={color}
            aria-checked={on}
            role="radio"
            onClick={() => onChange(color)}
          />
        )
      })}
    </div>
  )
}

export function OrganizePage() {
  const { state, addCase, renameCase, setCaseColor, removeCase, addTask, renameTask, moveTask, scheduleTask, removeTask } =
    useStore()
  const [showDone, setShowDone] = useState(false)
  const [caseName, setCaseName] = useState('')
  const [newColor, setNewColor] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [dragId, setDragId] = useState<string | null>(null)
  const [overLane, setOverLane] = useState<TaskLane | null>(null)

  const lanes = showDone ? LANES : LANES.filter((lane) => lane.id !== 'done')
  const cases = state.cases ?? []
  const tasks = state.tasks ?? []
  const caseOf = (id: string) => cases.find((c) => c.id === id)

  function tasksIn(lane: TaskLane) {
    return tasks.filter((task) => asTaskLane(task.lane) === lane)
  }

  const weekDays = weekDates(weekStart(todayISO()))
  const colorForNew = newColor ?? nextCaseColor(cases)

  function submitCase() {
    addCase(caseName, colorForNew)
    setCaseName('')
    setNewColor(null)
  }

  function submitTask(caseId: string) {
    addTask(caseId, drafts[caseId] ?? '', 'open')
    setDrafts((prev) => ({ ...prev, [caseId]: '' }))
  }

  return (
    <div className="page page-organize">
      <div className="page-head">
        <div>
          <p className="kicker">朝と夜に、仕事の棚を整える</p>
          <h1>整理</h1>
          <p className="muted">曜日にやることを置き、終わらなければ翌日へ移す。案件の棚でもカードを動かせます。</p>
        </div>
        <div className="page-head-side">
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

      <WeekBoard />

      <div className="board" style={{ '--lane-count': lanes.length } as CSSProperties}>
        {lanes.map((lane) => {
          const items = tasksIn(lane.id)
          return (
            <section
              key={lane.id}
              className={`lane lane-${lane.id}${overLane === lane.id ? ' over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setOverLane(lane.id)
              }}
              onDragLeave={() => {
                if (overLane === lane.id) setOverLane(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData('text/plain') || dragId
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

      <section className="section section-panel case-panel tone-gold">
        <header className="section-head">
          <p className="kicker">案件</p>
          <h2>行っている仕事</h2>
        </header>
        {cases.length === 0 ? (
          <p className="muted">案件を足すと、その中に細かい作業を置けます。</p>
        ) : (
          <ul className="case-list">
            {cases.map((row) => (
              <li key={row.id} className="case-row">
                <ColorPicks
                  value={asCaseColor(row.color)}
                  onChange={(color) => setCaseColor(row.id, color)}
                  label={`${row.name}の色`}
                />
                <input
                  className="input-inline"
                  defaultValue={row.name}
                  key={row.name}
                  aria-label="案件名"
                  onBlur={(e) => renameCase(row.id, e.target.value)}
                />
                <form
                  className="case-add"
                  onSubmit={(e) => {
                    e.preventDefault()
                    submitTask(row.id)
                  }}
                >
                  <input
                    value={drafts[row.id] ?? ''}
                    placeholder="作業を足す"
                    aria-label={`${row.name}に作業を足す`}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  />
                  <Button type="submit" variant="quiet">
                    足す
                  </Button>
                </form>
                <Button
                  variant="quiet"
                  onClick={() => {
                    if (window.confirm(`「${row.name}」と、中の作業を消しますか？`)) {
                      removeCase(row.id)
                    }
                  }}
                >
                  削除
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="case-new"
          onSubmit={(e) => {
            e.preventDefault()
            submitCase()
          }}
        >
          <ColorPicks value={colorForNew} onChange={setNewColor} label="新しい案件の色" />
          <input
            value={caseName}
            placeholder="新しい案件名"
            aria-label="新しい案件名"
            onChange={(e) => setCaseName(e.target.value)}
          />
          <Button type="submit" variant="primary">
            案件を足す
          </Button>
        </form>
      </section>
    </div>
  )
}

function TaskCard({
  task,
  caseName,
  color,
  scheduledOn,
  weekDays,
  dragging,
  onRename,
  onMove,
  onSchedule,
  onRemove,
  onDragStart,
  onDragEnd,
}: {
  task: WorkTask
  caseName: string
  color: string
  scheduledOn?: string
  weekDays: string[]
  dragging: boolean
  onRename: (title: string) => void
  onMove: (lane: TaskLane) => void
  onSchedule: (date: string) => void
  onRemove: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  return (
    <li>
      <article
        className={dragging ? 'work-card dragging' : 'work-card'}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', task.id)
          e.dataTransfer.effectAllowed = 'move'
          onDragStart()
        }}
        onDragEnd={onDragEnd}
      >
        <p className="kicker work-card-case">
          <i className="case-dot" style={{ background: color }} aria-hidden />
          {caseName}
        </p>
        <input
          className="input-inline"
          defaultValue={task.title}
          key={task.title}
          aria-label="作業名"
          onBlur={(e) => onRename(e.target.value)}
        />
        <select
          className="task-day"
          value={scheduledOn && weekDays.includes(scheduledOn) ? scheduledOn : scheduledOn || ''}
          aria-label="取り組む日"
          onChange={(e) => onSchedule(e.target.value)}
        >
          <option value="">日付なし</option>
          {scheduledOn && !weekDays.includes(scheduledOn) ? (
            <option value={scheduledOn}>
              {dateParts(scheduledOn).month}/{dateParts(scheduledOn).day}（{weekdayJa(scheduledOn)}）
            </option>
          ) : null}
          {weekDays.map((date) => (
            <option key={date} value={date}>
              {weekdayJa(date)} {dateParts(date).month}/{dateParts(date).day}
            </option>
          ))}
        </select>
        <div className="card-moves">
          {MOVES.filter((move) => move.id !== asTaskLane(task.lane)).map((move) => (
            <Button key={move.id} variant="quiet" onClick={() => onMove(move.id)}>
              {move.label}
            </Button>
          ))}
          <Button variant="quiet" onClick={onRemove}>
            削除
          </Button>
        </div>
      </article>
    </li>
  )
}
