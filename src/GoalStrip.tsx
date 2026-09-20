import { filledMonthGoals, filledQuarterGoals, filledYearGoals } from './selectors'
import { useStore } from './store'
import { formatMonth, monthOf, nextMonth, quarterOf, todayISO, yearOf } from './dates'

export function GoalStrip({ onGoals }: { onGoals: () => void }) {
  const { state } = useStore()
  const year = yearOf(todayISO())
  const quarter = quarterOf(todayISO())
  const month = monthOf(todayISO())
  const later = nextMonth(year, month)
  const years = filledYearGoals(state, year)
  const quarters = filledQuarterGoals(state, year, quarter)
  const thisMonth = filledMonthGoals(state, year, month)
  const laterGoals = filledMonthGoals(state, later.year, later.month)

  return (
    <aside className="goal-strip" aria-label="いまの目標">
      <p className="goal-kicker">今月</p>
      {thisMonth.length === 0 ? (
        <button type="button" className="text-link" onClick={onGoals}>
          今月の到達点を書く
        </button>
      ) : (
        <ul className="chip-list">
          {thisMonth.map((g) => (
            <li className="chip" key={g.id}>
              {g.title}
            </li>
          ))}
        </ul>
      )}
      <p className="goal-kicker">1ヶ月後</p>
      {laterGoals.length === 0 ? (
        <button type="button" className="text-link" onClick={onGoals}>
          {formatMonth(later.year, later.month)}を書く
        </button>
      ) : (
        <ul className="chip-list">
          {laterGoals.map((g) => (
            <li className="chip" key={g.id}>
              {g.title}
            </li>
          ))}
        </ul>
      )}
      <p className="goal-kicker">Q{quarter}</p>
      {quarters.length === 0 ? (
        <button type="button" className="text-link" onClick={onGoals}>
          四半期を書く
        </button>
      ) : (
        <ul className="chip-list">
          {quarters.map((g) => (
            <li className="chip chip-quiet" key={g.id}>
              {g.title}
            </li>
          ))}
        </ul>
      )}
      {years.length > 0 ? (
        <>
          <p className="goal-kicker">{year}</p>
          <ul className="chip-list">
            {years.map((g) => (
              <li className="chip chip-quiet" key={g.id}>
                {g.title}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </aside>
  )
}
