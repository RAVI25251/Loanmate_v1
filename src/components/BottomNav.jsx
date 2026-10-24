import { useEffect, useState } from 'react'
import { makeZ } from '../lib/textV6.js'

// The menu at the bottom of the screen on a phone (hidden on a laptop, where the tabs are at the top).
// Four main pages, and "More" for the other three.
const MAIN = ['dashboard', 'loans', 'rent', 'payments']
const MORE = ['reminders', 'reports', 'settings']

const ICONS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  loans: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 8h6M9 11.5h6M9 8c3.5 0 4.5 1.4 4.5 2.4S12.5 13 9 13h0l5 4" />
    </>
  ),
  rent: (
    <>
      <path d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
      <path d="M14 10h5a1 1 0 0 1 1 1v10" />
      <path d="M3 21h18" />
      <path d="M8 8h2M8 12h2M8 16h2" />
    </>
  ),
  payments: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  reminders: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  reports: <path d="M4 20V10M10 20V4M16 20v-7M2 20h20" />,
  settings: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </>
  ),
}

export function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>
  )
}

export default function BottomNav({ tab, go, t, lang }) {
  const z = makeZ(lang)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false) // close the "More" list whenever the page changes
  }, [tab])

  const moreActive = MORE.includes(tab)

  return (
    <>
      {open && <div className="more-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      {open && (
        <div className="more-sheet" role="menu" aria-label={z('moreMenu')}>
          {MORE.map((name) => (
            <button key={name} type="button" role="menuitem" className={tab === name ? 'active' : ''} onClick={() => go(name)}>
              <Icon name={name} />
              <span>{t(name)}</span>
            </button>
          ))}
        </div>
      )}
      <nav className="bottom-nav no-print" aria-label={z('mainMenu')}>
        {MAIN.map((name) => (
          <button key={name} type="button" className={tab === name ? 'active' : ''} aria-current={tab === name ? 'page' : undefined} onClick={() => go(name)}>
            <Icon name={name} />
            <span>{t(name)}</span>
          </button>
        ))}
        <button type="button" className={moreActive || open ? 'active' : ''} aria-expanded={open} onClick={() => setOpen(!open)}>
          <Icon name="more" />
          <span>{z('more')}</span>
        </button>
      </nav>
    </>
  )
}
