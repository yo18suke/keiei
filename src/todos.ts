import { addDays } from './dates'
import { asTaskLane, type WorkTask } from './types'

export function isISODate(raw: unknown): raw is string {
  return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)
}

export function asDateList(raw: unknown, extra?: string) {
  const next = new Set<string>()
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (isISODate(item)) next.add(item)
    }
  }
  if (extra && isISODate(extra)) next.add(extra)
  return [...next].sort()
}

export function plannedDatesOf(task: WorkTask) {
  if (task.plannedDates?.length) return task.plannedDates
  return task.scheduledOn ? [task.scheduledOn] : []
}

export function plannedOn(task: WorkTask, date: string) {
  return plannedDatesOf(task).includes(date)
}

export function tasksPlacedOn(tasks: WorkTask[], date: string) {
  return tasks.filter((task) => task.scheduledOn === date)
}

export function openOn(tasks: WorkTask[], date: string) {
  return tasksPlacedOn(tasks, date).filter((task) => asTaskLane(task.lane) !== 'done')
}

export function dayTodoStats(tasks: WorkTask[], date: string) {
  const planned = tasks.filter((task) => plannedOn(task, date))
  const done = planned.filter((task) => task.doneAt === date)
  const total = planned.length
  const percent = total === 0 ? 0 : Math.round((done.length / total) * 100)
  return { total, done: done.length, open: total - done.length, percent }
}

export function nextOpenDay(date: string) {
  return addDays(date, 1)
}
