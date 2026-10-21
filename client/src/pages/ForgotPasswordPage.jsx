import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import upangLogo from '../assets/upang logo.png'
import upangCampus from '../assets/UpangCampus.jpg'

const emailPattern = /^[A-Za-z0-9]+(?:[.][A-Za-z0-9]+)+[.]up@phinmaed[.]com$/i

function makeChallenge() {
  const first = Math.floor(Math.random() * 20) + 1
  const second = Math.floor(Math.random() * 9) + 1
  return { first, second, answer: first + second }
}

export default function ForgotPasswordPage({ onBack, onComplete }) {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [challenge, setChallenge] = useState(makeChallenge)
  const [challengeAnswer, setChallengeAnswer] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('error')
  const [resendSeconds, setResendSeconds] = useState(0)

  useEffect(() => {
    if (step !== 'otp' || resendSeconds <= 0) return undefined
    const timer = window.setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [step, resendSeconds])

  const showError = (text) => {
    setMessage(text)
    setMessageType('error')
  }

  const refreshChallenge = () => {
    setChallenge(makeChallenge())
    setChallengeAnswer('')
    setMessage('')
  }

  const handleRequestOtp = async (event) => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (!emailPattern.test(normalizedEmail) || normalizedEmail.length > 30) {
      showError('Use your PHINMA email in the format first.last.up@phinmaed.com (30 characters maximum).')
      return
    }
    if (Number(challengeAnswer) !== challenge.answer) {
      showError('Please solve the verification question correctly.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const result = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: normalizedEmail }),
      })
      setMessage(result.message)
      setMessageType('info')
      setStep('otp')
      setResendSeconds(60)
    } catch (error) {
      showError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const handleResendOtp = async () => {
    setBusy(true)
    setMessage('')
    try {
      const result = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      setMessage(result.message)
      setMessageType('info')
      setResendSeconds(60)
    } catch (error) {
      showError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const handleVerifyOtp = async (event) => {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const result = await apiRequest('/auth/verify-reset-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp }),
      })
      setResetToken(result.resetToken)
      setStep('password')
      setMessage('')
    } catch (error) {
      showError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const handleResetPassword = async (event) => {
    event.preventDefault()
    if (!/[^A-Za-z0-9\s]/.test(password)) {
      showError('Password must contain at least one special character.')
      return
    }
    if (/\s/.test(password)) {
      showError('Password must not contain spaces.')
      return
    }
    if (password !== confirmPassword) {
      showError('Passwords do not match.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      const result = await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), resetToken, password, confirmPassword }),
      })
      setMessage(result.message)
      setMessageType('info')
      setOtp('')
      setResetToken('')
      setPassword('')
      setConfirmPassword('')
      if (result.user && onComplete) {
        await onComplete(result)
      } else {
        setStep('complete')
      }
    } catch (error) {
      showError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const cancelRecovery = () => {
    setStep('email')
    setChallenge(makeChallenge())
    setChallengeAnswer('')
    setOtp('')
    setResetToken('')
    setPassword('')
    setConfirmPassword('')
    setResendSeconds(0)
    setMessage('')
  }

  const intro = step === 'email'
    ? 'Enter your registered PHINMA email to request a one-time password.'
    : step === 'otp'
      ? `Enter the six-digit code sent to ${email}.`
      : step === 'password'
        ? 'Choose a new password for your account.'
        : 'Your password has been updated.'

  const inputShell = 'flex h-12 items-center rounded-xl border border-[#cbd5ce] bg-white px-3.5 transition-colors hover:border-[#9eafa3] focus-within:border-[#1b734b] focus-within:ring-[3px] focus-within:ring-emerald-800/10'
  const inputClass = 'h-full min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400'
  const primaryButton = 'flex h-12 w-full items-center justify-center rounded-xl bg-[linear-gradient(90deg,#b88628_0%,#7d6b2c_38%,#2d553b_100%)] text-[14px] font-bold text-white shadow-[0_6px_18px_-4px_rgba(45,85,59,.35)] transition hover:-translate-y-px hover:brightness-105 disabled:cursor-wait disabled:opacity-70'
  const secondaryButton = 'rounded-xl border border-[#cbd5ce] px-4 py-2.5 text-[13px] font-semibold text-gray-600 transition hover:border-[#9eafa3] hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60'

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
        </div>
      </section>

      <section className="relative flex min-h-[100dvh] flex-1 flex-col overflow-x-hidden overflow-y-auto border-t border-[#e5ebe6] bg-white px-6 py-6 sm:px-10 lg:border-l lg:border-t-0 lg:px-[52px] lg:py-9">
        <div className="relative z-10 m-auto flex w-full max-w-[440px] flex-col pb-4">
          <button type="button" className="mb-6 w-fit text-[13px] font-semibold text-gray-600 underline underline-offset-4 transition hover:text-gray-900" onClick={onBack}>
            ← Back to login
          </button>
          <div className="mb-3 w-fit rounded-md bg-[#fcf4e6] px-3 py-[5px] text-[10.5px] font-extrabold uppercase tracking-[.08em] text-[#9b6b1f]">ACCOUNT HELP</div>
          <h1 className="mb-2 text-[clamp(26px,3.2vw,32px)] font-extrabold leading-[1.15] tracking-[-.02em] text-[#1e2f23]">
            Forgot Password?<br /><span className="text-[#aa7827]">Upang Assist</span>
          </h1>
          <p className="mb-6 text-[13.5px] leading-relaxed text-gray-500">{intro}</p>

          {step === 'email' && (
            <form className="flex flex-col gap-3.5" onSubmit={handleRequestOtp}>
              <label htmlFor="recovery-email" className="text-[13px] font-semibold text-gray-800">Registered PHINMA Email</label>
              <div className="flex h-14 items-center rounded-[16px] border border-[#e2e4e7] bg-white px-4 transition focus-within:border-[#1b734b] focus-within:ring-[3px] focus-within:ring-emerald-800/10">
                <input id="recovery-email" className={inputClass} type="email" placeholder="first.last.up@phinmaed.com" pattern="[A-Za-z0-9]+([.][A-Za-z0-9]+)+[.]up@phinmaed[.]com" title="Use the format first.last.up@phinmaed.com (30 characters maximum)." maxLength={30} value={email} onChange={(event) => { setEmail(event.target.value); setMessage('') }} required autoComplete="email" />
              </div>
              <div className="flex w-full items-center justify-between gap-2 py-1" aria-label="Email verification question">
                <output className="grid h-[52px] w-[56px] shrink-0 place-items-center rounded-[14px] border border-[#e2e4e7] bg-white text-[18px] text-gray-600 sm:w-[68px]" aria-label="First number">{challenge.first}</output>
                <span className="text-[20px] font-medium text-gray-700" aria-hidden="true">+</span>
                <output className="grid h-[52px] w-[56px] shrink-0 place-items-center rounded-[14px] border border-[#e2e4e7] bg-white text-[18px] text-gray-600 sm:w-[68px]" aria-label="Second number">{challenge.second}</output>
                <span className="text-[20px] font-medium text-gray-700" aria-hidden="true">=</span>
                <input aria-label="Answer to verification question" className="h-[52px] w-[56px] shrink-0 rounded-[14px] border border-[#e2e4e7] bg-white text-center text-[18px] text-gray-700 outline-none transition focus:border-[#1b734b] focus:ring-[3px] focus:ring-emerald-800/10 sm:w-[68px]" inputMode="numeric" pattern="[0-9]*" value={challengeAnswer} onChange={(event) => { setChallengeAnswer(event.target.value.replace(/\D/g, '')); setMessage('') }} required />
                <button className="grid h-10 w-8 shrink-0 place-items-center text-[22px] font-medium text-gray-500 transition hover:text-[#1b734b]" type="button" onClick={refreshChallenge} aria-label="Refresh verification question">?</button>
              </div>
              {message && <p className={`text-xs leading-relaxed ${messageType === 'error' ? 'text-[#b42318]' : 'text-emerald-800'}`} role={messageType === 'error' ? 'alert' : 'status'}>{message}</p>}
              <button className={primaryButton} type="submit" disabled={busy}>{busy ? 'Sending code…' : 'Send OTP'}</button>
            </form>
          )}

          {step === 'otp' && (
            <form className="flex flex-col gap-3.5" onSubmit={handleVerifyOtp}>
              <label htmlFor="recovery-otp" className="text-[13px] font-semibold text-gray-800">Six-digit verification code</label>
              <div className={inputShell}>
                <input id="recovery-otp" className={inputClass} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="Enter 6-digit code" value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, '').slice(0, 6)); setMessage('') }} required />
              </div>
              {message && <p className={`text-xs leading-relaxed ${messageType === 'error' ? 'text-[#b42318]' : 'text-emerald-800'}`} role={messageType === 'error' ? 'alert' : 'status'}>{message}</p>}
              <button className={primaryButton} type="submit" disabled={busy || otp.length !== 6}>{busy ? 'Verifying…' : 'Verify OTP'}</button>
              <div className="flex items-center justify-between">
                <button className={secondaryButton} type="button" onClick={cancelRecovery} disabled={busy}>Cancel</button>
                {resendSeconds > 0
                  ? <span className="text-xs text-gray-500">Resend in {resendSeconds}s</span>
                  : <button className="text-[13px] font-bold text-[#1b734b] underline underline-offset-4 disabled:opacity-60" type="button" onClick={handleResendOtp} disabled={busy}>Resend OTP</button>}
              </div>
            </form>
          )}

          {step === 'password' && (
            <form className="flex flex-col gap-3.5" onSubmit={handleResetPassword}>
              <label htmlFor="recovery-password" className="text-[13px] font-semibold text-gray-800">New Password</label>
              <div className={inputShell}><input id="recovery-password" className={inputClass} type="password" minLength={8} maxLength={12} autoComplete="new-password" placeholder="8–12 characters" value={password} onChange={(event) => { setPassword(event.target.value); setMessage('') }} required /></div>
              <p className="-mt-2 text-[11px] leading-relaxed text-gray-500">Use 8–12 characters, at least one special character, and no spaces.</p>
              <label htmlFor="recovery-confirm-password" className="text-[13px] font-semibold text-gray-800">Confirm New Password</label>
              <div className={inputShell}><input id="recovery-confirm-password" className={inputClass} type="password" minLength={8} maxLength={12} autoComplete="new-password" placeholder="Re-enter new password" value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setMessage('') }} required /></div>
              {message && <p className="text-xs leading-relaxed text-[#b42318]" role="alert">{message}</p>}
              <button className={primaryButton} type="submit" disabled={busy}>{busy ? 'Updating…' : 'Reset Password'}</button>
              <button className={secondaryButton} type="button" onClick={cancelRecovery} disabled={busy}>Cancel</button>
            </form>
          )}

          {step === 'complete' && (
            <div className="flex flex-col gap-4">
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800" role="status">{message}</p>
              <button className={primaryButton} type="button" onClick={onBack}>Back to sign in</button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
