export type DayRecord = {
  date: string
  note: string
  y: string
  w: string
  t: string
  skipped: boolean
}

export type TaskLane = 'progress' | 'open' | 'done'

export function asTaskLane(raw: unknown): TaskLane {
  if (raw === 'today' || raw === 'progress') return 'progress'
  if (raw === 'done') return 'done'
  return 'open'
}

export type WorkCase = {
  id: string
  name: string
  color: string
  doneAt?: string
}

export const CASE_COLORS = ['#f06a6a', '#796eff', '#25aa61', '#f4b942', '#2b9eb3'] as const

const LEGACY_CASE_COLORS: Record<string, string> = {
  '#e07a5f': '#f06a6a',
  '#c45cce': '#796eff',
  '#6d6e6f': '#2b9eb3',
}

export const CASE_COLOR_LABEL: Record<(typeof CASE_COLORS)[number], string> = {
  '#f06a6a': 'コーラル',
  '#796eff': 'インディゴ',
  '#25aa61': 'グリーン',
  '#f4b942': 'ゴールド',
  '#2b9eb3': 'ティール',
}

export function asCaseColor(raw: unknown, fallback: string = CASE_COLORS[0]) {
  if (typeof raw !== 'string') return fallback
  const mapped = LEGACY_CASE_COLORS[raw] ?? raw
  return (CASE_COLORS as readonly string[]).includes(mapped) ? mapped : fallback
}

export function nextCaseColor(cases: WorkCase[]) {
  const used = new Set(cases.map((row) => row.color))
  return CASE_COLORS.find((color) => !used.has(color)) ?? CASE_COLORS[cases.length % CASE_COLORS.length]
}

export type WorkTask = {
  id: string
  caseId: string
  title: string
  lane: TaskLane
  doneAt?: string
  scheduledOn?: string
  plannedDates: string[]
}

export type State = {
  days: Record<string, DayRecord>
  weekNotes: Record<string, string>
  monthNotes: Record<string, string>
  cases: WorkCase[]
  tasks: WorkTask[]
}

export const emptyState = (): State => ({
  days: {},
  weekNotes: {},
  monthNotes: {},
  cases: [],
  tasks: [],
})
