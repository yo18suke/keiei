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
}

export const CASE_COLORS = [
  '#f06a6a',
  '#796eff',
  '#25aa61',
  '#f4b942',
  '#2b9eb3',
  '#e07a5f',
  '#c45cce',
  '#6d6e6f',
] as const

export function asCaseColor(raw: unknown, fallback: string = CASE_COLORS[0]) {
  return typeof raw === 'string' && (CASE_COLORS as readonly string[]).includes(raw)
    ? raw
    : fallback
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
