import { dateParts, weekdayJa } from './dates'
import { RepeatControls } from './RepeatControls'
import { asTaskLane, type TaskLane, type TaskRepeat, type WorkTask } from './types'
import { Button } from './ui'

const MOVES: { id: TaskLane; label: string }[] = [
  { id: 'progress', label: '進捗中へ' },
  { id: 'open', label: '未完了へ' },
  { id: 'done', label: '完了へ' },
]

export function TaskCard({
  task,
  caseName,
  color,
  scheduledOn,
  weekDays,
  dragging,
  onRename,
  onMove,
  onSchedule,
  onRepeat,
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
  onRepeat: (repeat: TaskRepeat | undefined) => void
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
        <RepeatControls start={scheduledOn} repeat={task.repeat} onChange={onRepeat} />
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
