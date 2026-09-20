import { useMemo, useState } from 'react'
import {
  formatShort,
  formatWeekRange,
  todayISO,
  weekDates,
  weekStart,
} from './dates'
import {
  dayAt,
  dayHasEntry,
  reviewAt,
  tomorrowGoalsOf,
  weekPlanAt,
} from './selectors'
import { useStore } from './store'
import { quarterStatusLabel } from './types'

export function HistoryPage() {
  const { state } = useStore()
  const quarters = state.quarterGoals.filter((g) => g.title.trim())
  const [goalId, setGoalId] = useState('')

  const weeks = useMemo(() => {
    const keys = new Set<string>()
    Object.keys(state.weeks).forEach((k) => keys.add(k))
    Object.keys(state.reviews).forEach((k) => keys.add(k))
    Object.keys(state.days).forEach((d) => keys.add(weekStart(d)))
    keys.add(weekStart(todayISO()))
    return [...keys].sort((a, b) => (a < b ? 1 : -1))
  }, [state.days, state.reviews, state.weeks])

  return (
    <div className="page">
      <div className="page-lead">
        <div>
          <p className="kicker">同じ列で並ぶ</p>
          <h1>履歴</h1>
        </div>
      </div>

      <div className="filters">
        <button
          type="button"
          className={goalId === '' ? 'filter on' : 'filter'}
          onClick={() => setGoalId('')}
        >
          すべて
        </button>
        {quarters.map((g) => (
          <button
            type="button"
            key={g.id}
            className={goalId === g.id ? 'filter on' : 'filter'}
            onClick={() => setGoalId(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {weeks.map((week) => (
        <WeekBlock key={week} week={week} goalId={goalId} />
      ))}
    </div>
  )
}

function WeekBlock({ week, goalId }: { week: string; goalId: string }) {
  const { state } = useStore()
  const plan = weekPlanAt(state, week)
  const review = reviewAt(state, week)
  const dates = weekDates(week)
  const days = dates.map((d) => dayAt(state, d))
  const wishes = plan.actions.filter((a) => a.wish.trim())
  const relevant =
    goalId === '' ||
    wishes.some((a) => a.quarterGoalId === goalId) ||
    days.some(
      (d) =>
        d.quarterGoalId === goalId ||
        tomorrowGoalsOf(d).some((g) => g.quarterGoalId === goalId),
    ) ||
    review.statuses[goalId] !== undefined

  if (!relevant) return null

  const hasBody =
    wishes.length > 0 ||
    days.some((d) => dayHasEntry(d)) ||
    review.why ||
    review.keep

  if (!hasBody) return null

  return (
    <article className="history-week">
      <header>
        <h2>{formatWeekRange(week)}</h2>
        <p>
          予定：
          {wishes.length
            ? wishes
                .filter((a) => !goalId || a.quarterGoalId === goalId)
                .map((a) => a.wish)
                .join(' / ') || '（この目標の予定はない）'
            : '—'}
        </p>
      </header>
      <div className="ywt-table">
        <div className="ywt-head">
          <span>日</span>
          <span>Y</span>
          <span>W</span>
          <span>明日</span>
        </div>
        {days.map((d) => {
          if (
            goalId &&
            d.quarterGoalId !== goalId &&
            !tomorrowGoalsOf(d).some((g) => g.quarterGoalId === goalId)
          ) {
            return null
          }
          const titles = tomorrowGoalsOf(d)
          const empty = !d.y && !d.w && titles.length === 0 && !d.skipped
          return (
            <div className={empty ? 'ywt-row dim' : 'ywt-row'} key={d.date}>
              <span>{formatShort(d.date)}</span>
              <span>{d.skipped ? '書けなかった' : d.y || '—'}</span>
              <span>{d.w || '—'}</span>
              <span>
                {titles.length ? titles.map((g) => g.title).join(' / ') : '—'}
              </span>
            </div>
          )
        })}
      </div>
      {review.why || review.keep ? (
        <dl className="aar-read">
          {review.why ? (
            <>
              <dt>なぜ</dt>
              <dd>{review.why}</dd>
            </>
          ) : null}
          {review.keep ? (
            <>
              <dt>再現</dt>
              <dd>{review.keep}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
      {Object.keys(review.statuses).length > 0 ? (
        <p className="muted">
          {Object.entries(review.statuses)
            .map(([id, st]) => {
              const g = state.quarterGoals.find((q) => q.id === id)
              return g ? `${g.title}：${quarterStatusLabel[st]}` : null
            })
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
    </article>
  )
}
