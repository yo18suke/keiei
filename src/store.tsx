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
import { applyRemoteGoogleTask, deleteGoogleTask, listGoogleTasks, upsertGoogleTask } from './calendar'
import { loadCloud, saveCloud } from './cloud'
import { emptyDay } from './selectors'
import { asDateList, isISODate } from './todos'
import { asTaskRepeat } from './repeat'
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
  type CalendarLink,
  type GoogleTaskRef,
  type TaskLane,
  type WorkCase,
  type WorkTask,
  type TaskRepeat,
  calendarLinksOf,
  googleTasksOf,
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
      doneAt: typeof row.doneAt === 'string' ? row.doneAt : undefined,
    })
  }
  return next
}

function migrateTasks(raw: unknown, fallbackEmail?: string): WorkTask[] {
  if (!Array.isArray(raw)) return []
  const next: WorkTask[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Partial<WorkTask>
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    const lane = asTaskLane(row.lane)
    if (!row.id || !row.caseId || !title) continue
    const googleTasks = asGoogleTasks(row.googleTasks, row, fallbackEmail)
    next.push({
      id: String(row.id),
      caseId: String(row.caseId),
      title,
      lane,
      doneAt: typeof row.doneAt === 'string' ? row.doneAt : undefined,
      scheduledOn: isISODate(row.scheduledOn) ? row.scheduledOn : undefined,
      plannedDates: asDateList(row.plannedDates, isISODate(row.scheduledOn) ? row.scheduledOn : undefined),
      doneDates: asDateList(row.doneDates),
      repeat: asTaskRepeat(row.repeat),
      googleTasks: googleTasks.length ? googleTasks : undefined,
      googleTaskId: googleTasks[0]?.taskId,
      googleTaskListId: googleTasks[0]?.listId,
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
  const calendarLinks = asCalendarLinks(parsed.calendarLinks, parsed.calendarLink)
  return {
    days,
    weekNotes: asNoteMap(parsed.weekNotes),
    monthNotes: asNoteMap(parsed.monthNotes),
    cases: migrateCases(parsed.cases),
    tasks: migrateTasks(parsed.tasks, calendarLinks[0]?.accountEmail),
    calendarLinks,
    calendarLink: calendarLinks[0],
  }
}

function asCalendarLink(raw: unknown): CalendarLink | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const row = raw as Partial<CalendarLink>
  if (!row.listId || !row.listTitle) return undefined
  const email = typeof row.accountEmail === 'string' ? row.accountEmail.trim() : ''
  return {
    accountEmail: email,
    listId: String(row.listId),
    listTitle: String(row.listTitle),
  }
}

function asCalendarLinks(raw: unknown, fallback?: unknown): CalendarLink[] {
  const next: CalendarLink[] = []
  const seen = new Set<string>()
  const add = (link?: CalendarLink) => {
    if (!link) return
    const key = link.accountEmail.toLowerCase() || `__list__${link.listId}`
    if (seen.has(key)) return
    seen.add(key)
    next.push(link)
  }
  if (Array.isArray(raw)) {
    for (const item of raw) add(asCalendarLink(item))
  }
  add(asCalendarLink(fallback))
  return next
}

function asGoogleTasks(raw: unknown, fallback?: Partial<WorkTask>, email?: string): GoogleTaskRef[] {
  const next: GoogleTaskRef[] = []
  const seen = new Set<string>()
  const add = (ref?: GoogleTaskRef) => {
    if (!ref?.listId || !ref.taskId) return
    const key = `${ref.accountEmail.toLowerCase()}::${ref.listId}`
    if (seen.has(key)) return
    seen.add(key)
    next.push(ref)
  }
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const row = item as Partial<GoogleTaskRef>
      add({
        accountEmail: typeof row.accountEmail === 'string' ? row.accountEmail : '',
        listId: String(row.listId ?? ''),
        taskId: String(row.taskId ?? ''),
      })
    }
  }
  if (typeof fallback?.googleTaskId === 'string' && typeof fallback.googleTaskListId === 'string') {
    add({
      accountEmail: email ?? '',
      listId: fallback.googleTaskListId,
      taskId: fallback.googleTaskId,
    })
  }
  return next
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
      calendarLinks: calendarLinksOf(state),
      calendarLink: calendarLinksOf(state)[0],
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
  completeCase: (id: string) => void
  reopenCase: (id: string) => void
  removeCase: (id: string) => void
  addTask: (caseId: string, title: string, lane?: TaskLane, scheduledOn?: string) => void
  renameTask: (id: string, title: string) => void
  moveTask: (id: string, lane: TaskLane) => void
  scheduleTask: (id: string, date: string | '') => void
  setTaskRepeat: (id: string, repeat: TaskRepeat | undefined) => void
  toggleTaskDone: (id: string, date: string) => void
  carryTasks: (fromDate: string) => void
  removeTask: (id: string) => void
  upsertCalendarLink: (link: CalendarLink) => void
  clearCalendarList: (email: string) => void
  removeCalendarAccount: (email: string) => void
  syncCalendarNow: () => Promise<void>
  replaceArchive: (next: Partial<State>) => void
  flushCloud: () => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user, driveReady } = useAuth()
  const [state, setState] = useState<State>(load)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local')
  const userRef = useRef(user)
  const driveRef = useRef(driveReady)
  const stateRef = useRef(state)
  const lastPush = useRef(0)
  const saveTimer = useRef(0)

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    driveRef.current = driveReady
  }, [driveReady])

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const pushCloud = useCallback(async (next: State) => {
    if (!userRef.current || !driveRef.current) return
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
      if (!userRef.current || !driveRef.current) return
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
        stateRef.current = next
        schedulePush(next)
        return next
      })
    },
    [schedulePush],
  )

  const calTimers = useRef<Record<string, number>>({})
  const lastLocalEdit = useRef<Record<string, number>>({})
  const calQueue = useRef(Promise.resolve())

  const enqueueCalendar = useCallback((job: () => Promise<void>) => {
    const run = calQueue.current.then(job, job)
    calQueue.current = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }, [])

  const writeGoogleTasks = useCallback((task: WorkTask, next: GoogleTaskRef[]) => {
    task.googleTasks = next.length ? next : undefined
    task.googleTaskId = next[0]?.taskId
    task.googleTaskListId = next[0]?.listId
  }, [])

  const rememberTask = useCallback((taskId: string, ref: GoogleTaskRef, replaceEmail?: string) => {
    commit((s) => {
      const row = s.tasks.find((task) => task.id === taskId)
      if (!row) return
      const email = (replaceEmail || ref.accountEmail).toLowerCase()
      const next = googleTasksOf(row).filter((item) => item.accountEmail.toLowerCase() !== email)
      next.push(ref)
      writeGoogleTasks(row, next)
    })
  }, [commit, writeGoogleTasks])

  const pushCalendarTask = useCallback(async (taskId: string) => {
    const links = calendarLinksOf(stateRef.current)
    if (!links.length) return
    const task = stateRef.current.tasks.find((row) => row.id === taskId)
    if (!task) return
    const caseName = stateRef.current.cases.find((row) => row.id === task.caseId)?.name
    for (const link of links) {
      if (!link.accountEmail || !link.listId) continue
      try {
        const ref = await upsertGoogleTask(link, task, caseName)
        const current = googleTasksOf(task).find((item) => item.accountEmail.toLowerCase() === link.accountEmail.toLowerCase())
        if (!current || current.taskId !== ref.taskId || current.listId !== ref.listId) {
          rememberTask(taskId, ref, link.accountEmail)
        }
      } catch {
        /* カレンダー側の失敗で入力は止めない */
      }
    }
  }, [rememberTask])

  const queueCalendarTask = useCallback((taskId: string) => {
    lastLocalEdit.current[taskId] = Date.now()
    if (!calendarLinksOf(stateRef.current).length) return
    window.clearTimeout(calTimers.current[taskId])
    calTimers.current[taskId] = window.setTimeout(() => {
      void pushCalendarTask(taskId)
    }, 450)
  }, [pushCalendarTask])

  const dropCalendarTask = useCallback((task?: WorkTask, email?: string) => {
    if (!task) return
    for (const ref of googleTasksOf(task)) {
      if (email && ref.accountEmail.toLowerCase() !== email.toLowerCase()) continue
      if (!ref.accountEmail) continue
      void deleteGoogleTask(ref.accountEmail, ref.listId, ref.taskId).catch(() => undefined)
    }
  }, [])

  const ingestGoogleTasks = useCallback(async () => {
    const links = calendarLinksOf(stateRef.current).filter((link) => link.accountEmail && link.listId)
    if (!links.length) return [] as string[]
    const remotesByTask = new Map<string, Awaited<ReturnType<typeof listGoogleTasks>>>()
    for (const link of links) {
      try {
        const items = await listGoogleTasks(link.accountEmail, link.listId)
        const byId = new Map(items.map((item) => [item.id, item]))
        for (const task of stateRef.current.tasks) {
          const ref = googleTasksOf(task).find(
            (row) =>
              row.accountEmail.toLowerCase() === link.accountEmail.toLowerCase() && row.listId === link.listId,
          )
          if (!ref) continue
          const remote = byId.get(ref.taskId)
          if (!remote) continue
          const current = remotesByTask.get(task.id) ?? []
          current.push(remote)
          remotesByTask.set(task.id, current)
        }
      } catch {
        /* 片方のアカウントが読めなくても、他は取り込む */
      }
    }
    const changed: string[] = []
    commit((s) => {
      for (const task of s.tasks) {
        const remotes = remotesByTask.get(task.id)
        if (!remotes?.length) continue
        if (Date.now() - (lastLocalEdit.current[task.id] ?? 0) < 8000) continue
        if (applyRemoteGoogleTask(task, remotes)) changed.push(task.id)
      }
    })
    return changed
  }, [commit])

  const pullCalendarTasks = useCallback(() => {
    if (!calendarLinksOf(stateRef.current).length) return Promise.resolve()
    return enqueueCalendar(async () => {
      const changed = await ingestGoogleTasks()
      for (const id of changed) await pushCalendarTask(id)
    })
  }, [enqueueCalendar, ingestGoogleTasks, pushCalendarTask])

  const syncCalendarNow = useCallback(() => {
    if (!calendarLinksOf(stateRef.current).length) return Promise.resolve()
    return enqueueCalendar(async () => {
      await ingestGoogleTasks()
      for (const task of stateRef.current.tasks) {
        await pushCalendarTask(task.id)
      }
    })
  }, [enqueueCalendar, ingestGoogleTasks, pushCalendarTask])

  useEffect(() => {
    if (!user || !driveReady) {
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
      if (document.visibilityState === 'hidden' || !userRef.current || !driveRef.current) return
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
  }, [driveReady, user])

  const linksKey = calendarLinksOf(state)
    .map((link) => `${link.accountEmail}:${link.listId}`)
    .join('|')

  useEffect(() => {
    if (!linksKey) return
    let cancelled = false
    const run = () => {
      if (cancelled || document.visibilityState === 'hidden') return
      void pullCalendarTasks()
    }
    run()
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', run)
    const timer = window.setInterval(run, 45_000)
    return () => {
      cancelled = true
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', run)
      window.clearInterval(timer)
    }
  }, [linksKey, pullCalendarTasks])

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
      completeCase(id) {
        commit((s) => {
          const row = s.cases.find((c) => c.id === id)
          if (!row || row.doneAt) return
          const on = todayISO()
          row.doneAt = on
          for (const task of s.tasks) {
            if (task.caseId !== id || asTaskLane(task.lane) === 'done') continue
            task.lane = 'done'
            task.doneAt = on
            if (!task.scheduledOn) task.scheduledOn = on
            task.plannedDates = asDateList(task.plannedDates, task.scheduledOn)
          }
        })
      },
      reopenCase(id) {
        commit((s) => {
          const row = s.cases.find((c) => c.id === id)
          if (row) row.doneAt = undefined
        })
      },
      removeCase(id) {
        const gone = stateRef.current.tasks.filter((task) => task.caseId === id)
        commit((s) => {
          s.cases = s.cases.filter((c) => c.id !== id)
          s.tasks = s.tasks.filter((t) => t.caseId !== id)
        })
        for (const task of gone) dropCalendarTask(task)
      },
      addTask(caseId, title, lane = 'open', scheduledOn) {
        const trimmed = title.trim()
        if (!trimmed) return
        let id = ''
        commit((s) => {
          if (!s.cases.some((c) => c.id === caseId)) return
          const on = isISODate(scheduledOn) ? scheduledOn : undefined
          id = nid()
          s.tasks.push({
            id,
            caseId,
            title: trimmed,
            lane,
            doneAt: lane === 'done' ? on ?? todayISO() : undefined,
            scheduledOn: on,
            plannedDates: on ? [on] : [],
          })
        })
        if (id) queueCalendarTask(id)
      },
      renameTask(id, title) {
        const trimmed = title.trim()
        if (!trimmed) return
        commit((s) => {
          const row = s.tasks.find((t) => t.id === id)
          if (row) row.title = trimmed
        })
        queueCalendarTask(id)
      },
      moveTask(id, lane) {
        commit((s) => {
          const row = s.tasks.find((t) => t.id === id)
          if (!row || row.lane === lane) return
          row.lane = lane
          if (lane === 'done') {
            const on = todayISO()
            row.doneAt = on
            row.repeat = undefined
            if (!row.scheduledOn) row.scheduledOn = on
            row.plannedDates = asDateList(row.plannedDates, row.scheduledOn)
          } else {
            row.doneAt = undefined
          }
        })
        queueCalendarTask(id)
      },
      scheduleTask(id, date) {
        commit((s) => {
          const row = s.tasks.find((t) => t.id === id)
          if (!row) return
          if (!date) {
            row.scheduledOn = undefined
            row.repeat = undefined
            return
          }
          if (!isISODate(date)) return
          row.scheduledOn = date
          row.plannedDates = asDateList(row.plannedDates, date)
        })
        queueCalendarTask(id)
      },
      setTaskRepeat(id, repeat) {
        commit((s) => {
          const row = s.tasks.find((t) => t.id === id)
          if (!row) return
          const next = asTaskRepeat(repeat)
          if (!next) {
            row.repeat = undefined
            return
          }
          if (!row.scheduledOn) {
            row.scheduledOn = todayISO()
            row.plannedDates = asDateList(row.plannedDates, row.scheduledOn)
          }
          row.repeat = next
        })
        queueCalendarTask(id)
      },
      toggleTaskDone(id, date) {
        if (!isISODate(date)) return
        commit((s) => {
          const row = s.tasks.find((t) => t.id === id)
          if (!row) return
          if (row.repeat) {
            const current = new Set(row.doneDates ?? [])
            if (current.has(date)) current.delete(date)
            else current.add(date)
            row.doneDates = [...current].sort()
            row.plannedDates = asDateList(row.plannedDates, date)
            return
          }
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
        queueCalendarTask(id)
      },
      carryTasks(fromDate) {
        if (!isISODate(fromDate)) return
        const next = addDays(fromDate, 1)
        const moved: string[] = []
        commit((s) => {
          for (const row of s.tasks) {
            if (row.repeat) continue
            if (row.scheduledOn !== fromDate || asTaskLane(row.lane) === 'done') continue
            row.scheduledOn = next
            row.plannedDates = asDateList(row.plannedDates, next)
            moved.push(row.id)
          }
        })
        for (const id of moved) queueCalendarTask(id)
      },
      removeTask(id) {
        const row = stateRef.current.tasks.find((task) => task.id === id)
        commit((s) => {
          s.tasks = s.tasks.filter((t) => t.id !== id)
        })
        dropCalendarTask(row)
      },
      upsertCalendarLink(link) {
        commit((s) => {
          const next = calendarLinksOf(s).filter((row) => row.accountEmail.toLowerCase() !== link.accountEmail.toLowerCase())
          next.push(link)
          s.calendarLinks = next
          s.calendarLink = next[0]
        })
        void syncCalendarNow()
      },
      clearCalendarList(email) {
        commit((s) => {
          const next = calendarLinksOf(s).filter((row) => row.accountEmail.toLowerCase() !== email.toLowerCase())
          s.calendarLinks = next
          s.calendarLink = next[0]
        })
      },
      removeCalendarAccount(email) {
        const doomed = stateRef.current.tasks.filter((row) =>
          googleTasksOf(row).some((ref) => ref.accountEmail.toLowerCase() === email.toLowerCase()),
        )
        commit((s) => {
          const next = calendarLinksOf(s).filter((row) => row.accountEmail.toLowerCase() !== email.toLowerCase())
          s.calendarLinks = next
          s.calendarLink = next[0]
          for (const row of s.tasks) {
            writeGoogleTasks(
              row,
              googleTasksOf(row).filter((ref) => ref.accountEmail.toLowerCase() !== email.toLowerCase()),
            )
          }
        })
        for (const row of doomed) dropCalendarTask(row, email)
      },
      syncCalendarNow,
      replaceArchive(next) {
        const merged = migrateState({ ...state, ...next })
        persist(merged)
        setState(merged)
        schedulePush(merged)
      },
      async flushCloud() {
        window.clearTimeout(saveTimer.current)
        if (!userRef.current || !driveRef.current) return
        await pushCloud(stateRef.current)
      },
    }),
    [commit, dropCalendarTask, pushCloud, queueCalendarTask, schedulePush, state, syncCalendarNow, syncStatus, writeGoogleTasks],
  )

  return <StoreContext value={store}>{children}</StoreContext>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('StoreProvider がありません')
  return ctx
}
