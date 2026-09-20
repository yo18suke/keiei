import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  emptyState,
  type DayRecord,
  type HorizonReview,
  type State,
  type Status,
  type TomorrowGoal,
} from './types'

const KEY = 'keiei.v1'

function uid(): string {
  return crypto.randomUUID()
}

function emptyTomorrow(): TomorrowGoal {
  return {
    id: uid(),
    title: '',
    plan: '',
    monthGoalId: '',
    quarterGoalId: '',
  }
}

function emptyDay(date: string): DayRecord {
  return {
    date,
    focusIds: [],
    quarterGoalId: '',
    y: '',
    w: '',
    t: '',
    skipped: false,
    tomorrow: [emptyTomorrow(), emptyTomorrow(), emptyTomorrow()],
    promiseReview: {},
  }
}

function migrateDay(raw: Partial<DayRecord> & { date: string }): DayRecord {
  const day = { ...emptyDay(raw.date), ...raw }
  if (!Array.isArray(day.tomorrow) || day.tomorrow.length === 0) {
    day.tomorrow = [emptyTomorrow(), emptyTomorrow(), emptyTomorrow()]
    if (raw.t?.trim()) {
      day.tomorrow[0] = {
        ...day.tomorrow[0],
        title: raw.t,
        quarterGoalId: raw.quarterGoalId ?? '',
      }
    }
  }
  while (day.tomorrow.length < 3) day.tomorrow.push(emptyTomorrow())
  if (!day.promiseReview) day.promiseReview = {}
  return day
}

function migrateState(parsed: Partial<State>): State {
  const next = { ...emptyState(), ...parsed }
  if (!next.monthGoals) next.monthGoals = []
  const days: State['days'] = {}
  for (const [date, day] of Object.entries(next.days ?? {})) {
    days[date] = migrateDay(day)
  }
  next.days = days
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
  localStorage.setItem(KEY, JSON.stringify(state))
}

function emptyAction() {
  return {
    id: uid(),
    quarterGoalId: '',
    wish: '',
    outcome: '',
    obstacle: '',
    plan: '',
  }
}

