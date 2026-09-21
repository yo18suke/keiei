import { useMemo, useState } from 'react'
import {
  addDays,
  dateParts,
  formatJa,
  formatMonth,
  formatShort,
  formatWeekRange,
  monthDates,
  monthGrid,
  monthKey,
  monthOf,
  nextMonth,
  prevMonth,
  todayISO,
  weekDates,
  WEEKDAYS_MON,
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
  { id: 'day', label: '1日' },
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

  const [span, setSpan] = useState<Span>('day')
  const [calOpen, setCalOpen] = useState(false)
  const [selected, setSelected] = useState(today)
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
  const dayDateList = [selected]
  const allowDates =
    span === 'day' ? dayDateList : span === 'week' ? weekDateList : span === 'month' ? monthDateList : undefined
  const weeks =
    span === 'day' ? [] : span === 'week' ? [week] : span === 'month' ? weekKeys(monthDateList) : allWeeks

  const filled = Object.values(state.days).filter(dayHasEntry).length
  const filledInView = allowDates
    ? allowDates.filter((date) => dayHasEntry(dayAt(state, date))).length
    : filled
  const selectedDay = dayAt(state, selected)
  const selectedHasEntry = dayHasEntry(selectedDay)

  const exportText =
    span === 'day'
      ? formatDayDoc(selectedDay)
      : span === 'week'
        ? formatWeekDoc(state, week)
        : span === 'month'
          ? formatMonthDoc(state, month.year, month.month)
          : formatAllDoc(state)
  const exportName =
    span === 'day'
      ? docFilename(`日-${selected}`)
      : span === 'week'
        ? docFilename(`週-${week}`)
        : span === 'month'
          ? docFilename(`月-${monthKey(month.year, month.month)}`)
          : docFilename(`すべて-${today}`)

  const periodLabel = span === 'week' ? formatWeekRange(week) : formatMonth(month.year, month.month)
  const canNextWeek = week < thisWeek
  const canNextMonth =
    month.year < thisMonth.year || (month.year === thisMonth.year && month.month < thisMonth.month)
  const canNext = span === 'week' ? canNextWeek : canNextMonth

  function pickDate(date: string) {
    setSelected(date)
    setWeek(weekStart(date))
    setMonth({ year: yearOf(date), month: monthOf(date) })
    setSpan('day')
  }

  function shiftMonth(next: { year: number; month: number }) {
    setMonth(next)
    const dates = monthDates(next.year, next.month)
    const inMonth = dates.includes(selected)
    if (!inMonth) {
      const fallback = dates.includes(today) ? today : dates[dates.length - 1]
      setSelected(fallback)
      setWeek(weekStart(fallback))
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="kicker">書いたものを見返す</p>
          <h1>履歴</h1>
          <p className="muted">{filledInView ? `${filledInView}日分` : 'まだ振り返りがない'}</p>
        </div>
      </div>

      {calOpen ? (
        <section className="section section-panel history-cal tone-indigo" aria-label="日付を選ぶ">
          <header className="section-head">
            <p className="kicker">カレンダー</p>
            <div className="section-title-row">
              <h2>{formatMonth(month.year, month.month)}</h2>
              <div className="period-nav">
                <Button variant="quiet" onClick={() => shiftMonth(prevMonth(month.year, month.month))}>
                  前の月
                </Button>
                {selected !== today || month.year !== thisMonth.year || month.month !== thisMonth.month ? (
                  <Button variant="quiet" onClick={() => pickDate(today)}>
                    今日
                  </Button>
                ) : null}
                {canNextMonth ? (
                  <Button variant="quiet" onClick={() => shiftMonth(nextMonth(month.year, month.month))}>
                    次の月
                  </Button>
                ) : null}
                <Button variant="quiet" onClick={() => setCalOpen(false)}>
                  閉じる
                </Button>
              </div>
            </div>
          </header>
          <div className="history-cal-grid">
            {WEEKDAYS_MON.map((label) => (
              <p key={label} className="history-cal-dow">
                {label}
              </p>
            ))}
            {monthGrid(month.year, month.month).map((date) => {
              const parts = dateParts(date)
              const inMonth = parts.year === month.year && parts.month === month.month
              const has = dayHasEntry(dayAt(state, date))
              const isToday = date === today
              const on = date === selected
              const cls = [
                'history-cal-day',
                inMonth ? '' : 'out',
                has ? 'has' : '',
                isToday ? 'today' : '',
                on ? 'on' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button
                  key={date}
                  type="button"
                  className={cls}
                  aria-pressed={on}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${formatJa(date)}${has ? '、振り返りあり' : ''}`}
                  onClick={() => pickDate(date)}
                >
                  <span>{parts.day}</span>
                  <i className="history-cal-dot" aria-hidden />
                </button>
              )
            })}
          </div>
        </section>
      ) : (
        <button
          type="button"
          className="history-cal-toggle"
          aria-expanded={false}
          onClick={() => setCalOpen(true)}
        >
          <span>
            <strong>カレンダー</strong>
            <span className="muted"> {formatJa(selected)}</span>
          </span>
          <span>開く</span>
        </button>
      )}

      <section className="history-week history-picked">
        <header>
          <h2>{formatJa(selected)}</h2>
          <Button variant="quiet" onClick={() => onOpenDay(selected)}>
            {selectedHasEntry ? 'この日を開く' : 'この日を書く'}
          </Button>
        </header>
        {selectedHasEntry ? (
          <DayReflection day={selectedDay} />
        ) : (
          <p className="muted">この日は、まだ振り返りがない。</p>
        )}
      </section>

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
                if (span === 'week') {
                  const next = addDays(week, -7)
                  setWeek(next)
                  setMonth({ year: yearOf(next), month: monthOf(next) })
                } else shiftMonth(prevMonth(month.year, month.month))
              }}
            >
              {span === 'week' ? '前の週' : '前の月'}
            </Button>
            <p className="period-label">{periodLabel}</p>
            {canNext ? (
              <Button
                variant="quiet"
                onClick={() => {
                  if (span === 'week') {
                    const next = addDays(week, 7)
                    setWeek(next)
                    setMonth({ year: yearOf(next), month: monthOf(next) })
                  } else shiftMonth(nextMonth(month.year, month.month))
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

      {span === 'day' ? null : filledInView === 0 ? (
        <p className="muted">
          {span === 'week'
            ? 'この週は、まだ振り返りがない。'
            : span === 'month'
              ? 'この月は、まだ振り返りがない。'
              : '今日の振り返りを書くと、ここに溜まっていく。'}
        </p>
      ) : null}

      {weeks.map((w) => (
        <WeekBlock key={w} week={w} allowDates={allowDates} selected={selected} onOpenDay={onOpenDay} />
      ))}
    </div>
  )
}

function asItems(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return []
  const parts = trimmed
    .split(/\n+|・/)
    .map((part) => part.replace(/^[\s・•●\-]+/, '').trim())
    .filter(Boolean)
  return parts.length > 1 ? parts : [trimmed]
}

function HistoryBlock({
  title,
  text,
  tone,
  prose,
}: {
  title: string
  text: string
  tone: 'coral' | 'indigo' | 'green' | 'gold'
  prose?: boolean
}) {
  const body = text.trim()
  if (!body) return null
  const items = prose ? [body] : asItems(body)
  return (
    <div className={`history-block tone-${tone}`}>
      <h3>{title}</h3>
      {items.length === 1 ? (
        <p>{items[0]}</p>
      ) : (
        <ul className="history-items">
          {items.map((item, i) => (
            <li key={`${title}-${i}`}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DayReflection({ day }: { day: ReturnType<typeof dayAt> }) {
  if (day.skipped) return <p className="muted">書けなかった</p>
  return (
    <div className="history-entry-body">
      <HistoryBlock title="メモ" text={day.note} tone="coral" prose />
      <HistoryBlock title="やったこと" text={day.y} tone="green" />
      <HistoryBlock title="学んだこと" text={day.w} tone="indigo" />
      <HistoryBlock title="意識すること" text={day.t} tone="gold" />
    </div>
  )
}

function WeekBlock({
  week,
  allowDates,
  selected,
  onOpenDay,
}: {
  week: string
  allowDates?: string[]
  selected?: string
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
          <li key={d.date} className={d.date === selected ? 'history-entry on' : 'history-entry'}>
            <div className="history-entry-head">
              <h3>{formatShort(d.date)}</h3>
              <Button variant="quiet" onClick={() => onOpenDay(d.date)}>
                この日を開く
              </Button>
            </div>
            <DayReflection day={d} />
          </li>
        ))}
      </ul>
    </section>
  )
}
