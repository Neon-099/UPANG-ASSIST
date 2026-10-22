import { useEffect, useState } from 'react'
import upangLogo from '../assets/upang logo.png'
import upangCampus from '../assets/UpangCampus.jpg'
import { GoogleIcon } from '../components/auth/AuthElements'

const fieldLabel = 'text-[13px] font-semibold text-gray-800'
const inputShell = 'flex h-12 items-center gap-2.5 rounded-xl border border-[#cbd5ce] bg-white px-3.5 transition-colors hover:border-[#9eafa3] focus-within:border-[#1b734b] focus-within:ring-[3px] focus-within:ring-emerald-800/10'
const inputClass = 'h-full min-w-0 flex-1 bg-transparent text-sm text-gray-900  outline-none placeholder:text-gray-400'
const socialButton = 'flex h-11 items-center justify-center gap-2 rounded-xl border border-[#cbd5ce] bg-white px-3 text-[13px] font-semibold text-gray-800 transition hover:-translate-y-px hover:border-[#9eafa3] hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60'
const MAX_LOGIN_ATTEMPTS = 3
const LOGIN_LOCKOUT_SECONDS = 15

export default function LoginPage({ onGuest, onGoogle, onSignUp, onForgotPassword, onEnterHome, onGetLoginStatus }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const [failedAttempts, setFailedAttempts] = useState(0)

  useEffect(() => {
    let active = true
    if (typeof onGetLoginStatus !== 'function') return undefined
    onGetLoginStatus()
      .then((status) => {
        if (!active) return
        const failedCount = Math.min(MAX_LOGIN_ATTEMPTS, Math.max(0, Number(status.failedAttempts) || 0))
        const retryAfterSeconds = Math.max(0, Number(status.retryAfterSeconds) || 0)
        setFailedAttempts(failedCount)
        if (retryAfterSeconds > 0) {
          setLockoutSeconds(retryAfterSeconds)
          setError(`Too many failed sign-in attempts. Try again in ${retryAfterSeconds} seconds.`)
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [onGetLoginStatus])

  useEffect(() => {
    if (lockoutSeconds <= 0) return undefined
    const timer = window.setTimeout(() => {
      setLockoutSeconds((seconds) => Math.max(0, seconds - 1))
      if (lockoutSeconds <= 1) {
        setFailedAttempts(0)
        setError('')
      }
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [lockoutSeconds])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!/^[A-Za-z0-9]+(?:[.][A-Za-z0-9]+)+[.]up@phinmaed[.]com$/i.test(email.trim()) || email.trim().length > 30) {
      setError('Use your PHINMA email in the format first.last.up@phinmaed.com (30 characters maximum).')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onEnterHome(email, password)
    } catch (requestError) {
      const failedCount = Number(requestError.data?.failedAttempts)
      if (Number.isFinite(failedCount)) setFailedAttempts(Math.min(MAX_LOGIN_ATTEMPTS, Math.max(0, failedCount)))
      const retryAfterSeconds = Number(requestError.data?.retryAfterSeconds)
      if (retryAfterSeconds > 0) {
        setLockoutSeconds(retryAfterSeconds)
        setError(`Too many failed sign-in attempts. Try again in ${retryAfterSeconds} seconds.`)
      } else {
        setError(requestError.message || 'Unable to sign in.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-[100dvh] w-full flex-col bg-white text-gray-900 lg:flex-row">
      <section
        className="relative hidden min-h-[100dvh] overflow-hidden bg-cover bg-[70%_center] px-[54px] py-11 text-center text-white lg:flex lg:w-[54%] lg:min-w-[440px] lg:flex-col lg:items-center lg:justify-center"
        style={{ backgroundImage: `linear-gradient(135deg, rgba(14, 43, 28, 0.88) 0%, rgba(9, 29, 18, 0.84) 100%), url(${upangCampus})` }}
        aria-label="PHINMA University of Pangasinan"
      >
        <div className="relative z-10 flex w-full max-w-[440px] flex-col items-center text-center">
          <div className="mb-5 grid h-[60px] w-[60px] shrink-0 place-items-center rounded-[18px] border border-amber-300/60 bg-[linear-gradient(135deg,rgba(220,165,45,.25),rgba(18,48,30,.7))] p-2 shadow-xl">
            <img src={upangLogo} alt="PHINMA UPang Emblem" className="h-9 w-9 object-contain" />
          </div>
          <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#dfa133]">PHINMA EDUCATION</p>
          <h2 className="mb-1 text-[clamp(30px,3.4vw,40px)] font-extrabold leading-[1.12] tracking-tight text-white">Upang Assist</h2>
          <p className="mb-1 text-[14.5px] font-bold tracking-wide text-[#f7e6c4]">PHINMA University of Pangasinan</p>
          <p className="mb-6 text-[13.5px] font-medium text-white/80">Making Lives Better Through Education</p>
          <p className="mt-2.5 w-full text-[11px] font-bold uppercase tracking-[.12em] text-white/65">DAGUPAN CITY · URDANETA CITY CAMPUS</p>
        </div>
      </section>

      <section className="relative flex min-h-[100dvh] flex-1 flex-col overflow-x-hidden overflow-y-auto border-t border-[#e5ebe6] bg-white px-6 py-6 sm:px-10 lg:border-l lg:border-t-0 lg:px-[52px] lg:py-9">
        <div className="pointer-events-none absolute -bottom-[30px] -right-[30px] z-0 h-[380px] w-[380px] opacity-[.055]" aria-hidden="true">
          <img src={upangLogo} alt="" className="h-full w-full object-contain [filter:sepia(1)_hue-rotate(5deg)_saturate(2)]" />
        </div>

        <div className="relative z-10 mb-6 flex w-full shrink-0 justify-end">
          <div className="inline-flex items-center gap-0.5 rounded-full border border-gray-200 bg-gray-100 p-[3px]" aria-label="Account mode">
            <span className="rounded-full bg-white px-[18px] py-1.5 text-[13px] font-semibold text-gray-900 shadow-sm" aria-current="page">Log In</span>
            <button type="button" className="rounded-full px-[18px] py-1.5 text-[13px] font-semibold text-gray-500 transition hover:text-gray-900" onClick={onSignUp}>Sign Up</button>
          </div>
        </div>

        <div className="relative z-10 m-auto flex w-full max-w-[440px] flex-col pb-4">
          <div className="mb-3 w-fit rounded-md bg-[#fcf4e6] px-3 py-[5px] text-[10.5px] font-extrabold uppercase tracking-[.08em] text-[#9b6b1f]">
            STUDENT, FACULTY &amp; ADMIN PORTAL
          </div>
          <h1 className="mb-2 text-[clamp(26px,3.2vw,32px)] font-extrabold leading-[1.15] tracking-[-.02em] text-[#1e2f23]">
            Welcome Back to Upang<br />
            <span className="font-extrabold text-[#aa7827]">Assist</span>
          </h1>
          <p className="mb-[22px] text-[13.5px] leading-[1.45] text-gray-500">Sign in with your PHINMA account to access your campus portal.</p>

          <form className="flex w-full flex-col gap-[15px]" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className={fieldLabel}>PHINMA Email Address</label>
              <div className={inputShell}>
                <svg className="shrink-0 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input id="email"   style={{ border: "none", outline: "none", boxShadow: "none" }}
                       className={inputClass} type="email" placeholder="first.last.up@phinmaed.com" pattern="[A-Za-z0-9]+([.][A-Za-z0-9]+)+[.]up@phinmaed[.]com" title="Use the format first.last.up@phinmaed.com (30 characters maximum)." maxLength={30} value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className={fieldLabel}>Password</label>
              <div className={inputShell}>
                <svg className="shrink-0 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input id="password"   style={{ border: "none", outline: "none", boxShadow: "none" }}
                       className={inputClass} type={showPassword ? 'text' : 'password'} placeholder="••••••••" maxLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
                <button type="button" className="grid shrink-0 place-items-center rounded-lg p-1 text-gray-400 transition hover:text-gray-700" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end -mt-2">
              <button type="button" className="text-[12px] font-semibold text-[#1b734b] underline underline-offset-4 hover:text-[#163625]" onClick={onForgotPassword}>
                Forgot password?
              </button>
            </div>

            <label className="mt-0.5 flex cursor-pointer select-none items-center gap-2 text-[13px] text-gray-600">
              <input type="checkbox" className="h-4 w-4 shrink-0 cursor-pointer accent-[#1b734b]" />
              <span>Remember this device</span>
            </label>

            <button className="mt-1 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-[linear-gradient(90deg,#b88628_0%,#7d6b2c_38%,#2d553b_100%)] text-[14.5px] font-bold text-white shadow-[0_6px_18px_-4px_rgba(45,85,59,.35)] transition hover:-translate-y-px hover:brightness-105 hover:shadow-[0_8px_22px_-3px_rgba(45,85,59,.45)] active:translate-y-0 disabled:cursor-wait disabled:opacity-70" type="submit" disabled={busy || lockoutSeconds > 0}>
              {busy ? 'Signing in…' : lockoutSeconds > 0 ? `Try again in ${lockoutSeconds}s` : <>Log In <span aria-hidden="true">→</span></>}
            </button>
            {error && <p className="m-0 text-xs leading-relaxed text-[#b42318]" role="alert">{error}</p>}
            {failedAttempts > 0 && <p className="m-0 text-xs leading-relaxed text-gray-500" role="status">{failedAttempts} of {MAX_LOGIN_ATTEMPTS} failed attempts used.{lockoutSeconds > 0 ? ` Sign-in is locked for ${lockoutSeconds}s.` : ` ${MAX_LOGIN_ATTEMPTS - failedAttempts} attempt${MAX_LOGIN_ATTEMPTS - failedAttempts === 1 ? '' : 's'} remain before a ${LOGIN_LOCKOUT_SECONDS}-second countdown.`}</p>}
          </form>

          <div className="my-5 flex items-center gap-3.5 text-[11px] font-bold uppercase tracking-[.08em] text-gray-400">
            <span className="h-px flex-1 bg-gray-200" />
            <span>OR CONTINUE WITH</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" className={socialButton} onClick={() => { if (lockoutSeconds <= 0 && !busy) onGoogle?.() }} disabled={busy || lockoutSeconds > 0} aria-disabled={busy || lockoutSeconds > 0} title={lockoutSeconds > 0 ? `Google sign-in unavailable for ${lockoutSeconds} seconds` : undefined}>
              <GoogleIcon />
              <span>{lockoutSeconds > 0 ? `Google sign-in unavailable (${lockoutSeconds}s)` : 'Continue with Google'}</span>
            </button>
            <button type="button" className={socialButton} onClick={() => onGuest()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d553b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
              <span>Continue as Guest</span>
            </button>
          </div>

          <p className="mt-5 text-center text-[13.5px] text-gray-500">
            Don&apos;t have an account yet? <button type="button" className="ml-1 font-bold text-gray-900 underline decoration-1 underline-offset-[3px] transition hover:text-[#1b734b]" onClick={onSignUp}>Sign Up Now</button>
          </p>
        </div>
      </section>
    </main>
  )
}