type Store = {
  state: State
  replaceAll: (next: State) => void
  upsertYearGoal: (
    year: number,
    index: number,
    patch: { title?: string; intent?: string },
  ) => void
  upsertQuarterGoal: (
    year: number,
    quarter: number,
    index: number,
    patch: { title?: string; intent?: string; yearGoalId?: string },
  ) => void
  upsertMonthGoal: (
    year: number,
    month: number,
    index: number,
    patch: { title?: string; intent?: string; quarterGoalId?: string },
  ) => void
  patchWeekAction: (
    week: string,
    index: number,
    patch: Partial<{
      quarterGoalId: string
      wish: string
      outcome: string
      obstacle: string
      plan: string
    }>,
  ) => void
  ensureWeek: (week: string) => void
  ensureDay: (date: string) => void
  patchDay: (
    date: string,
    patch: Partial<{
      focusIds: string[]
      quarterGoalId: string
      y: string
      w: string
      t: string
      skipped: boolean
    }>,
  ) => void
  patchTomorrow: (
    date: string,
    index: number,
    patch: Partial<TomorrowGoal>,
  ) => void
  patchPromise: (date: string, promiseId: string, status: Status) => void
  toggleFocus: (date: string, actionId: string) => void
  patchReview: (
    week: string,
    patch: Partial<{ why: string; keep: string; statuses: Record<string, Status> }>,
  ) => void
  upsertHorizon: (input: Omit<HorizonReview, 'id'> & { id?: string }) => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load)

  const commit = useCallback((recipe: (draft: State) => void) => {
    setState((prev) => {
      const next = structuredClone(prev)
      recipe(next)
      persist(next)
      return next
    })
  }, [])

  const store = useMemo<Store>(
    () => ({
      state,
      replaceAll(next) {
        const migrated = migrateState(next)
        persist(migrated)
        setState(migrated)
      },
      upsertYearGoal(year, index, patch) {
        commit((s) => {
          const current = s.yearGoals.filter((g) => g.year === year)
          while (current.length <= index) {
            const g = { id: uid(), year, title: '', intent: '' }
            current.push(g)
            s.yearGoals.push(g)
          }
          Object.assign(current[index], patch)
        })
      },
      upsertQuarterGoal(year, quarter, index, patch) {
        commit((s) => {
          const current = s.quarterGoals.filter(
            (g) => g.year === year && g.quarter === quarter,
          )
          while (current.length <= index) {
            const g = {
              id: uid(),
              year,
              quarter,
              yearGoalId: '',
              title: '',
              intent: '',
            }
            current.push(g)
            s.quarterGoals.push(g)
          }
          Object.assign(current[index], patch)
        })
      },
      upsertMonthGoal(year, month, index, patch) {
        commit((s) => {
          const current = s.monthGoals.filter(
            (g) => g.year === year && g.month === month,
          )
          while (current.length <= index) {
            const g = {
              id: uid(),
              year,
              month,
              quarterGoalId: '',
              title: '',
              intent: '',
            }
            current.push(g)
            s.monthGoals.push(g)
          }
          Object.assign(current[index], patch)
        })
      },
      patchWeekAction(week, index, patch) {
        commit((s) => {
          if (!s.weeks[week]) {
            s.weeks[week] = {
              weekStart: week,
              actions: [emptyAction(), emptyAction(), emptyAction()],
            }
          }
          const plan = s.weeks[week]
          while (plan.actions.length <= index) plan.actions.push(emptyAction())
          Object.assign(plan.actions[index], patch)
        })
      },
      ensureWeek(week) {
        setState((prev) => {
          const existing = prev.weeks[week]
          if (existing && existing.actions.length >= 3) return prev
          const next = structuredClone(prev)
          if (!next.weeks[week]) {
            next.weeks[week] = {
              weekStart: week,
              actions: [emptyAction(), emptyAction(), emptyAction()],
            }
          }
          while (next.weeks[week].actions.length < 3) {
            next.weeks[week].actions.push(emptyAction())
          }
          persist(next)
          return next
        })
      },
      ensureDay(date) {
        setState((prev) => {
          const existing = prev.days[date]
          if (existing && existing.tomorrow?.length >= 3) return prev
          const next = structuredClone(prev)
          next.days[date] = migrateDay(existing ?? { date })
          persist(next)
          return next
        })
      },
      patchDay(date, patch) {
        commit((s) => {
          if (!s.days[date]) s.days[date] = emptyDay(date)
          Object.assign(s.days[date], patch)
        })
      },
      patchTomorrow(date, index, patch) {
        commit((s) => {
          if (!s.days[date]) s.days[date] = emptyDay(date)
          const day = s.days[date]
          while (day.tomorrow.length <= index) day.tomorrow.push(emptyTomorrow())
          Object.assign(day.tomorrow[index], patch)
          day.t = day.tomorrow
            .map((g) => g.title.trim())
            .filter(Boolean)
            .join(' / ')
          day.skipped = false
        })
      },
      patchPromise(date, promiseId, status) {
        commit((s) => {
          if (!s.days[date]) s.days[date] = emptyDay(date)
          s.days[date].promiseReview[promiseId] = status
          s.days[date].skipped = false
        })
      },
      toggleFocus(date, actionId) {
        commit((s) => {
          if (!s.days[date]) s.days[date] = emptyDay(date)
          const day = s.days[date]
          if (day.focusIds.includes(actionId)) {
            day.focusIds = day.focusIds.filter((id) => id !== actionId)
          } else if (day.focusIds.length < 3) {
            day.focusIds = [...day.focusIds, actionId]
          }
        })
      },
      patchReview(week, patch) {
        commit((s) => {
          if (!s.reviews[week]) {
            s.reviews[week] = { weekStart: week, why: '', keep: '', statuses: {} }
          }
          const r = s.reviews[week]
          if (patch.why !== undefined) r.why = patch.why
          if (patch.keep !== undefined) r.keep = patch.keep
          if (patch.statuses) r.statuses = { ...r.statuses, ...patch.statuses }
        })
      },
      upsertHorizon(input) {
        commit((s) => {
          const found = s.horizons.find((h) =>
            input.id
              ? h.id === input.id
              : h.kind === input.kind &&
                h.year === input.year &&
                h.quarter === input.quarter,
          )
          if (found) {
            found.wentWell = input.wentWell
            found.wentPoorly = input.wentPoorly
            found.workingToward = input.workingToward
          } else {
            s.horizons.push({
              id: input.id ?? uid(),
              kind: input.kind,
              year: input.year,
              quarter: input.quarter,
              wentWell: input.wentWell,
              wentPoorly: input.wentPoorly,
              workingToward: input.workingToward,
            })
          }
        })
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
