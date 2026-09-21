import type { DayRecord, State } from './types'

export function emptyDay(date: string): DayRecord {
  return { date, note: '', y: '', w: '', t: '', skipped: false }
}

export function dayAt(state: State, date: string): DayRecord {
  const raw = state.days[date]
  if (!raw) return emptyDay(date)
  return {
    ...emptyDay(date),
    ...raw,
    note: raw.note ?? '',
    y: raw.y ?? '',
    w: raw.w ?? '',
    t: raw.t ?? '',
  }
}

export function dayHasEntry(day: DayRecord) {
  return Boolean(
    (day.note ?? '').trim() ||
      (day.y ?? '').trim() ||
      (day.w ?? '').trim() ||
      (day.t ?? '').trim() ||
      day.skipped,
  )
}

export type DigestLine = {
  date: string
  text: string
}

export type PeriodDigest = {
  notes: DigestLine[]
  y: DigestLine[]
  w: DigestLine[]
  t: DigestLine[]
  skipped: string[]
}

export function daysOn(state: State, dates: string[]) {
  return dates.map((date) => dayAt(state, date)).filter(dayHasEntry)
}

export function digestOf(days: DayRecord[]): PeriodDigest {
  const notes: DigestLine[] = []
  const y: DigestLine[] = []
  const w: DigestLine[] = []
  const t: DigestLine[] = []
  const skipped: string[] = []
  for (const day of days) {
    if (day.skipped) skipped.push(day.date)
    if (day.note.trim()) notes.push({ date: day.date, text: day.note })
    if (day.y.trim()) y.push({ date: day.date, text: day.y })
    if (day.w.trim()) w.push({ date: day.date, text: day.w })
    if (day.t.trim()) t.push({ date: day.date, text: day.t })
  }
  return { notes, y, w, t, skipped }
}
