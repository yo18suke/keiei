import { addDays } from './dates'
import { isDoneOn, occursOn } from './repeat'
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
  if (task.repeat) return occursOn(task, date)
  return plannedDatesOf(task).includes(date)
}

export function tasksPlacedOn(tasks: WorkTask[], date: string) {
  return tasks.filter((task) => occursOn(task, date))
}

export function isTaskDoneOn(task: WorkTask, date: string) {
  return isDoneOn(task, date)
}

export function openOn(tasks: WorkTask[], date: string) {
  return tasksPlacedOn(tasks, date).filter((task) => !isDoneOn(task, date) && !task.repeat)
}

export function dayTodoStats(tasks: WorkTask[], date: string) {
  const placed = tasksPlacedOn(tasks, date)
  const done = placed.filter((task) => isDoneOn(task, date))
  const total = placed.length
  const percent = total === 0 ? 0 : Math.round((done.length / total) * 100)
  return { total, done: done.length, open: total - done.length, percent }
}

export function weekTodoStats(tasks: WorkTask[], dates: string[]) {
  let total = 0
  let done = 0
  for (const date of dates) {
    const day = dayTodoStats(tasks, date)
    total += day.total
    done += day.done
  }
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return { total, done, open: total - done, percent }
}

export function nextOpenDay(date: string) {
  return addDays(date, 1)
}

export function caseTaskStats(tasks: WorkTask[], caseId: string) {
  const rows = tasks.filter((task) => task.caseId === caseId)
  const open = rows.filter((task) => asTaskLane(task.lane) === 'open').length
  const progress = rows.filter((task) => asTaskLane(task.lane) === 'progress').length
  const done = rows.filter((task) => asTaskLane(task.lane) === 'done').length
  const total = rows.length
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return { total, open, progress, done, percent }
}
