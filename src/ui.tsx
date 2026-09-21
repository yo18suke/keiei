import type { ReactNode } from 'react'

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
}) {
  return (
    <div className="field">
      <div className="field-head">
        <span className="field-label">{label}</span>
        {action}
      </div>
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
