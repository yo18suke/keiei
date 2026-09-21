import { useDictation } from './speech'

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
  const { supported, listening, interim, error, toggle } = useDictation(onFinal)

  if (!supported) {
    return compact ? null : <span className="muted">このブラウザでは話せません</span>
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
      {compact ? null : listening ? (
        <span className="muted">聞いています{interim ? `：${interim}` : '…'}</span>
      ) : hint ? (
        <span className="muted">{hint}</span>
      ) : null}
      {compact ? null : error ? <span className="muted">{error}</span> : null}
    </div>
  )
}
