import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './auth'
import { loadCloud, saveCloud } from './cloud'
import { emptyDay } from './selectors'
import { asDateList, isISODate } from './todos'
import { appendSpoken } from './speech'
import { mergeStates } from './sync'
import { addDays, todayISO } from './dates'
import {
  emptyState,
  type DayRecord,
  type State,
  asCaseColor,
  asTaskLane,
  CASE_COLORS,
  nextCaseColor,
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
    next.push({
      id: String(row.id),
      name,
      color: asCaseColor(row.color, CASE_COLORS[next.length % CASE_COLORS.length]),
    })
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
      scheduledOn: isISODate(row.scheduledOn) ? row.scheduledOn : undefined,
      plannedDates: asDateList(row.plannedDates, isISODate(row.scheduledOn) ? row.scheduledOn : undefined),
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

export function migrateState(parsed: Partial<State> & Record<string, unknown>): State {
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

type SyncStatus = 'local' | 'saving' | 'saved' | 'error'

type Store = {
  state: State
  syncStatus: SyncStatus
  patchDay: (date: string, patch: Partial<Omit<DayRecord, 'date'>>) => void
  appendDay: (date: string, field: 'note' | 'y' | 'w' | 't', text: string) => void
  patchWeekNote: (week: string, note: string) => void
  appendWeekNote: (week: string, text: string) => void
  patchMonthNote: (key: string, note: string) => void
  appendMonthNote: (key: string, text: string) => void
  addCase: (name: string, color?: string) => void
  renameCase: (id: string, name: string) => void
  setCaseColor: (id: string, color: string) => void
  removeCase: (id: string) => void
  addTask: (caseId: string, title: string, lane?: TaskLane, scheduledOn?: string) => void
  renameTask: (id: string, title: string) => void
  moveTask: (id: string, lane: TaskLane) => void
  scheduleTask: (id: string, date: string | '') => void
  toggleTaskDone: (id: string, date: string) => void
  carryTasks: (fromDate: string) => void
  removeTask: (id: string) => void
  replaceArchive: (next: Partial<State>) => void
  flushCloud: () => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<State>(load)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local')
  const userRef = useRef(user)
  const stateRef = useRef(state)
  const lastPush = useRef(0)
  const saveTimer = useRef(0)

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const pushCloud = useCallback(async (next: State) => {
    if (!userRef.current) return
    setSyncStatus('saving')
    try {
      lastPush.current = await saveCloud(next)
      setSyncStatus('saved')
    } catch {
      setSyncStatus('error')
    }
  }, [])

  const schedulePush = useCallback(
    (next: State) => {
      if (!userRef.current) return
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        void pushCloud(next)
      }, 700)
    },
    [pushCloud],
  )

  const commit = useCallback(
    (recipe: (draft: State) => void) => {
      setState((prev) => {
        const next = structuredClone(prev)
        if (!next.weekNotes) next.weekNotes = {}
        if (!next.monthNotes) next.monthNotes = {}
        if (!next.cases) next.cases = []
        if (!next.tasks) next.tasks = []
        next.tasks = next.tasks.map((task) => ({ ...task, lane: asTaskLane(task.lane) }))
        recipe(next)
        persist(next)
        schedulePush(next)
        return next
      })
    },
    [schedulePush],
  )

  useEffect(() => {
    if (!user) {
      setSyncStatus('local')
      return
    }
    let cancelled = false
    void (async () => {
      setSyncStatus('saving')
      try {
        const remote = await loadCloud()
        if (cancelled) return
        const lastEmail = localStorage.getItem('keiei.lastEmail')
        setState((local) => {
          const switched = Boolean(lastEmail && lastEmail !== user.email)
          const remoteState = remote ? migrateState(remote) : null
          const next = switched
            ? remoteState ?? emptyState()
            : remoteState
              ? mergeStates(local, remoteState)
              : local
          persist(next)
          localStorage.setItem('keiei.lastEmail', user.email)
          void saveCloud(next).then((at) => {
            lastPush.current = at
            if (!cancelled) setSyncStatus('saved')
          }).catch(() => {
            if (!cancelled) setSyncStatus('error')
          })
          return next
        })
      } catch {
        if (!cancelled) setSyncStatus('error')
      }
    })()

    const pull = async () => {
      if (document.visibilityState === 'hidden' || !userRef.current) return
      try {
        const remote = await loadCloud()
        if (!remote || remote.updatedAt <= lastPush.current) return
        setState((local) => {
          const next = mergeStates(local, migrateState(remote))
          persist(next)
          lastPush.current = remote.updatedAt
          return next
        })
      } catch {
        /* keep local */
      }
    }
    const onFocus = () => {
      void pull()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    const timer = window.setInterval(onFocus, 60_000)
    return () => {
      cancelled = true
      window.clearTimeout(saveTimer.current)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      window.clearInterval(timer)
    }
  }, [user])


  const store = useMemo<Store>(
    () => ({
      state,
      syncStatus,
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
      appendDay(date, field, text) {
        const spoken = text.trim()
        if (!spoken) return
        commit((s) => {
          if (!s.days[date]) s.days[date] = emptyDay(date)
          s.days[date][field] = appendSpoken(s.days[date][field], spoken)
          s.days[date].skipped = false
        })
      },
      patchWeekNote(week, note) {
        commit((s) => {
          if (note.trim()) s.weekNotes[week] = note
          else delete s.weekNotes[week]
        })
      },
      appendWeekNote(week, text) {
        const spoken = text.trim()
        if (!spoken) return
        commit((s) => {
          s.weekNotes[week] = appendSpoken(s.weekNotes[week] ?? '', spoken)
        })
      },
      patchMonthNote(key, note) {
        commit((s) => {
          if (note.trim()) s.monthNotes[key] = note
          else delete s.monthNotes[key]
        })
      },
      appendMonthNote(key, text) {
        const spoken = text.trim()
        if (!spoken) return
        commit((s) => {
          s.monthNotes[key] = appendSpoken(s.monthNotes[key] ?? '', spoken)
        })
      },
      addCase(name, color) {
        const trimmed = name.trim()
        if (!trimmed) return
        commit((s) => {
          s.cases.push({
            id: nid(),
            name: trimmed,
            color: asCaseColor(color, nextCaseColor(s.cases)),
          })
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
      setCaseColor(id, color) {
        const next = asCaseColor(color, '')
        if (!next) return
        commit((s) => {
          const row = s.cases.find((c) => c.id === id)
          if (row) row.color = next
        })
      },
      removeCase(id) {
        commit((s) => {
          s.cases = s.cases.filter((c) => c.id !== id)
          s.tasks = s.tasks.filter((t) => t.caseId !== id)
        })
      },
      addTask(caseId, title, lane = 'open', scheduledOn) {
        const trimmed = title.trim()
        if (!trimmed) return
        commit((s) => {
          if (!s.cases.some((c) => c.id === caseId)) return
          const on = isISODate(scheduledOn) ? scheduledOn : undefined
          s.tasks.push({
            id: nid(),
            caseId,
            title: trimmed,
            lane,
            doneAt: lane === 'done' ? on ?? todayISO() : undefined,
            scheduledOn: on,
            plannedDates: on ? [on] : [],
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
          if (lane === 'done') {
            const on = todayISO()
            row.doneAt = on
            if (!row.scheduledOn) row.scheduledOn = on
            row.plannedDates = asDateList(row.plannedDates, row.scheduledOn)
          } else {
            row.doneAt = undefined
          }
        })
      },
      scheduleTask(id, date) {
        commit((s) => {
          const row = s.tasks.find((t) => t.id === id)
          if (!row) return
          if (!date) {
            row.scheduledOn = undefined
            return
          }
          if (!isISODate(date)) return
          row.scheduledOn = date
          row.plannedDates = asDateList(row.plannedDates, date)
        })
      },
      toggleTaskDone(id, date) {
        if (!isISODate(date)) return
        commit((s) => {
          const row = s.tasks.find((t) => t.id === id)
          if (!row) return
          if (asTaskLane(row.lane) === 'done' && row.doneAt === date) {
            row.lane = 'open'
            row.doneAt = undefined
            return
          }
          row.lane = 'done'
          row.doneAt = date
          row.scheduledOn = date
          row.plannedDates = asDateList(row.plannedDates, date)
        })
      },
      carryTasks(fromDate) {
        if (!isISODate(fromDate)) return
        const next = addDays(fromDate, 1)
        commit((s) => {
          for (const row of s.tasks) {
            if (row.scheduledOn !== fromDate || asTaskLane(row.lane) === 'done') continue
            row.scheduledOn = next
            row.plannedDates = asDateList(row.plannedDates, next)
          }
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
        schedulePush(merged)
      },
      async flushCloud() {
        window.clearTimeout(saveTimer.current)
        if (!userRef.current) return
        await pushCloud(stateRef.current)
      },
    }),
    [commit, pushCloud, schedulePush, state, syncStatus],
  )

  return <StoreContext value={store}>{children}</StoreContext>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('StoreProvider がありません')
  return ctx
}
