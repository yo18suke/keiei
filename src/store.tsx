import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { emptyDay } from './selectors'
import { todayISO } from './dates'
import {
  emptyState,
  type DayRecord,
  type State,
  asTaskLane,
  type TaskLane,
  type WorkCase,
  type WorkTask,
} from './types'

function nid() {
  return crypto.randomUUID()
}

function migrateCases(raw: unknown): WorkCase[] {
  if (!Array.isArray(raw)) return []
  const next: WorkCase[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<WorkCase>
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    if (!row.id || !name) continue
    next.push({ id: String(row.id), name })
  }
  return next
}

function migrateTasks(raw: unknown): WorkTask[] {
  if (!Array.isArray(raw)) return []
  const next: WorkTask[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<WorkTask>
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    const lane = asTaskLane(row.lane)
    if (!row.id || !row.caseId || !title) continue
    next.push({
      id: String(row.id),
      caseId: String(row.caseId),
      title,
      lane,
      doneAt: typeof row.doneAt === 'string' ? row.doneAt : undefined,
    })
  }
  return next
}

const KEY = 'keiei.v1'

function asNoteMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const next: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) next[key] = value
  }
  return next
}

function migrateDay(raw: Partial<DayRecord> & { date: string }): DayRecord {
  const day = { ...emptyDay(raw.date), ...raw }
  const leftover = raw as Partial<DayRecord> & {
    tomorrow?: Array<{ title?: string }>
  }
  if (!day.t.trim() && Array.isArray(leftover.tomorrow)) {
    day.t = leftover.tomorrow
      .map((g) => g.title?.trim() ?? '')
      .filter(Boolean)
      .join(' / ')
  }
  day.note = typeof day.note === 'string' ? day.note : ''
  day.y = typeof day.y === 'string' ? day.y : ''
  day.w = typeof day.w === 'string' ? day.w : ''
  day.t = typeof day.t === 'string' ? day.t : ''
  day.skipped = Boolean(day.skipped)
  return {
    date: day.date,
    note: day.note,
    y: day.y,
    w: day.w,
    t: day.t,
    skipped: day.skipped,
  }
}

function migrateState(parsed: Partial<State> & Record<string, unknown>): State {
  const days: State['days'] = {}
  for (const [date, day] of Object.entries(parsed.days ?? {})) {
    days[date] = migrateDay({ ...day, date })
  }
  return {
    days,
    weekNotes: asNoteMap(parsed.weekNotes),
    monthNotes: asNoteMap(parsed.monthNotes),
    cases: migrateCases(parsed.cases),
    tasks: migrateTasks(parsed.tasks),
  }
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    return migrateState(JSON.parse(raw) as Partial<State>)
  } catch {
    return emptyState()
  }
}

function persist(state: State) {
  let prev: Record<string, unknown> = {}
  try {
    prev = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, unknown>
  } catch {
    prev = {}
  }
  localStorage.setItem(
    KEY,
    JSON.stringify({
      ...prev,
      days: state.days,
      weekNotes: state.weekNotes,
      monthNotes: state.monthNotes,
      cases: state.cases,
      tasks: state.tasks,
    }),
  )
}

type Store = {
  state: State
  patchDay: (date: string, patch: Partial<Omit<DayRecord, 'date'>>) => void
  patchWeekNote: (week: string, note: string) => void
  patchMonthNote: (key: string, note: string) => void
  addCase: (name: string) => void
  renameCase: (id: string, name: string) => void
  removeCase: (id: string) => void
  addTask: (caseId: string, title: string, lane?: TaskLane) => void
  renameTask: (id: string, title: string) => void
  moveTask: (id: string, lane: TaskLane) => void
  removeTask: (id: string) => void
  replaceArchive: (next: Partial<State>) => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load)

  const commit = useCallback((recipe: (draft: State) => void) => {
    setState((prev) => {
      const next = structuredClone(prev)
      if (!next.weekNotes) next.weekNotes = {}
      if (!next.monthNotes) next.monthNotes = {}
      if (!next.cases) next.cases = []
      if (!next.tasks) next.tasks = []
      next.tasks = next.tasks.map((task) => ({ ...task, lane: asTaskLane(task.lane) }))
      recipe(next)
      persist(next)
      return next
    })
  }, [])

  const store = useMemo<Store>(
    () => ({
      state,
      patchDay(date, patch) {
        commit((s) => {
          if (!s.days[date]) s.days[date] = emptyDay(date)
          Object.assign(s.days[date], patch)
          const day = { ...emptyDay(date), ...s.days[date] }
          s.days[date] = day
          if (
            !day.note.trim() &&
            !day.y.trim() &&
            !day.w.trim() &&
            !day.t.trim() &&
            !day.skipped
          ) {
            delete s.days[date]
          }
        })
      },
      patchWeekNote(week, note) {
        commit((s) => {
          if (note.trim()) s.weekNotes[week] = note
          else delete s.weekNotes[week]
        })
      },
      patchMonthNote(key, note) {
        commit((s) => {
          if (note.trim()) s.monthNotes[key] = note
          else delete s.monthNotes[key]
        })
      },
      addCase(name) {
        const trimmed = name.trim()
        if (!trimmed) return
        commit((s) => {
          s.cases.push({ id: nid(), name: trimmed })
        })
      },
      renameCase(id, name) {
        const trimmed = name.trim()
        if (!trimmed) return
        commit((s) => {
          const row = s.cases.find((c) => c.id === id)
          if (row) row.name = trimmed
        })
      },
      removeCase(id) {
        commit((s) => {
          s.cases = s.cases.filter((c) => c.id !== id)
          s.tasks = s.tasks.filter((t) => t.caseId !== id)
        })
      },
      addTask(caseId, title, lane = 'open') {
        const trimmed = title.trim()
        if (!trimmed) return
        commit((s) => {
          if (!s.cases.some((c) => c.id === caseId)) return
          s.tasks.push({
            id: nid(),
            caseId,
            title: trimmed,
            lane,
            doneAt: lane === 'done' ? todayISO() : undefined,
          })
        })
      },
      renameTask(id, title) {
        const trimmed = title.trim()
        if (!trimmed) return
        commit((s) => {
          const row = s.tasks.find((t) => t.id === id)
          if (row) row.title = trimmed
        })
      },
      moveTask(id, lane) {
        commit((s) => {
          const row = s.tasks.find((t) => t.id === id)
          if (!row || row.lane === lane) return
          row.lane = lane
          row.doneAt = lane === 'done' ? todayISO() : undefined
        })
      },
      removeTask(id) {
        commit((s) => {
          s.tasks = s.tasks.filter((t) => t.id !== id)
        })
      },
      replaceArchive(next) {
        const merged = migrateState({ ...state, ...next })
        persist(merged)
        setState(merged)
      },
    }),
    [commit, state],
  )

  return <StoreContext value={store}>{children}</StoreContext>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('StoreProvider がありません')
  return ctx
}
