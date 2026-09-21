const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function weekStart(iso: string): string {
  const d = parseISO(iso)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toISODate(d)
}

export function weekDates(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function quarterOf(iso: string): number {
  return Math.floor(parseISO(iso).getMonth() / 3) + 1
}

export function yearOf(iso: string): number {
  return parseISO(iso).getFullYear()
}

export function weekdayJa(iso: string): string {
  return WEEKDAYS[parseISO(iso).getDay()]
}

export function formatJa(iso: string): string {
  const d = parseISO(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekdayJa(iso)}）`
}

export function formatShort(iso: string): string {
  const d = parseISO(iso)
  return `${d.getMonth() + 1}/${d.getDate()}（${weekdayJa(iso)}）`
}

export function formatWeekRange(start: string): string {
  const end = addDays(start, 6)
  const a = parseISO(start)
  const b = parseISO(end)
  return `${a.getMonth() + 1}/${a.getDate()}–${b.getMonth() + 1}/${b.getDate()}`
}

export function dateParts(iso: string) {
  const d = parseISO(iso)
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    weekday: weekdayJa(iso),
  }
}

export function monthOf(iso: string): number {
  return parseISO(iso).getMonth() + 1
}

export function nextMonth(year: number, month: number) {
  if (month === 12) return { year: year + 1, month: 1 }
  return { year, month: month + 1 }
}

export function prevMonth(year: number, month: number) {
  if (month === 1) return { year: year - 1, month: 12 }
  return { year, month: month - 1 }
}

export function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

export function monthDates(year: number, month: number) {
  const dates: string[] = []
  let cursor = toISODate(new Date(year, month - 1, 1))
  while (yearOf(cursor) === year && monthOf(cursor) === month) {
    dates.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return dates
}

export function formatMonth(year: number, month: number): string {
  return `${year}年${month}月`
}

export function lastNDates(n: number, end = todayISO()): string[] {
  return Array.from({ length: n }, (_, i) => addDays(end, -(n - 1 - i)))
}

export function isEvening(now = new Date()): boolean {
  return now.getHours() >= 18
}
