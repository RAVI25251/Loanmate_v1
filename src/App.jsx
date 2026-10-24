import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseReady } from './lib/supabase.js'
import { makeT } from './lib/i18n.js'
import { useLoanMateData } from './lib/useData.js'
import { APP_NAME } from './lib/config.js'
import { Notice } from './components/ui.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Loans from './pages/Loans.jsx'
import Rent from './pages/Rent.jsx'
import Payments from './pages/Payments.jsx'
import Reminders from './pages/Reminders.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'
import './App.css'

const TABS = ['dashboard', 'loans', 'rent', 'payments', 'reminders', 'reports', 'settings']

function App() {
  const [lang, setLangState] = useState(() => localStorage.getItem('loanmate_lang') || 'en')
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)
  const [nav, setNav] = useState({ tab: 'dashboard' })
  const [toast, setToast] = useState(null)
  const t = useMemo(() => makeT(lang), [lang])

  const { data, reload, loading, problems } = useLoanMateData(session)

  const setLang = useCallback((value) => {
    setLangState(value)
    localStorage.setItem('loanmate_lang', value)
    document.documentElement.lang = value
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = APP_NAME
  }, [lang])

  useEffect(() => {
    if (!supabase) {
      setChecking(false)
      return undefined
    }
    supabase.auth.getSession().then(({ data: s }) => {
      setSession(s?.session ?? null)
      setChecking(false)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Use the saved language of the account once it has loaded (switching never loses data).
  useEffect(() => {
    if (data.settings?.language && !localStorage.getItem('loanmate_lang')) setLang(data.settings.language)
  }, [data.settings, setLang])

  const notify = useCallback((type, text) => {
    setToast({ type, text, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 7000)
    return () => clearTimeout(timer)
  }, [toast])

  const go = useCallback((tab, extra = {}) => setNav({ tab, ...extra }), [])

  async function changeLanguage(value) {
    setLang(value)
    if (session) {
      await supabase.from('user_settings').upsert({ owner_id: session.user.id, language: value }, { onConflict: 'owner_id' })
    }
  }

  if (!supabaseReady) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="logo">₹</div>
          <h1>{APP_NAME}</h1>
          <p className="message error">
            Supabase settings were not found. Check that frontend/.env.local contains VITE_SUPABASE_URL and
            VITE_SUPABASE_PUBLISHABLE_KEY, then stop the server (Ctrl + C) and run npm.cmd run dev again.
          </p>
        </section>
      </main>
    )
  }

  if (checking) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="logo">₹</div>
          <h1>{APP_NAME}</h1>
          <p className="subtitle">{t('loading')}</p>
        </section>
      </main>
    )
  }

  if (!session) return <Login t={t} lang={lang} setLang={setLang} />

  const ctx = { t, lang, data, reload, notify, go, nav, userId: session.user.id, email: session.user.email }

  return (
    <div className="shell">
      <header className="topbar no-print">
        <div className="brand">
          <div className="small-logo">₹</div>
          <div>
            <h1>{APP_NAME}</h1>
            <p>{session.user.email}</p>
          </div>
        </div>
        <nav className="tabs" aria-label="Main">
          {TABS.map((tab) => (
            <button key={tab} type="button" className={nav.tab === tab ? 'tab active' : 'tab'} onClick={() => go(tab)}>
              {t(tab)}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button type="button" className="lang-switch" onClick={() => changeLanguage(lang === 'en' ? 'te' : 'en')}>
            {lang === 'en' ? 'తెలుగు' : 'English'}
          </button>
          <button type="button" className="btn ghost" onClick={() => supabase.auth.signOut()}>{t('signOut')}</button>
        </div>
      </header>

      <main className="content">
        {toast && (
          <div className={`toast ${toast.type} no-print`} role="status" onClick={() => setToast(null)}>
            {toast.text}
          </div>
        )}
        {problems.length > 0 && (
          <Notice tone="warn">
            <strong>{t('setupProblems')}</strong>
            <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
            <span>{t('setupHelp')}</span>
          </Notice>
        )}
        {loading && <p className="loading-line no-print">{t('loading')}</p>}

        {nav.tab === 'dashboard' && <Dashboard {...ctx} />}
        {nav.tab === 'loans' && <Loans {...ctx} />}
        {nav.tab === 'rent' && <Rent {...ctx} />}
        {nav.tab === 'payments' && <Payments {...ctx} />}
        {nav.tab === 'reminders' && <Reminders {...ctx} />}
        {nav.tab === 'reports' && <Reports {...ctx} />}
        {nav.tab === 'settings' && <Settings {...ctx} setLang={changeLanguage} />}
      </main>
    </div>
  )
}

export default App
