import { useState } from 'react'
import { quarterOf, todayISO, yearOf, monthOf, formatMonth } from './dates'
import {
  filledQuarterGoals,
  filledYearGoals,
  horizonAt,
  monthGoalsAt,
  quarterGoalsAt,
  yearGoalsAt,
} from './selectors'
import { useStore } from './store'
import { emptyState } from './types'
import { Button, Field, Section, Select } from './ui'

export function GoalsPage() {
  const { state, upsertYearGoal, upsertQuarterGoal, upsertMonthGoal, upsertHorizon, replaceAll } =
    useStore()
  const nowYear = yearOf(todayISO())
  const nowQ = quarterOf(todayISO())
  const nowMonth = monthOf(todayISO())
  const [year, setYear] = useState(nowYear)
  const [quarter, setQuarter] = useState(nowQ)
  const [month, setMonth] = useState(nowMonth)
  const years = yearGoalsAt(state, year)
  const quarters = quarterGoalsAt(state, year, quarter)
  const months = monthGoalsAt(state, year, month)
  const parents = filledYearGoals(state, year)
  const monthParents = filledQuarterGoals(
    state,
    year,
    Math.floor((month - 1) / 3) + 1,
  )
  const yearReview = horizonAt(state, 'year', year, null)
  const qReview = horizonAt(state, 'quarter', year, quarter)

  function slot<T>(list: T[], i: number): T | undefined {
    return list[i]
  }

  return (
    <div className="page">
      <div className="page-lead">
        <div>
          <p className="kicker">年 → 四半期 → 月。明日はここを踏まえる</p>
          <h1>目標</h1>
        </div>
        <div className="date-nav">
          <label className="inline-label">
            年
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              <option value={nowYear - 1}>{nowYear - 1}</option>
              <option value={nowYear}>{nowYear}</option>
              <option value={nowYear + 1}>{nowYear + 1}</option>
            </select>
          </label>
          <label className="inline-label">
            四半期
            <select
              value={quarter}
              onChange={(e) => setQuarter(Number(e.target.value))}
            >
              <option value={1}>Q1</option>
              <option value={2}>Q2</option>
              <option value={3}>Q3</option>
              <option value={4}>Q4</option>
            </select>
          </label>
          <label className="inline-label">
            月
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option value={m} key={m}>
                  {m}月
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <Section kicker={`${year}年 · 年1回と四半期の見直し`} title="1年の方向 · 3つ" variant="panel">
        {[0, 1, 2].map((i) => {
          const g = slot(years, i)
          return (
            <article className="goal-edit" key={`y-${year}-${i}`}>
              <h3>方向 {i + 1}</h3>
              <Field
                label="12ヶ月後、どこにいるか"
                value={g?.title ?? ''}
                onChange={(v) => upsertYearGoal(year, i, { title: v })}
              />
              <Field
                label="意図 · 1行"
                value={g?.intent ?? ''}
                onChange={(v) => upsertYearGoal(year, i, { intent: v })}
              />
            </article>
          )
        })}
      </Section>

      <Section kicker={`Q${quarter} · 年のどれを90日で動かすか`} title="四半期の到達点 · 3つ" variant="panel">
        {[0, 1, 2].map((i) => {
          const g = slot(quarters, i)
          return (
            <article className="goal-edit" key={`q-${year}-${quarter}-${i}`}>
              <h3>到達 {i + 1}</h3>
              <Select
                label="親にする1年の方向"
                allowEmpty="選ぶ"
                value={g?.yearGoalId ?? ''}
                onChange={(v) =>
                  upsertQuarterGoal(year, quarter, i, { yearGoalId: v })
                }
                options={parents.map((p) => ({ value: p.id, label: p.title }))}
              />
              <Field
                label="この90日の到達点"
                value={g?.title ?? ''}
                onChange={(v) =>
                  upsertQuarterGoal(year, quarter, i, { title: v })
                }
              />
              <Field
                label="意図 · 1行"
                value={g?.intent ?? ''}
                onChange={(v) =>
                  upsertQuarterGoal(year, quarter, i, { intent: v })
                }
              />
            </article>
          )
        })}
      </Section>

      <Section
        kicker={`${formatMonth(year, month)} · 四半期を30日に落とす`}
        title="月の到達点 · 3つ"
        variant="panel"
      >
        {[0, 1, 2].map((i) => {
          const g = slot(months, i)
          return (
            <article className="goal-edit" key={`m-${year}-${month}-${i}`}>
              <h3>月 {i + 1}</h3>
              <Select
                label="親にする四半期"
                allowEmpty="選ぶ"
                value={g?.quarterGoalId ?? ''}
                onChange={(v) =>
                  upsertMonthGoal(year, month, i, { quarterGoalId: v })
                }
                options={monthParents.map((p) => ({
                  value: p.id,
                  label: p.title,
                }))}
              />
              <Field
                label="この30日の到達点"
                value={g?.title ?? ''}
                onChange={(v) => upsertMonthGoal(year, month, i, { title: v })}
              />
              <Field
                label="意図 · 1行"
                value={g?.intent ?? ''}
                onChange={(v) => upsertMonthGoal(year, month, i, { intent: v })}
              />
            </article>
          )
        })}
      </Section>

      <Section kicker="Clear の3問" title={`${year}年を見返す`} variant="night">
        <HorizonFields
          wentWell={yearReview.wentWell}
          wentPoorly={yearReview.wentPoorly}
          workingToward={yearReview.workingToward}
          onChange={(patch) =>
            upsertHorizon({
              kind: 'year',
              year,
              quarter: null,
              wentWell: patch.wentWell ?? yearReview.wentWell,
              wentPoorly: patch.wentPoorly ?? yearReview.wentPoorly,
              workingToward: patch.workingToward ?? yearReview.workingToward,
            })
          }
        />
      </Section>

      <Section kicker="Clear の3問" title={`Q${quarter} を見返す`} variant="night">
        <p className="muted">材料は、この四半期の週次AARです。履歴から束ねて読めます。</p>
        <HorizonFields
          wentWell={qReview.wentWell}
          wentPoorly={qReview.wentPoorly}
          workingToward={qReview.workingToward}
          onChange={(patch) =>
            upsertHorizon({
              kind: 'quarter',
              year,
              quarter,
              wentWell: patch.wentWell ?? qReview.wentWell,
              wentPoorly: patch.wentPoorly ?? qReview.wentPoorly,
              workingToward: patch.workingToward ?? qReview.workingToward,
            })
          }
        />
      </Section>

      <Section kicker="このブラウザに保存" title="書き出し / 読み込み" variant="panel">
        <div className="row-actions">
          <Button
            variant="primary"
            onClick={() => {
              const blob = new Blob([JSON.stringify(state, null, 2)], {
                type: 'application/json',
              })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `kakunin-${todayISO()}.json`
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
                    const parsed = JSON.parse(String(reader.result))
                    replaceAll({ ...emptyState(), ...parsed })
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
        <p className="muted">データはこの端末のブラウザにだけあります。書き出して控えてください。</p>
      </Section>
    </div>
  )
}

function HorizonFields({
  wentWell,
  wentPoorly,
  workingToward,
  onChange,
}: {
  wentWell: string
  wentPoorly: string
  workingToward: string
  onChange: (p: {
    wentWell?: string
    wentPoorly?: string
    workingToward?: string
  }) => void
}) {
  return (
    <>
      <Field
        label="うまくいったことは何か"
        hint="成功の再現条件まで。"
        multiline
        value={wentWell}
        onChange={(v) => onChange({ wentWell: v })}
      />
      <Field
        label="うまくいかなかったことは何か"
        hint="障害は、次のWOOPの Obstacle になる。"
        multiline
        value={wentPoorly}
        onChange={(v) => onChange({ wentPoorly: v })}
      />
      <Field
        label="次に向かうことは何か"
        multiline
        value={workingToward}
        onChange={(v) => onChange({ workingToward: v })}
      />
    </>
  )
}
