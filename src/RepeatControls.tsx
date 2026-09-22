import { useState } from 'react'
import { todayISO, weekdayJa, weekdayNum } from './dates'
import { presetRepeat, repeatLabel, repeatPreset, type RepeatPreset } from './repeat'
import type { TaskRepeat } from './types'

const WEEKDAY_OPTS = [
  { n: 1, label: '月' },
  { n: 2, label: '火' },
  { n: 3, label: '水' },
  { n: 4, label: '木' },
  { n: 5, label: '金' },
  { n: 6, label: '土' },
  { n: 0, label: '日' },
] as const

export function RepeatControls({
  start,
  repeat,
  onChange,
}: {
  start?: string
  repeat?: TaskRepeat
  onChange: (next: TaskRepeat | undefined) => void
}) {
  const anchor = start || todayISO()
  const preset = repeatPreset(repeat, anchor)
  const [openCustom, setOpenCustom] = useState(preset === 'custom')

  function applyPreset(next: RepeatPreset) {
    if (!next) {
      setOpenCustom(false)
      onChange(undefined)
      return
    }
    if (next === 'custom') {
      setOpenCustom(true)
      onChange(repeat ?? { freq: 'daily', interval: 1 })
      return
    }
    setOpenCustom(false)
    onChange(presetRepeat(next, anchor))
  }

  function patch(partial: Partial<TaskRepeat> & { until?: string | null }) {
    const base = repeat ?? { freq: 'daily', interval: 1 }
    const freq = partial.freq ?? base.freq
    const until = partial.until === null || partial.until === '' ? undefined : (partial.until ?? base.until)
    onChange({
      freq,
      interval: Math.max(1, Math.min(99, partial.interval ?? base.interval)),
      weekdays: freq === 'weekly' ? (partial.weekdays ?? base.weekdays ?? [weekdayNum(anchor)]) : undefined,
      until,
    })
  }

  return (
    <div className="repeat-box">
      <select
        className="task-repeat"
        aria-label="繰り返し"
        value={openCustom || preset === 'custom' ? 'custom' : preset}
        onChange={(event) => applyPreset(event.target.value as RepeatPreset)}
      >
        <option value="">繰り返さない</option>
        <option value="daily">毎日</option>
        <option value="weekly">毎週（{weekdayJa(anchor)}）</option>
        <option value="weekdays">平日</option>
        <option value="monthly">毎月</option>
        <option value="custom">カスタム</option>
      </select>
      {repeat ? <p className="repeat-label">{repeatLabel(repeat, anchor)}</p> : null}
      {openCustom || preset === 'custom' ? (
        <div className="repeat-custom">
          <label className="repeat-interval">
            <span>間隔</span>
            <input
              type="number"
              min={1}
              max={99}
              value={repeat?.interval ?? 1}
              aria-label="繰り返し間隔"
              onChange={(event) => patch({ interval: Number(event.target.value) || 1 })}
            />
            <select
              value={repeat?.freq ?? 'daily'}
              aria-label="繰り返し単位"
              onChange={(event) => patch({ freq: event.target.value as TaskRepeat['freq'] })}
            >
              <option value="daily">日ごと</option>
              <option value="weekly">週ごと</option>
              <option value="monthly">月ごと</option>
            </select>
          </label>
          {(repeat?.freq ?? 'daily') === 'weekly' ? (
            <div className="repeat-days" role="group" aria-label="曜日">
              {WEEKDAY_OPTS.map((day) => {
                const selected = (repeat?.weekdays ?? []).includes(day.n)
                return (
                  <button
                    key={day.n}
                    type="button"
                    className={selected ? 'repeat-day on' : 'repeat-day'}
                    aria-pressed={selected}
                    onClick={() => {
                      const current = new Set(repeat?.weekdays ?? [])
                      if (current.has(day.n)) current.delete(day.n)
                      else current.add(day.n)
                      const weekdays = [...current].sort((a, b) => a - b)
                      patch({ weekdays: weekdays.length ? weekdays : [day.n] })
                    }}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>
          ) : null}
          <label className="repeat-until">
            <span>終了</span>
            <input
              type="date"
              value={repeat?.until ?? ''}
              aria-label="繰り返し終了日"
              onChange={(event) => patch({ until: event.target.value })}
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}
