import { daysBetween, parseISO, toISODate, weekdayNum, weekStart } from './dates'
import { asTaskLane, type TaskRepeat, type WorkTask } from './types'

const WEEKDAY_SET = new Set([0, 1, 2, 3, 4, 5, 6])

function isISO(raw: unknown): raw is string {
  return typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)
}

export function asTaskRepeat(raw: unknown): TaskRepeat | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const row = raw as Partial<TaskRepeat>
  const freq = row.freq
  if (freq !== 'daily' && freq !== 'weekly' && freq !== 'monthly') return undefined
  const interval = Math.max(1, Math.min(99, Math.round(Number(row.interval) || 1)))
  const weekdays = Array.isArray(row.weekdays)
    ? [...new Set(row.weekdays.filter((day) => WEEKDAY_SET.has(Number(day))).map(Number))].sort((a, b) => a - b)
    : undefined
  return {
    freq,
    interval,
    weekdays: freq === 'weekly' && weekdays && weekdays.length > 0 ? weekdays : undefined,
    until: isISO(row.until) ? row.until : undefined,
  }
}

export function dailyRepeat(): TaskRepeat {
  return { freq: 'daily', interval: 1 }
}

export function weeklyRepeat(weekday: number): TaskRepeat {
  return { freq: 'weekly', interval: 1, weekdays: [weekday] }
}

export function weekdaysRepeat(): TaskRepeat {
  return { freq: 'weekly', interval: 1, weekdays: [1, 2, 3, 4, 5] }
}

export function monthlyRepeat(): TaskRepeat {
  return { freq: 'monthly', interval: 1 }
}

function sameDays(a: number[] | undefined, b: number[]) {
  const left = [...(a ?? [])].sort((x, y) => x - y)
  return left.length === b.length && left.every((day, i) => day === b[i])
}

export type RepeatPreset = '' | 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'custom'

export function repeatPreset(repeat: TaskRepeat | undefined, start?: string): RepeatPreset {
  if (!repeat) return ''
  if (repeat.until) return 'custom'
  if (repeat.freq === 'daily' && repeat.interval === 1) return 'daily'
  if (repeat.freq === 'monthly' && repeat.interval === 1) return 'monthly'
  if (repeat.freq === 'weekly' && repeat.interval === 1) {
    if (sameDays(repeat.weekdays, [1, 2, 3, 4, 5])) return 'weekdays'
    const weekday = start ? weekdayNum(start) : repeat.weekdays?.[0]
    if (weekday !== undefined && sameDays(repeat.weekdays ?? [weekday], [weekday])) return 'weekly'
  }
  return 'custom'
}

export function presetRepeat(preset: Exclude<RepeatPreset, '' | 'custom'>, start: string): TaskRepeat {
  if (preset === 'daily') return dailyRepeat()
  if (preset === 'weekdays') return weekdaysRepeat()
  if (preset === 'monthly') return monthlyRepeat()
  return weeklyRepeat(weekdayNum(start))
}

function monthOccurrence(start: string, date: string) {
  const from = parseISO(start)
  const to = parseISO(date)
  const last = new Date(to.getFullYear(), to.getMonth() + 1, 0).getDate()
  const day = Math.min(from.getDate(), last)
  return toISODate(new Date(to.getFullYear(), to.getMonth(), day))
}

function monthsBetween(from: string, to: string) {
  const a = parseISO(from)
  const b = parseISO(to)
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
}

export function matchesRepeat(repeat: TaskRepeat, start: string, date: string) {
  if (date < start) return false
  if (repeat.until && date > repeat.until) return false
  if (repeat.freq === 'daily') return daysBetween(start, date) % repeat.interval === 0
  if (repeat.freq === 'weekly') {
    const days = repeat.weekdays?.length ? repeat.weekdays : [weekdayNum(start)]
    if (!days.includes(weekdayNum(date))) return false
    const weeks = Math.round(daysBetween(weekStart(start), weekStart(date)) / 7)
    return weeks % repeat.interval === 0
  }
  if (monthsBetween(start, date) % repeat.interval !== 0) return false
  return date === monthOccurrence(start, date)
}

export function occursOn(task: WorkTask, date: string) {
  if (!isISO(date)) return false
  if (!task.repeat) return task.scheduledOn === date
  if (asTaskLane(task.lane) === 'done') {
    return (task.doneDates ?? []).includes(date) || task.doneAt === date
  }
  const start = task.scheduledOn
  if (!start) return false
  return matchesRepeat(task.repeat, start, date)
}

export function isDoneOn(task: WorkTask, date: string) {
  if (task.repeat) return (task.doneDates ?? []).includes(date)
  return asTaskLane(task.lane) === 'done'
}

const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'] as const

export function repeatLabel(repeat: TaskRepeat | undefined, start?: string) {
  if (!repeat) return ''
  const unit =
    repeat.freq === 'daily' ? '日' : repeat.freq === 'weekly' ? '週' : '月'
  const every = repeat.interval === 1 ? `毎${unit}` : `${repeat.interval}${unit}ごと`
  let body = every
  if (repeat.freq === 'weekly') {
    const days = repeat.weekdays?.length ? repeat.weekdays : start ? [weekdayNum(start)] : []
    if (sameDays(days, [1, 2, 3, 4, 5])) body = repeat.interval === 1 ? '平日' : `${repeat.interval}週ごとの平日`
    else if (days.length) body = `${every} ${days.map((day) => WEEKDAY_LABEL[day]).join('・')}`
  }
  if (repeat.until) {
    const [, m, d] = repeat.until.split('-')
    body += `〜${Number(m)}/${Number(d)}`
  }
  return body
}
