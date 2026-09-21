import { useMemo, useState } from 'react'
import {
  addDays,
  formatMonth,
  formatShort,
  formatWeekRange,
  monthDates,
  monthKey,
  monthOf,
  nextMonth,
  prevMonth,
  todayISO,
  weekDates,
  weekStart,
  yearOf,
} from './dates'
import { docFilename, formatAllDoc, formatDayDoc, formatMonthDoc, formatWeekDoc } from './exportDoc'
import { ExportActions } from './ExportActions'
import { dayAt, dayHasEntry } from './selectors'
import { useStore } from './store'
import { Button } from './ui'

type Span = 'day' | 'week' | 'month' | 'all'

const SPANS: { id: Span; label: string }[] = [
  { id: 'day', label: '今日' },
  { id: 'week', label: '1週間' },
  { id: 'month', label: '1ヶ月' },
  { id: 'all', label: 'すべて' },
]

function weekKeys(dates: string[]) {
  return [...new Set(dates.map((date) => weekStart(date)))].sort((a, b) => (a < b ? 1 : -1))
}

export function HistoryPage({ onOpenDay }: { onOpenDay: (date: string) => void }) {
  const { state, replaceArchive } = useStore()
  const today = todayISO()
  const thisWeek = weekStart(today)
  const thisMonth = { year: yearOf(today), month: monthOf(today) }

  const [span, setSpan] = useState<Span>('month')
  const [week, setWeek] = useState(thisWeek)
  const [month, setMonth] = useState(thisMonth)

  const allWeeks = useMemo(() => {
    const keys = new Set<string>()
    Object.keys(state.days).forEach((d) => keys.add(weekStart(d)))
    keys.add(thisWeek)
    return [...keys].sort((a, b) => (a < b ? 1 : -1))
  }, [state.days, thisWeek])

  const monthDateList = monthDates(month.year, month.month)
  const weekDateList = weekDates(week)
  const dayDateList = [today]
  const allowDates =
    span === 'day' ? dayDateList : span === 'week' ? weekDateList : span === 'month' ? monthDateList : undefined
  const weeks =
    span === 'day' ? weekKeys(dayDateList) : span === 'week' ? [week] : span === 'month' ? weekKeys(monthDateList) : allWeeks

  const filled = Object.values(state.days).filter(dayHasEntry).length
  const filledInView = allowDates
    ? allowDates.filter((date) => dayHasEntry(dayAt(state, date))).length
    : filled

  const exportText =
    span === 'day'
      ? formatDayDoc(dayAt(state, today))
      : span === 'week'
        ? formatWeekDoc(state, week)
        : span === 'month'
          ? formatMonthDoc(state, month.year, month.month)
          : formatAllDoc(state)
  const exportName =
    span === 'day'
      ? docFilename(`日-${today}`)
      : span === 'week'
        ? docFilename(`週-${week}`)
        : span === 'month'
          ? docFilename(`月-${monthKey(month.year, month.month)}`)
          : docFilename(`すべて-${today}`)

  const periodLabel = span === 'week' ? formatWeekRange(week) : formatMonth(month.year, month.month)
  const canNext =
    span === 'week'
      ? week < thisWeek
      : month.year < thisMonth.year || (month.year === thisMonth.year && month.month < thisMonth.month)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="kicker">書いたものを見返す</p>
          <h1>履歴</h1>
          <p className="muted">{filledInView ? `${filledInView}日分` : 'まだ振り返りがない'}</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-tabs" role="tablist" aria-label="期間">
          {SPANS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={span === item.id}
              className={span === item.id ? 'filter-tab on' : 'filter-tab'}
              onClick={() => setSpan(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {span === 'week' || span === 'month' ? (
          <div className="period-nav">
            <Button
              variant="quiet"
              onClick={() => {
                if (span === 'week') setWeek(addDays(week, -7))
                else setMonth(prevMonth(month.year, month.month))
              }}
            >
              {span === 'week' ? '前の週' : '前の月'}
            </Button>
            <p className="period-label">{periodLabel}</p>
            {canNext ? (
              <Button
                variant="quiet"
                onClick={() => {
                  if (span === 'week') setWeek(addDays(week, 7))
                  else setMonth(nextMonth(month.year, month.month))
                }}
              >
                {span === 'week' ? '次の週' : '次の月'}
              </Button>
            ) : null}
          </div>
        ) : null}

        <ExportActions text={exportText} filename={exportName} />

        {span === 'all' ? (
          <div className="row-actions">
            <Button
              variant="quiet"
              onClick={() => {
                const blob = new Blob(
                  [
                    JSON.stringify(
                      {
                        days: state.days,
                        weekNotes: state.weekNotes,
                        monthNotes: state.monthNotes,
                        cases: state.cases,
                        tasks: state.tasks,
                      },
                      null,
                      2,
                    ),
                  ],
                  { type: 'application/json' },
                )
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `リフレクションパレット-${today}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              JSONを書き出す
            </Button>
            <label className="btn btn-plain file-btn">
              JSONを読み込む
              <input
                type="file"
                accept="application/json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    try {
                      const parsed = JSON.parse(String(reader.result)) as Partial<typeof state>
                      if (!parsed.days) {
                        window.alert('日々の記録がありません')
                        return
                      }
                      replaceArchive(parsed)
                    } catch {
                      window.alert('読み込めませんでした')
                    }
                  }
                  reader.readAsText(file)
                  e.target.value = ''
                }}
              />
            </label>
          </div>
        ) : null}
      </div>

      {filledInView === 0 ? (
        <p className="muted">
          {span === 'day'
            ? '今日は、まだ振り返りがない。'
            : span === 'week'
              ? 'この週は、まだ振り返りがない。'
              : span === 'month'
                ? 'この月は、まだ振り返りがない。'
                : '今日の振り返りを書くと、ここに溜まっていく。'}
        </p>
      ) : null}

      {weeks.map((w) => (
        <WeekBlock key={w} week={w} allowDates={allowDates} onOpenDay={onOpenDay} />
      ))}
    </div>
  )
}

function WeekBlock({
  week,
  allowDates,
  onOpenDay,
}: {
  week: string
  allowDates?: string[]
  onOpenDay: (date: string) => void
}) {
  const { state } = useStore()
  const days = weekDates(week).map((d) => dayAt(state, d))
  const entries = days
    .filter(dayHasEntry)
    .filter((d) => !allowDates || allowDates.includes(d.date))
  if (entries.length === 0) return null

  return (
    <section className="history-week">
      <header>
        <h2>{formatWeekRange(week)}</h2>
        <p>{entries.length}日</p>
      </header>
      <ul className="history-days">
        {entries.map((d) => (
          <li key={d.date}>
            <button type="button" className="history-day" onClick={() => onOpenDay(d.date)}>
              <p className="kicker">{formatShort(d.date)}</p>
              {d.skipped ? (
                <p className="muted">書けなかった</p>
              ) : (
                <>
                  {d.note ? <p>{d.note}</p> : null}
                  {d.y ? <p>Y {d.y}</p> : null}
                  {d.w ? <p>W {d.w}</p> : null}
                  {d.t ? <p>T {d.t}</p> : null}
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
