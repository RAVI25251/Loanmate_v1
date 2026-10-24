export function Card({ title, right, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {right && <div className="card-actions">{right}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, sub, tone = '' }) {
  return (
    <article className="stat">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      {sub && <small>{sub}</small>}
    </article>
  )
}

export function Field({ label, children, full = false, hint }) {
  return (
    <div className={full ? 'field full' : 'field'}>
      <label>{label}</label>
      {children}
      {hint && <small className="hint-text">{hint}</small>}
    </div>
  )
}

export function Pill({ tone = 'blue', children }) {
  return <span className={`pill ${tone}`}>{children}</span>
}

export function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <label className={`switch ${disabled ? 'disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="track" aria-hidden="true" />
      {label && <span className="switch-label">{label}</span>}
    </label>
  )
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>
}

export function Notice({ tone = 'info', children }) {
  return <div className={`notice ${tone}`}>{children}</div>
}
