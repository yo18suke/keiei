import { useEffect, useRef, useState } from 'react'
import { loadWriteMode, saveWriteMode, joinListItems, parseListItems, type WriteMode } from './lists'
import { useDictation } from './speech'
import { Field, ListEditor } from './ui'

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="currentColor"
        d="M12 14a3.2 3.2 0 0 0 3.2-3.2V7.2a3.2 3.2 0 1 0-6.4 0v3.6A3.2 3.2 0 0 0 12 14Zm5.4-3.2a5.4 5.4 0 0 1-10.8 0H5.2a6.8 6.8 0 0 0 6.1 6.56V20h1.4v-2.64A6.8 6.8 0 0 0 18.8 10.8h-1.4Z"
      />
    </svg>
  )
}

export function MicButton({
  onFinal,
  hint,
  compact,
}: {
  onFinal: (text: string) => void
  hint?: string
  compact?: boolean
}) {
  const dictation = useDictation(onFinal)
  return <MicToggle dictation={dictation} hint={hint} compact={compact} />
}

export function SpeakableField({
  onAppend,
  listable,
  modeId,
  resetKey,
  ...field
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  placeholder?: string
  rows?: number
  tone?: 'coral' | 'indigo' | 'green' | 'gold'
  onAppend: (text: string) => void
  listable?: boolean
  modeId?: string
  resetKey?: string
}) {
  const [mode, setMode] = useState<WriteMode>(() =>
    listable && modeId ? loadWriteMode(modeId, field.value) : 'prose',
  )
  const modeRef = useRef(mode)
  const valueRef = useRef(field.value)
  modeRef.current = mode
  valueRef.current = field.value

  useEffect(() => {
    if (!listable || !modeId) return
    setMode(loadWriteMode(modeId, field.value))
  }, [listable, modeId, resetKey])

  const dictation = useDictation((text) => {
    if (listable && modeRef.current === 'list') {
      field.onChange(joinListItems([...parseListItems(valueRef.current), text]))
      return
    }
    onAppend(text)
  })

  function choose(next: WriteMode) {
    setMode(next)
    if (modeId) saveWriteMode(modeId, next)
  }

  const live = dictation.listening ? dictation.interim || '聞いています…' : dictation.error
  const action = (
    <div className="field-head-actions">
      {listable ? (
        <div className="write-mode" role="group" aria-label="記入の形">
          <button
            type="button"
            className={mode === 'prose' ? 'write-mode-btn on' : 'write-mode-btn'}
            aria-pressed={mode === 'prose'}
            onClick={() => choose('prose')}
          >
            文章
          </button>
          <button
            type="button"
            className={mode === 'list' ? 'write-mode-btn on' : 'write-mode-btn'}
            aria-pressed={mode === 'list'}
            onClick={() => choose('list')}
          >
            箇条書き
          </button>
        </div>
      ) : null}
      <MicToggle dictation={dictation} compact hideStatus />
    </div>
  )

  if (listable && mode === 'list') {
    const cls = ['field', 'field-card', field.tone ? `tone-${field.tone}` : '']
      .filter(Boolean)
      .join(' ')
    return (
      <div className={cls}>
        <div className="field-head">
          <span className="field-label">{field.label}</span>
          {action}
        </div>
        <ListEditor
          value={field.value}
          onChange={field.onChange}
          label={field.label}
          placeholder={field.placeholder}
          syncKey={resetKey}
        />
        {live ? <p className="speech-live">{live}</p> : null}
        {field.hint ? <span className="field-hint">{field.hint}</span> : null}
      </div>
    )
  }

  return (
    <Field
      {...field}
      live={live}
      action={action}
    />
  )
}

export function MicToggle({
  dictation,
  hint,
  compact,
  hideStatus,
}: {
  dictation: ReturnType<typeof useDictation>
  hint?: string
  compact?: boolean
  hideStatus?: boolean
}) {
  const { supported, listening, interim, error, toggle } = dictation
  const status = hideStatus ? '' : listening ? interim || '聞いています…' : error

  if (!supported) {
    return compact ? (
      <button type="button" className="mic" disabled title="このブラウザでは話せません" aria-label="話せません">
        <MicIcon />
      </button>
    ) : (
      <span className="muted">このブラウザでは話せません。Chrome か Safari で開いてください。</span>
    )
  }

  return (
    <div className={compact ? 'mic-wrap compact' : 'mic-wrap'}>
      <button
        type="button"
        className={listening ? 'mic on' : 'mic'}
        aria-pressed={listening}
        aria-label={listening ? '停止' : '話す'}
        title={error || hint || '音声で入力'}
        onClick={toggle}
      >
        <MicIcon />
      </button>
      {status ? <span className={error && !listening ? 'speech-live error' : 'muted'}>{status}</span> : null}
      {!listening && !error && hint && !compact ? <span className="muted">{hint}</span> : null}
    </div>
  )
}
