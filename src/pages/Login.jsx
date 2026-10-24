import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { APP_NAME } from '../lib/config.js'

export default function Login({ t, lang, setLang }) {
  const [mode, setMode] = useState('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  const cleanEmail = () => email.trim().toLowerCase()

  async function signIn(e) {
    e.preventDefault()
    setBusy(true)
    setMsg({ type: '', text: '' })
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail(), password })
    if (error) setMsg({ type: 'error', text: error.message })
    setBusy(false)
  }

  async function sendCode(e) {
    e.preventDefault()
    setBusy(true)
    setMsg({ type: '', text: '' })
    // shouldCreateUser:false keeps this a private app: only the existing account can sign in.
    const { error } = await supabase.auth.signInWithOtp({ email: cleanEmail(), options: { shouldCreateUser: false } })
    if (error) setMsg({ type: 'error', text: error.message })
    else {
      setCodeSent(true)
      setMsg({ type: 'success', text: t('codeSent') })
    }
    setBusy(false)
  }

  async function verifyCode(e) {
    e.preventDefault()
    setBusy(true)
    setMsg({ type: '', text: '' })
    const { error } = await supabase.auth.verifyOtp({ email: cleanEmail(), token: code.trim(), type: 'email' })
    if (error) setMsg({ type: 'error', text: error.message })
    setBusy(false)
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-top">
          <div className="logo">₹</div>
          <button type="button" className="lang-switch" onClick={() => setLang(lang === 'en' ? 'te' : 'en')}>
            {lang === 'en' ? 'తెలుగు' : 'English'}
          </button>
        </div>
        <h1>{APP_NAME}</h1>
        <p className="subtitle">{t('tagline')}</p>

        {mode === 'password' ? (
          <form onSubmit={signIn}>
            <label htmlFor="email">{t('email')}</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            <label htmlFor="password">{t('password')}</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            <button type="submit" className="btn primary wide" disabled={busy}>{busy ? t('signingIn') : t('signIn')}</button>
          </form>
        ) : (
          <form onSubmit={codeSent ? verifyCode : sendCode}>
            <label htmlFor="email2">{t('email')}</label>
            <input id="email2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required disabled={codeSent} />
            {codeSent && (
              <>
                <label htmlFor="code">{t('enterCode')}</label>
                <input id="code" className="code-input" inputMode="numeric" maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} required />
              </>
            )}
            <button type="submit" className="btn primary wide" disabled={busy}>{codeSent ? t('verifyCode') : t('sendCode')}</button>
          </form>
        )}

        <button
          type="button"
          className="link-button"
          onClick={() => {
            setMode(mode === 'password' ? 'code' : 'password')
            setCodeSent(false)
            setMsg({ type: '', text: '' })
          }}
        >
          {mode === 'password' ? t('useCode') : t('usePassword')}
        </button>

        {msg.text && <p className={`message ${msg.type}`}>{msg.text}</p>}
        <p className="security-note">{t('loginNote')}</p>
      </section>
    </main>
  )
}
