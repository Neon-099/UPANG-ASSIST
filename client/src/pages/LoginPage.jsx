import { useState } from 'react'
import { apiRequest } from '../api'
import upangLogo from '../assets/upang logo.png'
import upangCampus from '../assets/UpangCampus.jpg'
import { GoogleIcon } from '../components/auth/AuthElements'

export default function LoginPage({ onGuest, onGoogle, onSignUp, onEnterHome }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [recoveryStep, setRecoveryStep] = useState('email')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryOtp, setRecoveryOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [recoveryError, setRecoveryError] = useState('')
  const [recoveryMessage, setRecoveryMessage] = useState('')
  const [recoveryBusy, setRecoveryBusy] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onEnterHome(email, password)
    } catch (requestError) {
      setError(requestError.message || 'Unable to sign in.')
    } finally {
      setBusy(false)
    }
  }

  const requestRecoveryCode = async (event) => {
    event.preventDefault()
    setRecoveryBusy(true)
    setRecoveryError('')
    try {
      const data = await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: recoveryEmail }),
      })
      setRecoveryMessage(data.message || 'If an active account matches that email, a reset code has been sent.')
      setRecoveryStep('otp')
    } catch (requestError) {
      setRecoveryError(requestError.message)
    } finally {
      setRecoveryBusy(false)
    }
  }

  const verifyRecoveryCode = async (event) => {
    event.preventDefault()
    setRecoveryBusy(true)
    setRecoveryError('')
    try {
      const data = await apiRequest('/auth/verify-reset-otp', {
        method: 'POST',
        body: JSON.stringify({ email: recoveryEmail, otp: recoveryOtp }),
      })
      setResetToken(data.resetToken)
      setRecoveryStep('reset')
    } catch (requestError) {
      setRecoveryError(requestError.message)
    } finally {
      setRecoveryBusy(false)
    }
  }

  const submitNewPassword = async (event) => {
    event.preventDefault()
    setRecoveryBusy(true)
    setRecoveryError('')
    try {
      const data = await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: recoveryEmail, resetToken, password: newPassword, confirmPassword: confirmNewPassword }),
      })
      setRecoveryMessage(data.message || 'Password reset successfully. Sign in with your new password.')
      setRecoveryStep('complete')
    } catch (requestError) {
      setRecoveryError(requestError.message)
    } finally {
      setRecoveryBusy(false)
    }
  }

  return (
    <>
    <main className="login-screen-root">
      {/* ── Left Branded Visual Panel ── */}
      <section
        className="login-visual-panel"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(14, 43, 28, 0.88) 0%, rgba(9, 29, 18, 0.84) 100%), url(${upangCampus})`,
        }}
        aria-label="PHINMA University of Pangasinan"
      >
        <div className="visual-top-content">
          <div className="visual-torch-badge">
            <img src={upangLogo} alt="PHINMA UPang Emblem" className="torch-logo-img" />
          </div>
          <p className="visual-kicker-text">PHINMA EDUCATION</p>
          <h2 className="visual-main-title">Upang Assist</h2>
          <p className="visual-sub-brand">PHINMA University of Pangasinan</p>
          <p className="visual-subtitle-text">Making Lives Better Through Education</p>

          <div className="visual-bottom-footer">
            DAGUPAN CITY • URDANETA CITY CAMPUS
          </div>
        </div>
      </section>

      {/* ── Right Form Panel ── */}
      <section className="login-form-panel">
        <div className="form-panel-watermark" aria-hidden="true">
          <img src={upangLogo} alt="" />
        </div>

        <div className="form-panel-topbar">
          <div className="topbar-mode-toggle" aria-label="Account mode">
            <span className="mode-toggle-item active">Log In</span>
            <button type="button" className="mode-toggle-item" onClick={onSignUp}>Sign Up</button>
          </div>
        </div>

        <div className="form-panel-body">
          <div className="portal-badge-pill">
            STUDENT &amp; FACULTY PORTAL
          </div>

          <h1 className="form-main-heading">
            Welcome Back to Upang<br />
            <span className="heading-highlight-gold">Assist</span>
          </h1>

          <p className="form-instruction-text">
            Enter your credentials to access campus chatbot.
          </p>

          <form className="auth-form-fields" onSubmit={handleSubmit}>
            <div className="auth-field-group">
              <label htmlFor="email" className="auth-field-label">Student Email Address</label>
              <div className="auth-input-container">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  id="email"
                  type="email"
                  placeholder="student@up.phinmaed.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-field-group">
              <div className="auth-field-label-row">
                <label htmlFor="password" className="auth-field-label">Password</label>
                <button type="button" className="auth-forgot-link" onClick={() => { setRecoveryEmail(email); setRecoveryError(''); setRecoveryMessage(''); setRecoveryStep('email'); setRecoveryOpen(true) }}>Forgot password?</button>
              </div>
              <div className="auth-input-container">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="auth-pwd-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <label className="auth-remember-row">
              <input type="checkbox" />
              <span>Remember this device</span>
            </label>

            {error && <p className="auth-legal-error" role="alert">{error}</p>}
            <button className="auth-submit-gradient-btn" type="submit" disabled={busy}>
              {busy ? 'Signing in\u2026' : <>Log In {'\u2192'}</>}
            </button>
          </form>

          <div className="auth-or-divider">
            <span>OR CONTINUE WITH</span>
          </div>

          <div className="auth-social-grid">
            <button
              type="button"
              className="auth-social-card"
              onClick={() => onGoogle?.()}
            >
              <GoogleIcon />
              <span>Google Account</span>
            </button>
            <button
              type="button"
              className="auth-social-card"
              onClick={() => onGuest()}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2d553b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
              <span>Continue as Guest</span>
            </button>
          </div>

          <p className="auth-bottom-footer">
            Don't have an account yet? <button type="button" onClick={onSignUp}>Sign Up Now</button>
          </p>
        </div>
      </section>
    </main>
      {recoveryOpen && (
        <div className="auth-recovery-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRecoveryOpen(false) }}>
          <section className="auth-recovery-card" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
            <button className="auth-recovery-close" type="button" onClick={() => setRecoveryOpen(false)} aria-label="Close password recovery">&#215;</button>
            <h2 id="recovery-title">{recoveryStep === 'complete' ? 'Password updated' : 'Reset your password'}</h2>
            {recoveryStep === 'email' && <form onSubmit={requestRecoveryCode}><p>Enter your account email. If it matches an account, the server will send a verification code.</p><label className="auth-field-label" htmlFor="recovery-email">Email Address</label><input id="recovery-email" className="auth-recovery-input" type="email" required value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} /><button className="auth-submit-gradient-btn" disabled={recoveryBusy}>{recoveryBusy ? 'Sending\u2026' : 'Send code'}</button></form>}
            {recoveryStep === 'otp' && <form onSubmit={verifyRecoveryCode}><p>{recoveryMessage || 'Enter the verification code sent to your email.'}</p><label className="auth-field-label" htmlFor="recovery-otp">Verification Code</label><input id="recovery-otp" className="auth-recovery-input" inputMode="numeric" autoComplete="one-time-code" required value={recoveryOtp} onChange={(event) => setRecoveryOtp(event.target.value)} /><button className="auth-submit-gradient-btn" disabled={recoveryBusy}>{recoveryBusy ? 'Verifying\u2026' : 'Verify code'}</button></form>}
            {recoveryStep === 'reset' && <form onSubmit={submitNewPassword}><label className="auth-field-label" htmlFor="new-password">New Password</label><input id="new-password" className="auth-recovery-input" type="password" autoComplete="new-password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><label className="auth-field-label" htmlFor="confirm-new-password">Confirm New Password</label><input id="confirm-new-password" className="auth-recovery-input" type="password" autoComplete="new-password" required value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} /><button className="auth-submit-gradient-btn" disabled={recoveryBusy}>{recoveryBusy ? 'Updating\u2026' : 'Update password'}</button></form>}
            {recoveryStep === 'complete' && <p>{recoveryMessage} <button className="auth-recovery-text-button" type="button" onClick={() => { setRecoveryOpen(false); setRecoveryStep('email'); setPassword('') }}>Return to sign in</button></p>}
            {recoveryError && <p className="auth-legal-error" role="alert">{recoveryError}</p>}
          </section>
        </div>
      )}
    </>
  )
}
