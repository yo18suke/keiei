import {
  formatJa,
  formatMonth,
  formatWeekRange,
  monthDates,
  monthKey,
  weekDates,
  weekStart,
} from './dates'
import { looksLikeList, parseListItems } from './lists'
import { dayAt, dayHasEntry, daysOn } from './selectors'
import type { DayRecord, State } from './types'

export type DocSpan =
  | { kind: 'title'; text: string }
  | { kind: 'kicker'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'label'; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'rule' }

function field(label: string, body: string): DocSpan[] {
  const text = body.trim()
  if (!text) return []
  if (looksLikeList(text)) {
    return [
      { kind: 'label', text: label },
      { kind: 'list', items: parseListItems(text) },
    ]
  }
  return [
    { kind: 'label', text: label },
    { kind: 'para', text },
  ]
}

function daySpans(day: DayRecord): DocSpan[] {
  if (day.skipped) {
    return [
      { kind: 'heading', text: formatJa(day.date) },
      { kind: 'para', text: '書けなかった' },
    ]
  }
  return [
    { kind: 'heading', text: formatJa(day.date) },
    ...field('自由に書く', day.note),
    ...field('やったこと', day.y),
    ...field('学んだこと', day.w),
    ...field('明日以降意識すること', day.t),
  ]
}

export function buildDayDoc(day: DayRecord): DocSpan[] {
  return [{ kind: 'title', text: 'リフレクションパレット' }, { kind: 'kicker', text: formatJa(day.date) }, ...daySpans(day).slice(1)]
}

export function buildWeekDoc(state: State, week: string): DocSpan[] {
  const days = daysOn(state, weekDates(week))
  const note = state.weekNotes?.[week] ?? ''
  const parts: DocSpan[] = [
    { kind: 'title', text: 'リフレクションパレット' },
    { kind: 'kicker', text: `今週 · ${formatWeekRange(week)}` },
    ...field('今週の振り返り', note),
  ]
  for (const day of days) {
    parts.push({ kind: 'rule' }, ...daySpans(day))
  }
  return parts
}

export function buildMonthDoc(state: State, year: number, month: number): DocSpan[] {
  const days = daysOn(state, monthDates(year, month))
  const note = state.monthNotes?.[monthKey(year, month)] ?? ''
  const parts: DocSpan[] = [
    { kind: 'title', text: 'リフレクションパレット' },
    { kind: 'kicker', text: `今月 · ${formatMonth(year, month)}` },
    ...field('今月の振り返り', note),
  ]
  for (const day of days) {
    parts.push({ kind: 'rule' }, ...daySpans(day))
  }
  return parts
}

export function buildAllDoc(state: State): DocSpan[] {
  const dates = Object.keys(state.days)
    .filter((date) => dayHasEntry(dayAt(state, date)))
    .sort()
  if (dates.length === 0) {
    return [
      { kind: 'title', text: 'リフレクションパレット' },
      { kind: 'para', text: 'まだ振り返りがありません。' },
    ]
  }
  const weeks = [...new Set(dates.map((date) => weekStart(date)))].sort()
  const parts: DocSpan[] = [{ kind: 'title', text: 'リフレクションパレット' }, { kind: 'kicker', text: 'これまでの振り返り' }]
  for (const week of weeks) {
    const inner = buildWeekDoc(state, week).filter((part) => part.kind !== 'title')
    parts.push({ kind: 'rule' }, ...inner)
  }
  return parts
}

export function renderDocText(parts: DocSpan[]) {
  const lines: string[] = []
  for (const part of parts) {
    if (part.kind === 'title') {
      lines.push(part.text, '')
      continue
    }
    if (part.kind === 'kicker') {
      lines.push(part.text, '')
      continue
    }
    if (part.kind === 'heading') {
      if (lines.length) lines.push('')
      lines.push(part.text, '')
      continue
    }
    if (part.kind === 'label') {
      lines.push(part.text)
      continue
    }
    if (part.kind === 'para') {
      lines.push(part.text, '')
      continue
    }
    if (part.kind === 'list') {
      for (const item of part.items) lines.push(`・${item}`)
      lines.push('')
      continue
    }
    lines.push('────────', '')
  }
  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`
}

export function formatDayDoc(day: DayRecord) {
  return renderDocText(buildDayDoc(day))
}

export function formatWeekDoc(state: State, week: string) {
  return renderDocText(buildWeekDoc(state, week))
}

export function formatMonthDoc(state: State, year: number, month: number) {
  return renderDocText(buildMonthDoc(state, year, month))
}

export function formatAllDoc(state: State) {
  return renderDocText(buildAllDoc(state))
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
