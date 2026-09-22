import { useState } from 'react'
import { todayISO, weekDates, weekStart, weekdayJa, dateParts } from './dates'
import { useStore } from './store'
import { CalendarLink } from './CalendarLink'
import { Button } from './ui'
import { WeekBoard } from './WeekBoard'

export function OrganizePage() {
  const { state, addTask } = useStore()
  const cases = (state.cases ?? []).filter((row) => !row.doneAt)
  const [caseId, setCaseId] = useState('')
  const [title, setTitle] = useState('')
  const [when, setWhen] = useState(todayISO)
  const weekDays = weekDates(weekStart(todayISO()))
  const pickCase = caseId && cases.some((row) => row.id === caseId) ? caseId : cases[0]?.id ?? ''

  function submit() {
    if (!pickCase) return
    addTask(pickCase, title, 'open', when)
    setTitle('')
  }

  return (
    <div className="page page-organize">
      <div className="page-head">
        <div>
          <p className="kicker">仕事を足す</p>
          <h1>TODO</h1>
          <p className="muted">今日やることを置いて、チェックで片付ける。進みは Work で見る。</p>
        </div>
        <a className="page-head-link" href="#work">
          Workへ
        </a>
      </div>

      <section className="section section-panel tone-gold todo-composer">
        <header className="section-head">
          <p className="kicker">追加</p>
          <h2>仕事を足す</h2>
        </header>
        {cases.length === 0 ? (
          <p className="muted">
            先に<a href="#work">Work</a>で案件を足すと、ここに仕事を置けます。
          </p>
        ) : (
          <form
            className="todo-composer-form"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <label>
              <span className="field-label">案件</span>
              <select value={pickCase} aria-label="案件" onChange={(event) => setCaseId(event.target.value)}>
                {cases.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="todo-composer-title">
              <span className="field-label">やること</span>
              <input
                value={title}
                placeholder="今日片付けること"
                aria-label="やること"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              <span className="field-label">日付</span>
              <select value={when} aria-label="取り組む日" onChange={(event) => setWhen(event.target.value)}>
                <option value="">日付なし</option>
                {weekDays.map((date) => (
                  <option key={date} value={date}>
                    {date === todayISO() ? '今日' : weekdayJa(date)} {dateParts(date).month}/{dateParts(date).day}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="primary">
              追加
            </Button>
          </form>
        )}
      </section>

      <CalendarLink />
      <WeekBoard />
    </div>
  )
}
