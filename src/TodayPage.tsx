import { addDays, dateParts, todayISO, weekDates, weekStart, weekdayJa } from './dates'
import { docFilename, formatDayDoc } from './exportDoc'
import { ExportActions } from './ExportActions'
import { MicButton } from './MicButton'
import { dayAt, dayHasEntry } from './selectors'
import { asTaskLane, type WorkTask } from './types'
import { appendSpoken } from './speech'
import { useStore } from './store'
import { Button, Field, Section } from './ui'

export function TodayPage({
  date,
  onDate,
  onOrganize,
}: {
  date: string
  onDate: (next: string) => void
  onOrganize: () => void
}) {
  const { state, patchDay } = useStore()
  const day = dayAt(state, date)
  const week = weekStart(date)
  const isToday = date === todayISO()
  const parts = dateParts(date)
  const yesterday = dayAt(state, addDays(date, -1))

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="kicker">
            {parts.year}年{parts.month}月{isToday ? ' · 今日' : ''}
          </p>
          <h1>
            {parts.day}日（{parts.weekday}）
          </h1>
        </div>
        <div className="page-head-side">
          <div className="week-tabs" aria-label="今週の記録">
            {weekDates(week).map((d) => {
              const rec = dayAt(state, d)
              const filled = dayHasEntry(rec)
              return (
                <button
                  type="button"
                  key={d}
                  className={d === date ? 'tab on' : 'tab'}
                  onClick={() => onDate(d)}
                >
                  <span>{weekdayJa(d)}</span>
                  <i
                    className={
                      filled ? (rec.skipped ? 'dot skipped' : 'dot filled') : 'dot'
                    }
                  />
                </button>
              )
            })}
          </div>
          <div className="date-nav">
            <Button variant="quiet" onClick={() => onDate(addDays(date, -1))}>
              前の日
            </Button>
            {isToday ? null : (
              <Button variant="quiet" onClick={() => onDate(todayISO())}>
                今日へ
              </Button>
            )}
          </div>
        </div>
      </div>

      {yesterday.t.trim() ? (
        <p className="banner">昨日から意識すること：{yesterday.t}</p>
      ) : null}

      <Section
        kicker="①"
        title="自由に書く"
        variant="panel"
        action={
          <MicButton
            compact
            hint="話した内容が、このメモに入ります。Chrome / Edge が確実です。"
            onFinal={(text) => patchDay(date, { note: appendSpoken(day.note, text), skipped: false })}
          />
        }
      >
        <Field
          label="今日のメモ"
          hint="形は問わない。思ったことをそのまま。"
          multiline
          rows={8}
          value={day.note}
          placeholder="気になったこと、感情、途中の考え"
          onChange={(v) => patchDay(date, { note: v, skipped: false })}
        />
      </Section>

      <DayWork date={date} onOrganize={onOrganize} />

      <Section kicker="② · YWT" title="整理する" variant="night">
        <Field
          label="Y · やったこと"
          hint="事実だけ。短くていい。"
          multiline
          value={day.y}
          action={
            <MicButton
              compact
              onFinal={(text) => patchDay(date, { y: appendSpoken(day.y, text), skipped: false })}
            />
          }
          onChange={(v) => patchDay(date, { y: v, skipped: false })}
        />
        <Field
          label="W · 学んだこと"
          hint="うまくいった理由も、外れた理由も。"
          multiline
          value={day.w}
          action={
            <MicButton
              compact
              onFinal={(text) => patchDay(date, { w: appendSpoken(day.w, text), skipped: false })}
            />
          }
          onChange={(v) => patchDay(date, { w: v, skipped: false })}
        />
        <Field
          label="T · 明日以降意識すること"
          hint="明日から頭に置いておくこと。"
          multiline
          value={day.t}
          placeholder="明日以降、忘れずに意識すること"
          action={
            <MicButton
              compact
              onFinal={(text) => patchDay(date, { t: appendSpoken(day.t, text), skipped: false })}
            />
          }
          onChange={(v) => patchDay(date, { t: v, skipped: false })}
        />
        <div className="row-actions">
          {day.skipped ? (
            <p className="muted">この日は書けなかった、にしてある。</p>
          ) : (
            <Button variant="quiet" onClick={() => patchDay(date, { skipped: true })}>
              今日は書けなかった
            </Button>
          )}
        </div>
      </Section>

      <div className="export-row">
        <p className="muted">コピーして Google ドキュメントに貼れます。ダウンロードしたファイルも、ドキュメントで開けます。</p>
        <ExportActions text={formatDayDoc(day)} filename={docFilename(date)} />
      </div>
    </div>
  )
}

function DayWork({ date, onOrganize }: { date: string; onOrganize: () => void }) {
  const { state, moveTask } = useStore()
  const isToday = date === todayISO()
  const tasks = state.tasks ?? []
  const cases = state.cases ?? []
  const progress = isToday
    ? tasks.filter((task) => asTaskLane(task.lane) === 'progress')
    : []
  const doneOnDay = tasks.filter(
    (task) => asTaskLane(task.lane) === 'done' && task.doneAt === date,
  )
  const openCount = tasks.filter((task) => asTaskLane(task.lane) === 'open').length

  function caseName(task: WorkTask) {
    return cases.find((row) => row.id === task.caseId)?.name ?? '案件なし'
  }

  return (
    <Section kicker="作業" title="進捗と完了" variant="panel">
      {progress.length === 0 && doneOnDay.length === 0 ? (
        <p className="muted">
          {isToday
            ? '進捗中の作業は、整理でカードを動かすとここに出ます。'
            : 'この日に完了した作業はない。'}
        </p>
      ) : (
        <div className="day-work">
          {progress.length > 0 ? (
            <div>
              <h3>進捗中</h3>
              <ul className="day-work-list">
                {progress.map((task) => (
                  <li key={task.id} className="day-work-item">
                    <div>
                      <p className="kicker">{caseName(task)}</p>
                      <p>{task.title}</p>
                    </div>
                    <Button variant="quiet" onClick={() => moveTask(task.id, 'done')}>
                      完了へ
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {doneOnDay.length > 0 ? (
            <div>
              <h3>{isToday ? '今日完了' : 'この日に完了'}</h3>
              <ul className="day-work-list">
                {doneOnDay.map((task) => (
                  <li key={task.id} className="day-work-item done">
                    <div>
                      <p className="kicker">{caseName(task)}</p>
                      <p>{task.title}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
      <div className="row-actions">
        <Button variant="quiet" onClick={onOrganize}>
          {openCount ? `整理を開く · 未完了 ${openCount}件` : '整理を開く'}
        </Button>
      </div>
    </Section>
  )
}
