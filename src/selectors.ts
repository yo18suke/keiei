import type { DayRecord, HorizonReview, State, TomorrowGoal } from './types'
import { monthOf, quarterOf, todayISO, yearOf } from './dates'

export function yearGoalsAt(state: State, year: number) {
  return state.yearGoals.filter((g) => g.year === year).slice(0, 3)
}

export function quarterGoalsAt(state: State, year: number, quarter: number) {
  return state.quarterGoals
    .filter((g) => g.year === year && g.quarter === quarter)
    .slice(0, 3)
}

export function monthGoalsAt(state: State, year: number, month: number) {
  return state.monthGoals
    .filter((g) => g.year === year && g.month === month)
    .slice(0, 3)
}

export function weekPlanAt(state: State, week: string) {
  return (
    state.weeks[week] ?? {
      weekStart: week,
      actions: [],
    }
  )
}

export function dayAt(state: State, date: string): DayRecord {
  return (
    state.days[date] ?? {
      date,
      focusIds: [],
      quarterGoalId: '',
      y: '',
      w: '',
      t: '',
      skipped: false,
      tomorrow: [],
      promiseReview: {},
    }
  )
}

export function reviewAt(state: State, week: string) {
  return (
    state.reviews[week] ?? {
      weekStart: week,
      why: '',
      keep: '',
      statuses: {},
    }
  )
}

export function horizonAt(
  state: State,
  kind: HorizonReview['kind'],
  year: number,
  quarter: number | null,
) {
  return (
    state.horizons.find(
      (h) => h.kind === kind && h.year === year && h.quarter === quarter,
    ) ?? {
      id: '',
      kind,
      year,
      quarter,
      wentWell: '',
      wentPoorly: '',
      workingToward: '',
    }
  )
}

export function filledYearGoals(state: State, year = yearOf(todayISO())) {
  return yearGoalsAt(state, year).filter((g) => g.title.trim())
}

export function filledQuarterGoals(
  state: State,
  year = yearOf(todayISO()),
  quarter = quarterOf(todayISO()),
) {
  return quarterGoalsAt(state, year, quarter).filter((g) => g.title.trim())
}

export function filledMonthGoals(
  state: State,
  year = yearOf(todayISO()),
  month = monthOf(todayISO()),
) {
  return monthGoalsAt(state, year, month).filter((g) => g.title.trim())
}

export function filledActions(state: State, week: string) {
  return weekPlanAt(state, week).actions.filter((a) => a.wish.trim())
}

export function tomorrowGoalsOf(day: DayRecord): TomorrowGoal[] {
  const slots = day.tomorrow ?? []
  const filled = slots.filter((g) => g.title.trim())
  if (filled.length) return filled
  if (day.t.trim()) {
    return [
      {
        id: 'legacy',
        title: day.t,
        plan: '',
        monthGoalId: '',
        quarterGoalId: day.quarterGoalId,
      },
    ]
  }
  return []
}

export function dayHasEntry(day: DayRecord) {
  return Boolean(
    day.y || day.w || day.skipped || tomorrowGoalsOf(day).length,
  )
}
