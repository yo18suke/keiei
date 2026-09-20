import type { ReactNode } from 'react'

export function Field({
  label,
  hint,
  value,
  onChange,
  multiline,
  placeholder,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  placeholder?: string
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

export function Select({
  label,
  value,
  onChange,
  options,
  allowEmpty,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  allowEmpty?: string
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty !== undefined ? (
          <option value="">{allowEmpty}</option>
        ) : null}
        {options.map((o) => (
          <option value={o.value} key={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Button({
  children,
  onClick,
  variant = 'plain',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'plain' | 'primary' | 'quiet'
  type?: 'button' | 'submit'
}) {
  return (
    <button type={type} className={`btn btn-${variant}`} onClick={onClick}>
      {children}
    </button>
  )
}

export function Section({
  kicker,
  title,
  children,
  variant = 'plain',
}: {
  kicker?: string
  title: string
  children: ReactNode
  variant?: 'plain' | 'night' | 'panel'
}) {
  return (
    <section className={`section section-${variant}`}>
      <header className="section-head">
        {kicker ? <p className="kicker">{kicker}</p> : null}
        <h2>{title}</h2>
      </header>
      {children}
    </section>
  )
}
