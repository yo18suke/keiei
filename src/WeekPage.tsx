import { useEffect, useState } from 'react'
import {
  addDays,
  formatJa,
  formatShort,
  formatWeekRange,
  quarterOf,
  todayISO,
  weekDates,
  weekStart,
  yearOf,
} from './dates'
import { dayAt, filledQuarterGoals, reviewAt } from './selectors'
import { useStore } from './store'
import { quarterStatusLabel, type Status } from './types'
import { Button, Field, Section, Select } from './ui'

const STATUSES: Status[] = ['on', 'risk', 'off']

export function WeekPage() {
  const { state, patchWeekAction, patchReview, ensureWeek } = useStore()
  const [anchor, setAnchor] = useState(weekStart(todayISO()))
  const next = addDays(anchor, 7)
  const dates = weekDates(anchor)
  const plan = state.weeks[anchor]
  const nextPlan = state.weeks[next]
  const review = reviewAt(state, anchor)
  const quarters = filledQuarterGoals(state, yearOf(anchor), quarterOf(anchor))
  const nextQuarters = filledQuarterGoals(state, yearOf(next), quarterOf(next))
  const quarterOptions = quarters.map((g) => ({ value: g.id, label: g.title }))
  const nextQuarterOptions = nextQuarters.map((g) => ({ value: g.id, label: g.title }))

  useEffect(() => {
    ensureWeek(anchor)
    ensureWeek(next)
  }, [anchor, ensureWeek, next])

  if (!plan || !nextPlan) {
    return (
      <div className="page">
        <p className="muted">週を開いています…</p>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-lead">
        <div>
          <p className="kicker">週次 · AAR と WOOP</p>
          <h1>{formatWeekRange(anchor)}</h1>
          <p className="muted">
            {formatJa(anchor)} から {formatJa(addDays(anchor, 6))}
          </p>
        </div>
        <div className="date-nav">
          <Button variant="quiet" onClick={() => setAnchor(addDays(anchor, -7))}>
            前の週
          </Button>
          <Button variant="quiet" onClick={() => setAnchor(weekStart(todayISO()))}>
            今週
          </Button>
          <Button variant="quiet" onClick={() => setAnchor(addDays(anchor, 7))}>
            次の週
          </Button>
        </div>
      </div>

      <Section kicker="週のはじめ · 15分" title="今週の3つ · WOOP" variant="panel">
        {plan.actions.map((a, i) => (
          <article className="woop" key={a.id}>
            <header className="woop-head">
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <h3>今週の行動</h3>
            </header>
            <Select
              label="親にする四半期目標"
              allowEmpty="選ぶ"
              value={a.quarterGoalId}
              onChange={(v) => patchWeekAction(anchor, i, { quarterGoalId: v })}
              options={quarterOptions}
            />
            <div className="woop-grid">
              <Field
                label="Wish"
                placeholder="今週、四半期のどれを動かすか"
                value={a.wish}
                onChange={(v) => patchWeekAction(anchor, i, { wish: v })}
              />
              <Field
                label="Outcome"
                placeholder="週末に、何が見えていれば進んだと言えるか"
                value={a.outcome}
                onChange={(v) => patchWeekAction(anchor, i, { outcome: v })}
              />
              <Field
                label="Obstacle"
                placeholder="現実の障害"
                value={a.obstacle}
                onChange={(v) => patchWeekAction(anchor, i, { obstacle: v })}
              />
              <Field
                label="Plan"
                hint="もし障害が出たら、こうする"
                placeholder="もし午前が案件で埋まったら、夜21時に30分だけ着手する"
                value={a.plan}
                onChange={(v) => patchWeekAction(anchor, i, { plan: v })}
              />
            </div>
          </article>
        ))}
      </Section>

      <Section kicker="材料" title="この週の YWT" variant="panel">
        <div className="ywt-table">
          <div className="ywt-head">
            <span>日</span>
            <span>Y</span>
            <span>W</span>
            <span>T</span>
          </div>
          {dates.map((d) => {
            const rec = dayAt(state, d)
            const empty = !rec.y && !rec.w && !rec.t && !rec.skipped
            return (
              <div className={empty ? 'ywt-row dim' : 'ywt-row'} key={d}>
                <span>{formatShort(d)}</span>
                <span>{rec.skipped ? '書けなかった' : rec.y || '—'}</span>
                <span>{rec.w || '—'}</span>
                <span>{rec.t || '—'}</span>
              </div>
            )
          })}
        </div>
        <p className="muted">記憶で週を思い出さず、ここに並んだものを読んでからAARを書きます。</p>
      </Section>

      <Section kicker="週末 · 20分" title="個人AAR" variant="night">
        <p className="lead-q">
          今週、成し遂げようとしていたこと：{' '}
          {plan.actions
            .filter((a) => a.wish.trim())
            .map((a) => a.wish)
            .join(' / ') || '（まだ今週の3つがない）'}
        </p>
        <Field
          label="なぜ、そうなったか"
          hint="うまくいった日と外れた日の両方を見る。"
          multiline
          value={review.why}
          onChange={(v) => patchReview(anchor, { why: v })}
        />
        <Field
          label="来週、再現すること"
          multiline
          value={review.keep}
          onChange={(v) => patchReview(anchor, { keep: v })}
        />
        <div className="status-block">
          <p className="field-label">四半期目標は進んだか</p>
          {quarters.length === 0 ? (
            <p className="muted">四半期目標がありません。</p>
          ) : (
            quarters.map((g) => (
              <div className="status-row" key={g.id}>
                <span>{g.title}</span>
                <div className="status-picks">
                  {STATUSES.map((st) => (
                    <button
                      type="button"
                      key={st}
                      className={
                        review.statuses[g.id] === st ? 'status on' : 'status'
                      }
                      onClick={() =>
                        patchReview(anchor, { statuses: { [g.id]: st } })
                      }
                    >
                      {quarterStatusLabel[st]}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </Section>

      <Section kicker="循環を閉じる" title="来週の3つ · WOOP" variant="panel">
        <p className="muted">
          AARで変えると決めたことを、来週（{formatWeekRange(next)}）の行動に落とします。
        </p>
        {nextPlan.actions.map((a, i) => (
          <article className="woop" key={a.id}>
            <header className="woop-head">
              <span className="num">{String(i + 1).padStart(2, '0')}</span>
              <h3>来週の行動</h3>
            </header>
            <Select
              label="親にする四半期目標"
              allowEmpty="選ぶ"
              value={a.quarterGoalId}
              onChange={(v) => patchWeekAction(next, i, { quarterGoalId: v })}
              options={nextQuarterOptions}
            />
            <div className="woop-grid">
              <Field
                label="Wish"
                value={a.wish}
                onChange={(v) => patchWeekAction(next, i, { wish: v })}
              />
              <Field
                label="Outcome"
                value={a.outcome}
                onChange={(v) => patchWeekAction(next, i, { outcome: v })}
              />
              <Field
                label="Obstacle"
                value={a.obstacle}
                onChange={(v) => patchWeekAction(next, i, { obstacle: v })}
              />
              <Field
                label="Plan · if-then"
                value={a.plan}
                onChange={(v) => patchWeekAction(next, i, { plan: v })}
              />
            </div>
          </article>
        ))}
      </Section>
    </div>
  )
}
