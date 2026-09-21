import { useState } from 'react'
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
import { docFilename, formatMonthDoc, formatWeekDoc } from './exportDoc'
import { ExportActions } from './ExportActions'
import { SpeakableField } from './MicButton'
import { daysOn, digestOf, type DigestLine, type PeriodDigest } from './selectors'
import { useStore } from './store'
import { Button, Section } from './ui'

export function ReviewPage({ onOpenDay }: { onOpenDay: (date: string) => void }) {
  const { state, patchWeekNote, patchMonthNote, appendWeekNote, appendMonthNote } = useStore()
  const today = todayISO()
  const [week, setWeek] = useState(() => weekStart(today))
  const [month, setMonth] = useState(() => ({
    year: yearOf(today),
    month: monthOf(today),
  }))

  const weekDays = daysOn(state, weekDates(week))
  const monthDayList = daysOn(state, monthDates(month.year, month.month))
  const weekDigest = digestOf(weekDays)
  const monthDigest = digestOf(monthDayList)
  const thisWeek = weekStart(today)
  const thisMonth = { year: yearOf(today), month: monthOf(today) }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="kicker">日々の記入を束ねる</p>
          <h1>まとめ</h1>
          <p className="muted">今週と今月に書いたものを並べて、振り返りを足す。</p>
        </div>
      </div>

      <Section kicker="今週" title={formatWeekRange(week)} variant="panel" tone="indigo">
        <div className="date-nav">
          <Button variant="quiet" onClick={() => setWeek(addDays(week, -7))}>
            前の週
          </Button>
          {week === thisWeek ? null : (
            <Button variant="quiet" onClick={() => setWeek(thisWeek)}>
              今週へ
            </Button>
          )}
          <Button variant="quiet" onClick={() => setWeek(addDays(week, 7))}>
            次の週
          </Button>
        </div>
        <Digest digest={weekDigest} empty="この週は、まだ日々の記入がない。" onOpenDay={onOpenDay} />
        <SpeakableField
          label="今週の振り返り"
          hint="上に並んだものから、残すことだけ書く。"
          multiline
          rows={5}
          value={state.weekNotes?.[week] ?? ''}
          placeholder="この週で、続けたいことと変えたいこと"
          onAppend={(text) => appendWeekNote(week, text)}
          onChange={(v) => patchWeekNote(week, v)}
        />
        <ExportActions text={formatWeekDoc(state, week)} filename={docFilename(`週-${week}`)} />
      </Section>

      <Section kicker="今月" title={formatMonth(month.year, month.month)} variant="panel" tone="gold">
        <div className="date-nav">
          <Button variant="quiet" onClick={() => setMonth(prevMonth(month.year, month.month))}>
            前の月
          </Button>
          {month.year === thisMonth.year && month.month === thisMonth.month ? null : (
            <Button variant="quiet" onClick={() => setMonth(thisMonth)}>
              今月へ
            </Button>
          )}
          <Button variant="quiet" onClick={() => setMonth(nextMonth(month.year, month.month))}>
            次の月
          </Button>
        </div>
        <Digest digest={monthDigest} empty="この月は、まだ日々の記入がない。" onOpenDay={onOpenDay} />
        <SpeakableField
          label="今月の振り返り"
          hint="週の積み重ねから、今月いちばん残ることを。"
          multiline
          rows={5}
          value={state.monthNotes?.[monthKey(month.year, month.month)] ?? ''}
          placeholder="この月で、続けたいことと変えたいこと"
          onAppend={(text) => appendMonthNote(monthKey(month.year, month.month), text)}
          onChange={(v) => patchMonthNote(monthKey(month.year, month.month), v)}
        />
        <ExportActions
          text={formatMonthDoc(state, month.year, month.month)}
          filename={docFilename(`月-${monthKey(month.year, month.month)}`)}
        />
      </Section>
    </div>
  )
}

function Digest({
  digest,
  empty,
  onOpenDay,
}: {
  digest: PeriodDigest
  empty: string
  onOpenDay: (date: string) => void
}) {
  const hasBody =
    digest.notes.length || digest.y.length || digest.w.length || digest.t.length || digest.skipped.length
  if (!hasBody) {
    return <p className="muted digest-empty">{empty}</p>
  }

  return (
    <div className="digest">
      <DigestCol label="メモ" lines={digest.notes} onOpenDay={onOpenDay} />
      <DigestCol label="やったこと" lines={digest.y} onOpenDay={onOpenDay} />
      <DigestCol label="学んだこと" lines={digest.w} onOpenDay={onOpenDay} />
      <DigestCol label="意識すること" lines={digest.t} onOpenDay={onOpenDay} />
      {digest.skipped.length ? (
        <p className="muted">
          書けなかった日：{digest.skipped.map((d) => formatShort(d)).join(' · ')}
        </p>
      ) : null}
    </div>
  )
}

function DigestCol({
  label,
  lines,
  onOpenDay,
}: {
  label: string
  lines: DigestLine[]
  onOpenDay: (date: string) => void
}) {
  if (lines.length === 0) return null
  return (
    <div className="digest-col">
      <h3>{label}</h3>
      <ul>
        {lines.map((line) => (
          <li key={`${label}-${line.date}-${line.text.slice(0, 12)}`}>
            <button type="button" className="digest-line" onClick={() => onOpenDay(line.date)}>
              <span>{formatShort(line.date)}</span>
              <span>{line.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
