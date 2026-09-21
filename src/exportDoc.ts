import {
  formatJa,
  formatMonth,
  formatWeekRange,
  monthDates,
  monthKey,
  weekDates,
  weekStart,
} from './dates'
import { dayAt, dayHasEntry, daysOn } from './selectors'
import type { DayRecord, State } from './types'

function block(title: string, body: string) {
  const text = body.trim()
  if (!text) return ''
  return `${title}\n${text}\n`
}

export function formatDayDoc(day: DayRecord) {
  if (day.skipped) {
    return `リフレクションパレット\n\n${formatJa(day.date)}\n\n書けなかった\n`
  }
  return [
    'リフレクションパレット',
    '',
    formatJa(day.date),
    '',
    block('自由に書く', day.note),
    block('やったこと', day.y),
    block('学んだこと', day.w),
    block('明日以降意識すること', day.t),
  ]
    .filter((line, i, all) => line !== '' || all[i - 1] !== '')
    .join('\n')
    .trim()
    .concat('\n')
}

export function formatWeekDoc(state: State, week: string) {
  const days = daysOn(state, weekDates(week))
  const note = state.weekNotes?.[week] ?? ''
  const body = days.map((day) => formatDayDoc(day).replace(/^リフレクションパレット\n\n/, '')).join('\n')
  return ['リフレクションパレット · 今週', formatWeekRange(week), '', block('今週の振り返り', note), body]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

export function formatMonthDoc(state: State, year: number, month: number) {
  const days = daysOn(state, monthDates(year, month))
  const note = state.monthNotes?.[monthKey(year, month)] ?? ''
  const body = days.map((day) => formatDayDoc(day).replace(/^リフレクションパレット\n\n/, '')).join('\n')
  return ['リフレクションパレット · 今月', formatMonth(year, month), '', block('今月の振り返り', note), body]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

export function formatAllDoc(state: State) {
  const dates = Object.keys(state.days)
    .filter((date) => dayHasEntry(dayAt(state, date)))
    .sort()
  if (dates.length === 0) return 'リフレクションパレット\n\nまだ振り返りがありません。\n'
  const weeks = [...new Set(dates.map((date) => weekStart(date)))].sort()
  const parts = weeks.map((week) => formatWeekDoc(state, week))
  return `リフレクションパレット\n\n${parts.join('\n')}`
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([`\uFEFF${text}`], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function docFilename(suffix: string) {
  return `リフレクションパレット-${suffix}.txt`
}

