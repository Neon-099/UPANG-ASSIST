import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import upangLogo from '../assets/upang logo.png'

export default function GoogleAuthErrorPage({ errorCode, retryAfterSeconds = 0, onBack }) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => Math.max(0, retryAfterSeconds))

  useEffect(() => {
    if (remainingSeconds <= 0) return undefined
    const timer = window.setTimeout(() => setRemainingSeconds((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [remainingSeconds])

  const isLoginLocked = errorCode === 'login_locked'
  const message = isLoginLocked
    ? `Too many failed sign-in attempts. Password and Google sign-in are blocked${remainingSeconds > 0 ? ` for ${remainingSeconds} seconds` : ''}.`
    : errorCode === 'google_name_letters_only'
    ? 'Your Google profile name must contain 2–30 letters. Single spaces between names are allowed; numbers and symbols are not.'
    : 'Google sign-in or account setup could not be completed. No account was created. Please return to sign in and try again.'

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[radial-gradient(ellipse_at_top,#edf5ef,#f8faf8_55%,#fff)] px-5 py-10 text-gray-900">
      <section className="w-full max-w-[460px] rounded-3xl border border-[#e4e9e5] bg-white p-7 text-center shadow-[0_24px_80px_rgba(21,51,34,.12)] sm:p-10" aria-labelledby="google-auth-error-title">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-amber-300 bg-amber-50 text-amber-600"><TriangleAlert className="h-8 w-8" aria-hidden="true" /></div>
        <img src={upangLogo} alt="PHINMA University of Pangasinan" className="mx-auto mb-4 h-12 w-12 object-contain" />
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-[#9b6b1f]">Google Authentication</p>
        <h1 id="google-auth-error-title" className="text-2xl font-extrabold tracking-tight text-[#1e2f23]">Sign-in could not be completed</h1>
        <p className="mx-auto mt-3 max-w-[340px] text-sm leading-relaxed text-gray-600">{message}</p>
        <button type="button" onClick={onBack} disabled={isLoginLocked && remainingSeconds > 0} className="mt-7 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[linear-gradient(90deg,#b88628_0%,#7d6b2c_38%,#2d553b_100%)] px-5 text-sm font-bold text-white shadow-md transition hover:-translate-y-px hover:brightness-105 disabled:cursor-wait disabled:opacity-70">{isLoginLocked && remainingSeconds > 0 ? `Return to sign in in ${remainingSeconds}s` : 'Return to sign in'}</button>
      </section>
    </main>
  )
}
