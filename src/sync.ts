import {
  asTaskLane,
  calendarLinksOf,
  emptyState,
  googleTasksOf,
  type CalendarLink,
  type DayRecord,
  type GoogleTaskRef,
  type State,
  type WorkCase,
  type WorkTask,
  asCaseColor,
} from './types'
import { asDateList } from './todos'
import { asTaskRepeat } from './repeat'

function pickText(a: string, b: string) {
  if (!a.trim()) return b
  if (!b.trim()) return a
  return a.length >= b.length ? a : b
}

function mergeDay(a: DayRecord, b: DayRecord): DayRecord {
  const note = pickText(a.note, b.note)
  const y = pickText(a.y, b.y)
  const w = pickText(a.w, b.w)
  const t = pickText(a.t, b.t)
  const hasContent = Boolean(note.trim() || y.trim() || w.trim() || t.trim())
  return {
    date: a.date || b.date,
    note,
    y,
    w,
    t,
    skipped: hasContent ? false : a.skipped || b.skipped,
  }
}

function mergeNotes(a: Record<string, string>, b: Record<string, string>) {
  const next = { ...a }
  for (const [key, value] of Object.entries(b)) {
    next[key] = pickText(next[key] ?? '', value)
  }
  return next
}

function mergeCases(a: WorkCase[], b: WorkCase[]) {
  const map = new Map<string, WorkCase>()
  for (const item of [...a, ...b]) {
    const prev = map.get(item.id)
    if (!prev) map.set(item.id, { ...item, color: asCaseColor(item.color) })
    else map.set(item.id, {
      id: item.id,
      name: pickText(prev.name, item.name),
      color: asCaseColor(item.color, asCaseColor(prev.color)),
      doneAt: item.doneAt || prev.doneAt,
    })
  }
  return [...map.values()]
}

const LANE_RANK: Record<WorkTask['lane'], number> = {
  open: 0,
  progress: 1,
  done: 2,
}

function mergeTasks(a: WorkTask[], b: WorkTask[]) {
  const map = new Map<string, WorkTask>()
  for (const item of [...a, ...b]) {
    const task = { ...item, lane: asTaskLane(item.lane) }
    const prev = map.get(task.id)
    if (!prev) {
      map.set(task.id, {
        ...task,
        plannedDates: asDateList(task.plannedDates, task.scheduledOn),
        doneDates: asDateList(task.doneDates),
        repeat: asTaskRepeat(task.repeat),
        googleTasks: googleTasksOf(task),
        googleTaskId: googleTasksOf(task)[0]?.taskId,
        googleTaskListId: googleTasksOf(task)[0]?.listId,
      })
      continue
    }
    const richer = LANE_RANK[task.lane] >= LANE_RANK[prev.lane] ? task : prev
    const googleTasks = mergeGoogleTasks(googleTasksOf(prev), googleTasksOf(task))
    map.set(task.id, {
      ...richer,
      title: pickText(prev.title, task.title),
      doneAt: richer.lane === 'done' ? richer.doneAt || prev.doneAt || task.doneAt : undefined,
      scheduledOn: richer.scheduledOn || prev.scheduledOn,
      plannedDates: asDateList([...(prev.plannedDates ?? []), ...(task.plannedDates ?? [])], richer.scheduledOn || prev.scheduledOn),
      doneDates: asDateList([...(prev.doneDates ?? []), ...(task.doneDates ?? [])]),
      repeat: asTaskRepeat(task.repeat) || asTaskRepeat(prev.repeat),
      googleTasks,
      googleTaskId: googleTasks[0]?.taskId,
      googleTaskListId: googleTasks[0]?.listId,
    })
  }
  return [...map.values()]
}

function mergeGoogleTasks(a: GoogleTaskRef[], b: GoogleTaskRef[]) {
  const map = new Map<string, GoogleTaskRef>()
  for (const item of [...a, ...b]) {
    if (!item.listId || !item.taskId) continue
    map.set(`${item.accountEmail.toLowerCase()}::${item.listId}`, item)
  }
  return [...map.values()]
}

function mergeCalendarLinks(a: CalendarLink[], b: CalendarLink[]) {
  const map = new Map<string, CalendarLink>()
  for (const item of [...a, ...b]) {
    if (!item.accountEmail || !item.listId) continue
    map.set(item.accountEmail.toLowerCase(), item)
  }
  return [...map.values()]
}

export function mergeStates(a: State, b: State): State {
  const days: State['days'] = { ...a.days }
  for (const [date, day] of Object.entries(b.days)) {
    days[date] = days[date] ? mergeDay(days[date], day) : day
  }
  const calendarLinks = mergeCalendarLinks(calendarLinksOf(a), calendarLinksOf(b))
  return {
    days,
    weekNotes: mergeNotes(a.weekNotes, b.weekNotes),
    monthNotes: mergeNotes(a.monthNotes, b.monthNotes),
    cases: mergeCases(a.cases, b.cases),
    tasks: mergeTasks(a.tasks, b.tasks),
    calendarLinks,
    calendarLink: calendarLinks[0],
  }
}

export function isEmptyState(state: State) {
  return (
    Object.keys(state.days).length === 0 &&
    Object.keys(state.weekNotes).length === 0 &&
    Object.keys(state.monthNotes).length === 0 &&
    state.cases.length === 0 &&
    state.tasks.length === 0
  )
}

export function cloneState(state: State): State {
  return structuredClone(state ?? emptyState())
}
