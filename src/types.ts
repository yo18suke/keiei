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
}

export type WorkTask = {
  id: string
  caseId: string
  title: string
  lane: TaskLane
  doneAt?: string
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
