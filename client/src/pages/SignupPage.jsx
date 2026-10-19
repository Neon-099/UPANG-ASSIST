import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../api'
import upangLogo from '../assets/upang logo.png'
import upangCampus from '../assets/UpangCampus.jpg'
import { collegeCourses } from '../data/collegeCourses'
import { LegalDocumentModal } from '../components/auth/AuthElements'
import { LEGAL_POLICIES } from '../data/legalPolicies'

export default function SignupPage({ onBack, onVerified }) {
  const [form, setForm] = useState({
    fullName: '',
    course: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [legalConfirmations, setLegalConfirmations] = useState({
    terms: { version: LEGAL_POLICIES.terms.version, readAt: null, acceptedAt: null },
    privacy: { version: LEGAL_POLICIES.privacy.version, readAt: null, acceptedAt: null },
  })
  const [activeLegalDoc, setActiveLegalDoc] = useState(null)
  const [legalFormError, setLegalFormError] = useState('')
  const [verificationRequired, setVerificationRequired] = useState(false)
  const [registrationOtp, setRegistrationOtp] = useState('')
  const [registrationBusy, setRegistrationBusy] = useState(false)
  const [registrationError, setRegistrationError] = useState('')
  const [registrationNotice, setRegistrationNotice] = useState('')
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false)
  const courseDropdownRef = useRef(null)
  const courseNativeSelectRef = useRef(null)

  useEffect(() => {
    apiRequest('/auth/register/pending').then(({ email }) => {
      setForm((current) => ({ ...current, email: email || current.email }))
      setVerificationRequired(true)
    }).catch((error) => { if (error.status !== 404) setRegistrationError(error.message) })
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (courseDropdownRef.current && !courseDropdownRef.current.contains(event.target)) {
        setIsCourseDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target
    setForm((currentForm) => ({ ...currentForm, [name]: value }))
  }

  const handleSelectCourse = (selectedCourse) => {
    setForm((current) => ({ ...current, course: selectedCourse }))
    setIsCourseDropdownOpen(false)
    if (courseNativeSelectRef.current) {
      courseNativeSelectRef.current.value = selectedCourse
    }
  }

  const handleClearCourse = () => {
    setForm((prev) => ({ ...prev, course: '' }))
    if (courseNativeSelectRef.current) {
      courseNativeSelectRef.current.value = ''
    }
  }

  const handleCourseKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setIsCourseDropdownOpen((prev) => !prev)
    } else if (event.key === 'Escape') {
      setIsCourseDropdownOpen(false)
    }
  }

  const isLegalDocumentRead = (type) => (
    legalConfirmations[type].version === LEGAL_POLICIES[type].version
    && Boolean(legalConfirmations[type].readAt)
  )

  const isLegalDocumentAccepted = (type) => (
    isLegalDocumentRead(type) && Boolean(legalConfirmations[type].acceptedAt)
  )

  const handleLegalDocumentRead = (type, version) => {
    setLegalConfirmations((current) => {
      if (current[type].version === version && current[type].readAt) return current
      return {
        ...current,
        [type]: { version, readAt: new Date().toISOString(), acceptedAt: null },
      }
    })
  }

  const handleLegalDocumentConfirm = (type, version) => {
    if (!isLegalDocumentRead(type) || LEGAL_POLICIES[type].version !== version) return

    setLegalConfirmations((current) => ({
      ...current,
      [type]: {
        version,
        readAt: current[type].readAt || new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
      },
    }))
    setLegalFormError('')
    setActiveLegalDoc(null)
  }

  const handleLegalAcceptanceChange = (type) => {
    setActiveLegalDoc(type)
    setLegalFormError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!isLegalDocumentAccepted('terms') || !isLegalDocumentAccepted('privacy')) {
      setLegalFormError('Read both documents to the end and check both agreement boxes before creating your account.')
      return
    }
    setRegistrationBusy(true)
    setRegistrationError('')
    try {
      const result = await apiRequest('/auth/register/request-otp', { method: 'POST', body: JSON.stringify({ name: form.fullName.trim(), email: form.email, course: form.course, password: form.password, confirmPassword: form.confirmPassword }) })
      setRegistrationNotice(result.message || 'A verification code has been sent to your email.')
      setVerificationRequired(true)
    } catch (error) {
      setRegistrationError(error.message)
      if (error.data?.verificationRequired) setVerificationRequired(true)
    } finally { setRegistrationBusy(false) }
  }

  const verifyRegistration = async (event) => {
    event.preventDefault()
    setRegistrationBusy(true)
    setRegistrationError('')
    try {
      await apiRequest('/auth/register/verify-otp', { method: 'POST', body: JSON.stringify({ otp: registrationOtp }) })
      onVerified()
    } catch (error) { setRegistrationError(error.message) }
    finally { setRegistrationBusy(false) }
  }

  const resendRegistrationCode = async () => {
    setRegistrationBusy(true)
    setRegistrationError('')
    try {
      const result = await apiRequest('/auth/register/resend-otp', { method: 'POST' })
      setRegistrationNotice(result.message || 'A new verification code has been sent.')
    } catch (error) { setRegistrationError(error.message) }
    finally { setRegistrationBusy(false) }
  }

  return (
    <>
      {activeLegalDoc && (
        <LegalDocumentModal
          type={activeLegalDoc}
          onClose={() => setActiveLegalDoc(null)}
          onReachEnd={handleLegalDocumentRead}
          onConfirm={handleLegalDocumentConfirm}
          hasReachedEnd={isLegalDocumentRead(activeLegalDoc)}
        />
      )}
      <main className="login-screen-root signup-screen-root">
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
            <button type="button" className="mode-toggle-item" onClick={onBack}>Log In</button>
            <span className="mode-toggle-item active">Sign Up</span>
          </div>
        </div>

        <div className="form-panel-body">
          <div className="portal-badge-pill">
            STUDENT &amp; FACULTY PORTAL
          </div>

          <h1 className="form-main-heading">
            Create Your Account<br />
            <span className="heading-highlight-gold">Upang Assist</span>
          </h1>

          {verificationRequired ? (
            <form className="auth-form-fields" onSubmit={verifyRegistration}>
              <h2 className="auth-verification-title">Verify your email</h2><p className="auth-instruction-text">Enter the code sent to {form.email || 'your email'} to finish creating your account.</p>
              {registrationNotice && <p className="auth-form-notice" role="status">{registrationNotice}</p>}
              <div className="auth-field-group"><label htmlFor="registration-otp" className="auth-field-label">Verification Code</label><div className="auth-input-container"><input id="registration-otp" inputMode="numeric" autoComplete="one-time-code" value={registrationOtp} onChange={(event) => setRegistrationOtp(event.target.value)} required /></div></div>
              {registrationError && <p className="auth-legal-error" role="alert">{registrationError}</p>}
              <button className="auth-submit-gradient-btn" type="submit" disabled={registrationBusy}>{registrationBusy ? 'Verifying\u2026' : 'Verify & Create Account'}</button>
              <button className="auth-recovery-text-button" type="button" onClick={resendRegistrationCode} disabled={registrationBusy}>Resend verification code</button>
            </form>
          ) : (
          <form className="auth-form-fields" onSubmit={handleSubmit}>
            <div className="auth-field-group">
              <label htmlFor="full-name" className="auth-field-label">Full Name</label>
              <div className="auth-input-container">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  id="full-name"
                  name="fullName"
                  type="text"
                  placeholder="e.g. Juan Dela Cruz"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="auth-field-group auth-course-field-group">
              <div className="auth-field-label-row">
                <label htmlFor="signup-course" className="auth-field-label">Course</label>
                {form.course && (
                  <button
                    type="button"
                    className="auth-field-action-link"
                    onClick={handleClearCourse}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="auth-course-picker-wrapper" ref={courseDropdownRef}>
                <select
                  id="signup-course"
                  name="course"
                  ref={courseNativeSelectRef}
                  value={form.course}
                  onChange={handleChange}
                  required
                  className="auth-course-native-hidden"
                  tabIndex={-1}
                >
                  <option value="" disabled>Select your course</option>
                  {collegeCourses.map(({ college, courses }) => (
                    <optgroup label={college} key={college}>
                      {courses.map((course) => (
                        <option value={course} key={course}>{course}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <div
                  className={`auth-input-container auth-course-input-container ${isCourseDropdownOpen ? 'is-focused' : ''} ${form.course ? 'has-value' : ''}`}
                  onClick={() => setIsCourseDropdownOpen((prev) => !prev)}
                  role="combobox"
                  aria-expanded={isCourseDropdownOpen}
                  aria-haspopup="listbox"
                  aria-controls="signup-course-dropdown"
                  tabIndex={0}
                  onKeyDown={handleCourseKeyDown}
                >
                  <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m22 10-10-5-10 5 10 5 10-5Z" />
                    <path d="M6 12v5c3.5 3 8.5 3 12 0v-5" />
                    <path d="M22 10v6" />
                  </svg>
                  <div className={`auth-course-input-text ${!form.course ? 'is-placeholder' : ''}`}>
                    {form.course || 'Select your course'}
                  </div>
                  <div className={`auth-select-arrow ${isCourseDropdownOpen ? 'is-open' : ''}`} aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {isCourseDropdownOpen && (
                  <div
                    id="signup-course-dropdown"
                    className="auth-course-dropdown-menu"
                    role="listbox"
                    aria-label="Courses"
                  >
                    {collegeCourses.map(({ college, courses }) => (
                      <div key={college} className="auth-course-menu-group">
                        <div className="auth-course-group-header">
                          <span>{college}</span>
                        </div>
                        {courses.map((course) => {
                          const isSelected = form.course === course
                          return (
                            <div
                              key={course}
                              role="option"
                              aria-selected={isSelected}
                              className={`auth-course-menu-item ${isSelected ? 'is-selected' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSelectCourse(course)
                              }}
                            >
                              <span className="auth-course-menu-item-text">{course}</span>
                              {isSelected && (
                                <svg className="auth-course-check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {form.course && (
                <div className="auth-course-pill-preview">
                  <span className="auth-course-college-tag">
                    {collegeCourses.find((c) => c.courses.includes(form.course))?.college || 'PHINMA UPang'}
                  </span>
                </div>
              )}
            </div>

            <div className="auth-field-group">
              <label htmlFor="signup-email" className="auth-field-label">Email Address</label>
              <div className="auth-input-container">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  placeholder="student@up.phinmaed.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="signup-password" className="auth-field-label">Password</label>
              <div className="auth-input-container">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="signup-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="auth-pwd-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="confirm-password" className="auth-field-label">Confirm Password</label>
              <div className="auth-input-container">
                <svg className="auth-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="auth-pwd-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="auth-terms-box">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  checked={isLegalDocumentAccepted('terms')}
                  onChange={() => handleLegalAcceptanceChange('terms')}
                  required
                />
                <span>
                  I agree to the{' '}
                  <button
                    type="button"
                    className="auth-legal-link"
                    onClick={() => {
                      setLegalFormError('')
                      setActiveLegalDoc('terms')
                    }}
                  >
                    Terms &amp; Conditions
                  </button>
                </span>
              </label>
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  checked={isLegalDocumentAccepted('privacy')}
                  onChange={() => handleLegalAcceptanceChange('privacy')}
                  required
                />
                <span>
                  I accept the{' '}
                  <button
                    type="button"
                    className="auth-legal-link"
                    onClick={() => {
                      setLegalFormError('')
                      setActiveLegalDoc('privacy')
                    }}
                  >
                    Privacy Policy
                  </button>
                </span>
              </label>
            </div>

            {legalFormError && <p className="auth-legal-error" role="alert">{legalFormError}</p>}

            <button className="auth-submit-gradient-btn" type="submit" disabled={registrationBusy}>
              {registrationBusy ? <>Sending verification code {'\u2026'}</> : <>Create Account {'\u2192'}</>}
            </button>
          </form>
          )}
          {!verificationRequired && registrationError && <p className="auth-legal-error" role="alert">{registrationError}</p>}

          <p className="auth-bottom-footer">
            Already have an account? <button type="button" onClick={onBack}>Log In</button>
          </p>
        </div>
      </section>
      </main>
    </>
  )
}

/* ── Reusable toggle switch component ── */
