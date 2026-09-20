export type Status = 'on' | 'risk' | 'off'

export type YearGoal = {
  id: string
  year: number
  title: string
  intent: string
}

export type QuarterGoal = {
  id: string
  year: number
  quarter: number
  yearGoalId: string
  title: string
  intent: string
}

export type MonthGoal = {
  id: string
  year: number
  month: number
  quarterGoalId: string
  title: string
  intent: string
}

export type WeekAction = {
  id: string
  quarterGoalId: string
  wish: string
  outcome: string
  obstacle: string
  plan: string
}

export type WeekPlan = {
  weekStart: string
  actions: WeekAction[]
}

export type TomorrowGoal = {
  id: string
  title: string
  plan: string
  monthGoalId: string
  quarterGoalId: string
}

export type DayRecord = {
  date: string
  focusIds: string[]
  quarterGoalId: string
  y: string
  w: string
  t: string
  skipped: boolean
  tomorrow: TomorrowGoal[]
  promiseReview: Record<string, Status>
}

export type WeekReview = {
  weekStart: string
  why: string
  keep: string
  statuses: Record<string, Status>
}

export type HorizonReview = {
  id: string
  kind: 'year' | 'quarter'
  year: number
  quarter: number | null
  wentWell: string
  wentPoorly: string
  workingToward: string
}

export type State = {
  yearGoals: YearGoal[]
  quarterGoals: QuarterGoal[]
  monthGoals: MonthGoal[]
  weeks: Record<string, WeekPlan>
  days: Record<string, DayRecord>
  reviews: Record<string, WeekReview>
  horizons: HorizonReview[]
}

export const emptyState = (): State => ({
  yearGoals: [],
  quarterGoals: [],
  monthGoals: [],
  weeks: {},
  days: {},
  reviews: {},
  horizons: [],
})

export const statusLabel: Record<Status, string> = {
  on: '進んだ',
  risk: '停滞',
  off: 'やらなかった',
}

export const quarterStatusLabel: Record<Status, string> = {
  on: '順調',
  risk: '危うい',
  off: '止まっている',
}
