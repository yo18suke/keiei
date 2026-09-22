import { addDays, dateParts, todayISO, weekDates, weekStart, weekdayJa } from './dates'
import { buildDayDoc, docFilename } from './exportDoc'
import { ExportActions } from './ExportActions'
import { MicToggle, SpeakableField } from './MicButton'
import { dayAt, dayHasEntry } from './selectors'
import { DayTodos } from './WeekBoard'
import { useDictation } from './speech'
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
  const { state, patchDay, appendDay } = useStore()
  const day = dayAt(state, date)
  const week = weekStart(date)
  const isToday = date === todayISO()
  const parts = dateParts(date)
  const yesterday = dayAt(state, addDays(date, -1))
  const noteSpeech = useDictation((text) => appendDay(date, 'note', text))

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
        title="メモ"
        variant="panel"
        tone="coral"
        action={<MicToggle dictation={noteSpeech} compact hideStatus hint="話した内容が、このメモに入ります。" />}
      >
        <Field
          label="今日のメモ"
          hint="形は問わない。思ったことをそのまま。"
          bare
          multiline
          rows={10}
          value={day.note}
          placeholder="気になったこと、感情、途中の考え"
          live={
            noteSpeech.listening
              ? noteSpeech.interim || '聞いています…'
              : noteSpeech.error
          }
          onChange={(v) => patchDay(date, { note: v, skipped: false })}
        />
      </Section>

      <DayTodos date={date} onOrganize={onOrganize} />

      <Section kicker="②" title="整理する" tone="indigo">
        <p className="section-lead muted">事実、学び、次に頭に置くことを、別の箱に分ける。</p>
        <SpeakableField
          listable
          modeId="y"
          resetKey={date}
          label="やったこと"
          hint="事実だけ。短くていい。"
          tone="green"
          multiline
          rows={4}
          value={day.y}
          placeholder="今日、手を動かしたこと"
          onAppend={(text) => appendDay(date, 'y', text)}
          onChange={(v) => patchDay(date, { y: v, skipped: false })}
        />
        <SpeakableField
          listable
          modeId="w"
          resetKey={date}
          label="学んだこと"
          hint="うまくいった理由も、外れた理由も。"
          tone="indigo"
          multiline
          rows={4}
          value={day.w}
          placeholder="うまくいった理由、外れた理由"
          onAppend={(text) => appendDay(date, 'w', text)}
          onChange={(v) => patchDay(date, { w: v, skipped: false })}
        />
        <SpeakableField
          listable
          modeId="t"
          resetKey={date}
          label="明日以降意識すること"
          hint="明日から頭に置いておくこと。"
          tone="gold"
          multiline
          rows={4}
          value={day.t}
          placeholder="明日以降、忘れずに意識すること"
          onAppend={(text) => appendDay(date, 't', text)}
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
        <p className="muted">Googleドキュメントへ送ると、ドライブの「リフレクションパレット」フォルダに溜まります。</p>
        <ExportActions parts={buildDayDoc(day)} filename={docFilename(date)} />
      </div>
    </div>
  )
}
