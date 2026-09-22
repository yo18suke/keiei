import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { joinListItems, parseListItems } from './lists'

export function ListEditor({
  value,
  onChange,
  label,
  placeholder,
  syncKey,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  placeholder?: string
  syncKey?: string
}) {
  const [rows, setRows] = useState<string[]>(() => {
    const items = parseListItems(value)
    return items.length ? [...items, ''] : ['']
  })
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => {
    const items = parseListItems(valueRef.current)
    setRows(items.length ? [...items, ''] : [''])
  }, [syncKey])

  function commit(next: string[], focusAt?: number) {
    const padded = next.length === 0 || next[next.length - 1] !== '' ? [...next, ''] : next
    setRows(padded)
    onChange(joinListItems(padded))
    if (focusAt !== undefined) {
      window.requestAnimationFrame(() => inputs.current[focusAt]?.focus())
    }
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'Enter') {
      if (!event.metaKey && !event.ctrlKey) return
      event.preventDefault()
      const next = [...rows]
      if (!next[index].trim() && index === next.length - 1) return
      next.splice(index + 1, 0, '')
      commit(next, index + 1)
      return
    }
    if (event.key === 'Backspace' && rows[index] === '' && rows.length > 1) {
      event.preventDefault()
      const next = rows.filter((_, i) => i !== index)
      commit(next, Math.max(0, index - 1))
    }
  }

  return (
    <ul className="list-editor">
      {rows.map((row, index) => (
        <li key={index}>
          <span aria-hidden>・</span>
          <input
            ref={(el) => {
              inputs.current[index] = el
            }}
            value={row}
            placeholder={index === 0 ? placeholder : '⌘+Enter で次の行'}
            aria-label={`${label} ${index + 1}件目`}
            onChange={(event) => {
              const next = [...rows]
              next[index] = event.target.value
              commit(next)
            }}
            onKeyDown={(event) => onKey(event, index)}
          />
        </li>
      ))}
    </ul>
  )
}

export function Field({
  label,
  hint,
  value,
  onChange,
  multiline,
  placeholder,
  rows = 3,
  action,
  live,
  tone,
  bare,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  placeholder?: string
  rows?: number
  action?: ReactNode
  live?: string
  tone?: 'coral' | 'indigo' | 'green' | 'gold'
  bare?: boolean
}) {
  const cls = ['field', tone ? `field-card tone-${tone}` : '', bare ? 'field-bare' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls}>
      {bare ? null : (
        <div className="field-head">
          <span className="field-label">{label}</span>
          {action}
        </div>
      )}
      {multiline ? (
        <textarea
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
        />
      )}
      {live ? <p className="speech-live">{live}</p> : null}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'plain',
  type = 'button',
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'plain' | 'primary' | 'quiet'
  type?: 'button' | 'submit'
  disabled?: boolean
}) {
  return (
    <button type={type} className={`btn btn-${variant}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export function Section({
  kicker,
  title,
  children,
  variant = 'plain',
  tone,
  action,
}: {
  kicker?: string
  title: string
  children: ReactNode
  variant?: 'plain' | 'night' | 'panel'
  tone?: 'coral' | 'indigo' | 'green' | 'gold'
  action?: ReactNode
}) {
  return (
    <section className={`section section-${variant}${tone ? ` tone-${tone}` : ''}`}>
      <header className="section-head">
        {kicker ? <p className="kicker">{kicker}</p> : null}
        <div className="section-title-row">
          <h2>{title}</h2>
          {action}
        </div>
      </header>
      {children}
    </section>
  )
}
