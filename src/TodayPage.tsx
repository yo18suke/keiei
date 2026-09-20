import { useEffect, useState } from 'react'
import {
  addDays,
  dateParts,
  formatMonth,
  isEvening,
  monthOf,
  nextMonth,
  quarterOf,
  todayISO,
  weekDates,
  weekStart,
  weekdayJa,
  yearOf,
} from './dates'
import {
  dayAt,
  filledMonthGoals,
  filledQuarterGoals,
  tomorrowGoalsOf,
} from './selectors'
import { useStore } from './store'
import { statusLabel, type MonthGoal, type QuarterGoal, type Status } from './types'
import { Button, Field, Section, Select } from './ui'

const STATUSES: Status[] = ['on', 'risk', 'off']

export function TodayPage({ onWeek, onGoals }: { onWeek: () => void; onGoals: () => void }) {
  const { state, patchDay, patchTomorrow, patchPromise, ensureDay } = useStore()
  const [date, setDate] = useState(todayISO)
  const week = weekStart(date)
  const day = dayAt(state, date)
  const yesterday = dayAt(state, addDays(date, -1))
  const promises = tomorrowGoalsOf(yesterday)
  const year = yearOf(date)
  const month = monthOf(date)
  const later = nextMonth(year, month)
  const quarters = filledQuarterGoals(state, year, quarterOf(date))
  const thisMonth = filledMonthGoals(state, year, month)
  const nextMonthGoals = filledMonthGoals(state, later.year, later.month)
  const evening = isEvening() && date === todayISO()
  const isToday = date === todayISO()
  const parts = dateParts(date)
  const tomorrowDate = addDays(date, 1)
  const tomorrowParts = dateParts(tomorrowDate)
  const monthOptions = [...thisMonth, ...nextMonthGoals].map((g) => ({
    value: g.id,
    label: g.title,
  }))

  useEffect(() => {
    ensureDay(date)
  }, [date, ensureDay])

  return (
    <div className="page">
      <div className="date-hero">
        <div>
          <p className="date-month">
            {parts.year} / {parts.month}
          </p>
          <p className="date-num">{parts.day}</p>
          <p className="date-week">
            {parts.weekday}曜日{isToday ? ' · 今日' : ''}
          </p>
        </div>
        <div className="date-hero-side">
          <div className="week-pulse" aria-label="今週の記録">
            {weekDates(week).map((d) => {
              const rec = dayAt(state, d)
              const filled = Boolean(
                rec.y || rec.w || tomorrowGoalsOf(rec).length,
              )
              const current = d === date
              return (
                <button
                  type="button"
                  key={d}
                  className={current ? 'pulse on' : 'pulse'}
                  onClick={() => setDate(d)}
                >
                  <span>{weekdayJa(d)}</span>
                  <i
                    className={
                      filled ? 'dot filled' : rec.skipped ? 'dot skipped' : 'dot'
                    }
                  />
                </button>
              )
            })}
          </div>
          <div className="date-nav">
            <Button variant="quiet" onClick={() => setDate(addDays(date, -1))}>
              前の日
            </Button>
            {isToday ? null : (
              <Button variant="quiet" onClick={() => setDate(todayISO())}>
                今日へ
              </Button>
            )}
            <Button variant="quiet" onClick={() => setDate(addDays(date, 1))}>
              次の日
            </Button>
          </div>
        </div>
      </div>

      {quarters.length === 0 ? (
        <div className="notice">
          四半期の到達点があると、明日の目標をそこに紐づけられます。{' '}
          <button type="button" className="text-link" onClick={onGoals}>
            目標を書く
          </button>
        </div>
      ) : null}

      <Section kicker="朝 · 今日やること" title="今日の約束" variant="panel">
        {promises.length === 0 ? (
          <p className="muted">
            昨夜の「明日の目標」がまだありません。下で振り返ったあと、明日の3つを書いてください。{' '}
            <button type="button" className="text-link" onClick={onWeek}>
              今週の計画を見る
            </button>
          </p>
        ) : (
          <ul className="focus-list">
            {promises.map((p) => (
              <li className="promise" key={p.id}>
                <strong>{p.title}</strong>
                {p.plan ? <em>{p.plan}</em> : null}
                <ParentLine
                  monthId={p.monthGoalId}
                  quarterId={p.quarterGoalId}
                  months={[...thisMonth, ...nextMonthGoals]}
                  quarters={quarters}
                />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        kicker={evening ? '夜 · いま振り返る' : '夜 · 今日の振り返り'}
        title="今日を閉じる"
        variant="night"
      >
        {promises.length > 0 ? (
          <div className="promise-review">
            <p className="field-label">今日の約束は、どうなったか</p>
            {promises.map((p) => (
              <div className="status-row" key={p.id}>
                <span>{p.title}</span>
                <div className="status-picks">
                  {STATUSES.map((st) => (
                    <button
                      type="button"
                      key={st}
                      className={
                        day.promiseReview[p.id] === st ? 'status on' : 'status'
                      }
                      onClick={() => patchPromise(date, p.id, st)}
                    >
                      {statusLabel[st]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <Field
          label="Y · やったこと"
          hint="目標に触れたことを先に。割り込みは後に。"
          multiline
          value={day.y}
          onChange={(v) => patchDay(date, { y: v, skipped: false })}
        />
        <Field
          label="W · わかったこと"
          hint="うまくいった理由も、外れた理由も。明日の目標の材料になる。"
          multiline
          value={day.w}
          onChange={(v) => patchDay(date, { w: v, skipped: false })}
        />
        <div className="row-actions">
          <Button
            variant="quiet"
            onClick={() =>
              patchDay(date, {
                skipped: true,
                y: day.y,
                w: day.w,
              })
            }
          >
            今日は書けなかった
          </Button>
          {day.skipped ? (
            <span className="muted">履歴に「書けなかった」と残しています。</span>
          ) : null}
        </div>
      </Section>

      <Section
        kicker={`明日 · ${tomorrowParts.month}/${tomorrowParts.day}（${tomorrowParts.weekday}）`}
        title="明日の目標 · 3つ"
        variant="panel"
      >
        <p className="muted">
          四半期と、今月・1ヶ月後を見てから書く。紐づかないものは割り込みです。
        </p>
        {day.w.trim() ? (
          <p className="yesterday-t">今日わかったこと：{day.w}</p>
        ) : null}

        <div className="horizon-board">
          <HorizonCol
            label={`四半期 Q${quarterOf(date)}`}
            items={quarters.map((g) => g.title)}
            empty="四半期がまだない"
            onEmpty={onGoals}
          />
          <HorizonCol
            label={`今月 ${formatMonth(year, month)}`}
            items={thisMonth.map((g) => g.title)}
            empty="今月の到達点を書く"
            onEmpty={onGoals}
          />
          <HorizonCol
            label={`1ヶ月後 ${formatMonth(later.year, later.month)}`}
            items={nextMonthGoals.map((g) => g.title)}
            empty="1ヶ月後の到達点を書く"
            onEmpty={onGoals}
          />
        </div>

        {[0, 1, 2].map((i) => {
          const g = day.tomorrow[i]
          return (
            <article className="woop" key={g?.id ?? `tomorrow-${i}`}>
              <header className="woop-head">
                <span className="num">{String(i + 1).padStart(2, '0')}</span>
                <h3>明日の目標</h3>
              </header>
              <Field
                label="明日、何を成し遂げるか"
                placeholder="一文で。終わったと自分で言える形"
                value={g?.title ?? ''}
                onChange={(v) => patchTomorrow(date, i, { title: v })}
              />
              <div className="woop-grid">
                <Select
                  label="踏まえる月の目標"
                  allowEmpty="（割り込み）"
                  value={g?.monthGoalId ?? ''}
                  onChange={(v) => {
                    const monthGoal = [...thisMonth, ...nextMonthGoals].find(
                      (m) => m.id === v,
                    )
                    patchTomorrow(date, i, {
                      monthGoalId: v,
                      quarterGoalId:
                        monthGoal?.quarterGoalId || g?.quarterGoalId || '',
                    })
                  }}
                  options={monthOptions}
                />
                <Select
                  label="踏まえる四半期"
                  allowEmpty="（割り込み）"
                  value={g?.quarterGoalId ?? ''}
                  onChange={(v) => patchTomorrow(date, i, { quarterGoalId: v })}
                  options={quarters.map((q) => ({ value: q.id, label: q.title }))}
                />
              </div>
              <Field
                label="Plan · if-then"
                placeholder="もし 21時になったら、提案の下書きを30分する"
                value={g?.plan ?? ''}
                onChange={(v) => patchTomorrow(date, i, { plan: v })}
              />
            </article>
          )
        })}
      </Section>
    </div>
  )
}

function HorizonCol({
  label,
  items,
  empty,
  onEmpty,
}: {
  label: string
  items: string[]
  empty: string
  onEmpty: () => void
}) {
  return (
    <div className="horizon-col">
      <p className="goal-kicker">{label}</p>
      {items.length === 0 ? (
        <button type="button" className="text-link" onClick={onEmpty}>
          {empty}
        </button>
      ) : (
        <ul>
          {items.map((title, i) => (
            <li key={`${label}-${i}`}>{title}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ParentLine({
  monthId,
  quarterId,
  months,
  quarters,
}: {
  monthId: string
  quarterId: string
  months: MonthGoal[]
  quarters: QuarterGoal[]
}) {
  const month = months.find((g) => g.id === monthId)
  const quarter = quarters.find((g) => g.id === quarterId)
  if (!month && !quarter) return null
  return (
    <em>
      {[month?.title, quarter?.title].filter(Boolean).join(' · ')}
    </em>
  )
}
