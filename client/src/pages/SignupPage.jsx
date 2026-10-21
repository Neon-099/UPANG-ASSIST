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
    const normalizedName = form.fullName.normalize('NFC')
    if (normalizedName.length < 2 || normalizedName.length > 30 || !/^\p{L}+(?: \p{L}+)*$/u.test(normalizedName)) {
      setRegistrationError('Name must contain 2–30 letters. Use single spaces between names only; do not add spaces at the beginning or end.')
      return
    }
    if (!/^[A-Za-z0-9]+(?:[.][A-Za-z0-9]+)+[.]up@phinmaed[.]com$/i.test(form.email.trim()) || form.email.trim().length > 30) {
      setRegistrationError('Use your PHINMA email in the format first.last.up@phinmaed.com (30 characters maximum).')
      return
    }
    const specialCharacters = [...form.password].filter((character) => !/[\p{L}\p{N}\s]/u.test(character))
    if (!specialCharacters.length) {
      setRegistrationError('Password must contain at least one special character.')
      return
    }
    if (new Set(specialCharacters).size !== specialCharacters.length) {
      setRegistrationError('Do not repeat a special character in your password.')
      return
    }
    if (/\s/.test(form.password)) {
      setRegistrationError('Password must not contain spaces.')
      return
    }
    if (!isLegalDocumentAccepted('terms') || !isLegalDocumentAccepted('privacy')) {
      setLegalFormError('Read both documents to the end and check both agreement boxes before creating your account.')
      return
    }
    setRegistrationBusy(true)
    setRegistrationError('')
    try {
      const result = await apiRequest('/auth/register/request-otp', { method: 'POST', body: JSON.stringify({ name: normalizedName, email: form.email, course: form.course, password: form.password, confirmPassword: form.confirmPassword }) })
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

  const cancelRegistrationAndGoBack = async () => {
    setRegistrationBusy(true)
    setRegistrationError('')
    try {
      await apiRequest('/auth/register/pending', { method: 'DELETE' })
      onBack()
    } catch (error) {
      setRegistrationError(error.message)
    } finally {
      setRegistrationBusy(false)
    }
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
      <main className="signup-page-root flex min-h-[100dvh] w-full flex-col bg-white text-gray-900 lg:flex-row">
      {/* ── Left Branded Visual Panel ── */}
      <section
        className="relative hidden min-h-[100dvh] overflow-hidden bg-cover bg-[70%_center] px-[54px] py-11 text-center text-white lg:flex lg:w-[54%] lg:min-w-[440px] lg:flex-col lg:items-center lg:justify-center"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(14, 43, 28, 0.88) 0%, rgba(9, 29, 18, 0.84) 100%), url(${upangCampus})`,
        }}
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

          <div className="mt-2.5 w-full text-[11px] font-bold uppercase tracking-[.12em] text-white/65">
            DAGUPAN CITY • URDANETA CITY CAMPUS
          </div>
        </div>
      </section>

      {/* ── Right Form Panel ── */}
      <section className="relative flex min-h-[100dvh] flex-1 flex-col overflow-x-hidden border-t border-[#e5ebe6] bg-white px-6 py-6 sm:px-10 lg:border-l lg:border-t-0 lg:px-[52px] lg:py-9">
        <div className="pointer-events-none absolute -bottom-[30px] -right-[30px] z-0 h-[380px] w-[380px] opacity-[.055]" aria-hidden="true">
          <img src={upangLogo} alt="" />
        </div>

        <div className="relative z-10 mb-6 flex w-full shrink-0 justify-end">
          <div className="inline-flex items-center gap-0.5 rounded-full border border-gray-200 bg-gray-100 p-[3px]" aria-label="Account mode">
            <button type="button" className="rounded-full px-[18px] py-1.5 text-[13px] font-semibold text-gray-500 transition hover:text-gray-900" onClick={onBack}>Log In</button>
            <span className="rounded-full bg-white px-[18px] py-1.5 text-[13px] font-semibold text-gray-900 shadow-sm">Sign Up</span>
          </div>
        </div>

        <div className="relative z-10 m-auto flex w-full max-w-[440px] flex-col pb-4">
          <div className="mb-3 w-fit rounded-md bg-[#fcf4e6] px-3 py-[5px] text-[10.5px] font-extrabold uppercase tracking-[.08em] text-[#9b6b1f]">
            STUDENT &amp; FACULTY PORTAL
          </div>

          <h1 className="mb-2 text-[clamp(26px,3.2vw,32px)] font-extrabold leading-[1.15] tracking-[-.02em] text-[#1e2f23]">
            Create Your Account<br />
            <span className="font-extrabold text-[#aa7827]">Upang Assist</span>
          </h1>

          {verificationRequired ? (
            <form className="flex w-full flex-col gap-[15px]" onSubmit={verifyRegistration}>
              <h2 className="text-lg font-bold text-[#1e2f23]">Verify your email</h2><p className="-mt-2 text-[13.5px] leading-relaxed text-gray-500">Enter the code sent to {form.email || 'your email'} to finish creating your account.</p>
              {registrationNotice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800" role="status">{registrationNotice}</p>}
              <div className="flex flex-col gap-1.5"><label htmlFor="registration-otp" className="text-[13px] font-semibold text-gray-800">Verification Code</label><div className="flex h-12 items-center gap-2.5 rounded-xl border border-[#cbd5ce] bg-white px-3.5 transition-colors hover:border-[#9eafa3] focus-within:border-[#1b734b] focus-within:ring-[3px] focus-within:ring-emerald-800/10"><input className="h-full min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" id="registration-otp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={registrationOtp} onChange={(event) => setRegistrationOtp(event.target.value.replace(/\D/g, ''))} required /></div></div>
              {registrationError && <p className="m-0 text-xs leading-relaxed text-[#b42318]" role="alert">{registrationError}</p>}
              <button className="mt-1 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-[linear-gradient(90deg,#b88628_0%,#7d6b2c_38%,#2d553b_100%)] text-[14.5px] font-bold text-white shadow-[0_6px_18px_-4px_rgba(45,85,59,.35)] transition hover:-translate-y-px hover:brightness-105 disabled:cursor-wait disabled:opacity-70" type="submit" disabled={registrationBusy}>{registrationBusy ? 'Verifying\u2026' : 'Verify & Create Account'}</button>
              <button className="self-center text-[13px] font-bold text-[#1b734b] underline underline-offset-4 disabled:opacity-60" type="button" onClick={resendRegistrationCode} disabled={registrationBusy}>Resend verification code</button>
              <button
                className="self-center text-[13px] font-semibold text-gray-600 underline underline-offset-4 transition hover:text-gray-900 disabled:cursor-wait disabled:opacity-60"
                type="button"
                onClick={cancelRegistrationAndGoBack}
                disabled={registrationBusy}
              >
                {registrationBusy ? 'Cancelling…' : 'Back to login'}
              </button>
            </form>
          ) : (
          <form className="flex w-full flex-col gap-[15px]" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="full-name" className="text-[13px] font-semibold text-gray-800">Full Name</label>
              <div className="flex h-12 items-center gap-2.5 rounded-xl border border-[#cbd5ce] bg-white px-3.5 transition-colors hover:border-[#9eafa3] focus-within:border-[#1b734b] focus-within:ring-[3px] focus-within:ring-emerald-800/10">
                <svg className="shrink-0 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" id="full-name"
                  name="fullName"
                  type="text"
                  placeholder="e.g. JuanDelaCruz"
                  minLength={2}
                  maxLength={30}
                  pattern="\\p{L}+(?: \\p{L}+)*"
                  title="Use 2–30 letters with single spaces only between names. No leading or trailing spaces."
                  value={form.fullName}
                  onChange={handleChange}
                  onInvalid={(event) => { event.preventDefault(); setRegistrationError('Enter a name with 2–30 letters and no leading or trailing spaces.') }}
                  required
                />
              </div>
              <p className="m-0 text-[11px] text-gray-500">Use letters with single spaces between names. No leading or trailing spaces, numbers, or symbols.</p>
            </div>

            <div className="relative flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="signup-course" className="text-[13px] font-semibold text-gray-800">Course</label>
                {form.course && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-[#1b734b] hover:underline"
                    onClick={handleClearCourse}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="relative" ref={courseDropdownRef}>
                <select
                  id="signup-course"
                  name="course"
                  ref={courseNativeSelectRef}
                  value={form.course}
                  onChange={handleChange}
                  required
                  className="sr-only"
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
                  className={`flex h-12 items-center gap-2.5 rounded-xl border border-[#cbd5ce] bg-white px-3.5 transition-colors hover:border-[#9eafa3] focus-within:border-[#1b734b] focus-within:ring-[3px] focus-within:ring-emerald-800/10 cursor-pointer ${isCourseDropdownOpen ? 'border-[#1b734b] ring-[3px] ring-emerald-800/10' : ''}`}
                  onClick={() => setIsCourseDropdownOpen((prev) => !prev)}
                  role="combobox"
                  aria-expanded={isCourseDropdownOpen}
                  aria-haspopup="listbox"
                  aria-controls="signup-course-dropdown"
                  tabIndex={0}
                  onKeyDown={handleCourseKeyDown}
                >
                  <svg className="shrink-0 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m22 10-10-5-10 5 10 5 10-5Z" />
                    <path d="M6 12v5c3.5 3 8.5 3 12 0v-5" />
                    <path d="M22 10v6" />
                  </svg>
                  <div className={`min-w-0 flex-1 truncate text-sm text-gray-900 ${!form.course ? 'text-gray-400' : ''}`}>
                    {form.course || 'Select your course'}
                  </div>
                  <div className={`ml-auto text-gray-400 transition ${isCourseDropdownOpen ? 'rotate-180' : ''}`} aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {isCourseDropdownOpen && (
                  <div
                    id="signup-course-dropdown"
                    className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
                    role="listbox"
                    aria-label="Courses"
                  >
                    {collegeCourses.map(({ college, courses }) => (
                      <div key={college} className="py-1">
                        <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                          <span>{college}</span>
                        </div>
                        {courses.map((course) => {
                          const isSelected = form.course === course
                          return (
                            <div
                              key={course}
                              role="option"
                              aria-selected={isSelected}
                              className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 ${isSelected ? 'bg-emerald-50 font-semibold text-[#1b734b]' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleSelectCourse(course)
                              }}
                            >
                              <span className="min-w-0 flex-1">{course}</span>
                              {isSelected && (
                                <svg className="shrink-0 text-[#1b734b]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                <div className="mt-1">
                  <span className="inline-flex rounded-full bg-[#fcf4e6] px-2.5 py-1 text-[10px] font-bold text-[#9b6b1f]">
                    {collegeCourses.find((c) => c.courses.includes(form.course))?.college || 'PHINMA UPang'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-email" className="text-[13px] font-semibold text-gray-800">Email Address</label>
              <div className="flex h-12 items-center gap-2.5 rounded-xl border border-[#cbd5ce] bg-white px-3.5 transition-colors hover:border-[#9eafa3] focus-within:border-[#1b734b] focus-within:ring-[3px] focus-within:ring-emerald-800/10">
                <svg className="shrink-0 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <input
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" id="signup-email"
                  name="email"
                  type="email"
                  placeholder="first.last.up@phinmaed.com"
                  pattern="[A-Za-z0-9]+([.][A-Za-z0-9]+)+[.]up@phinmaed[.]com"
                  title="Use the format first.last.up@phinmaed.com (30 characters maximum)."
                  maxLength={30}
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="signup-password" className="text-[13px] font-semibold text-gray-800">Password</label>
              <div className="flex h-12 items-center gap-2.5 rounded-xl border border-[#cbd5ce] bg-white px-3.5 transition-colors hover:border-[#9eafa3] focus-within:border-[#1b734b] focus-within:ring-[3px] focus-within:ring-emerald-800/10">
                <svg className="shrink-0 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" id="signup-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  minLength={8}
                  maxLength={12}
                  value={form.password}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="grid shrink-0 place-items-center rounded-lg p-1 text-gray-400 transition hover:text-gray-700"
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
              <p className="text-[11px] leading-relaxed text-gray-500">Use 8–12 characters and at least one special character. You may use different symbols, but do not repeat one. Spaces aren’t allowed.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-password" className="text-[13px] font-semibold text-gray-800">Confirm Password</label>
              <div className="flex h-12 items-center gap-2.5 rounded-xl border border-[#cbd5ce] bg-white px-3.5 transition-colors hover:border-[#9eafa3] focus-within:border-[#1b734b] focus-within:ring-[3px] focus-within:ring-emerald-800/10">
                <svg className="shrink-0 text-gray-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  className="h-full min-w-0 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400" id="confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  minLength={8}
                  maxLength={12}
                  value={form.confirmPassword}
                  onChange={handleChange}
                  required
                />
                <button
                  type="button"
                  className="grid shrink-0 place-items-center rounded-lg p-1 text-gray-400 transition hover:text-gray-700"
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

            <div className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/70 p-3.5">
              <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed text-gray-600">
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
                    className="font-bold text-[#1b734b] underline decoration-1 underline-offset-2"
                    onClick={() => {
                      setLegalFormError('')
                      setActiveLegalDoc('terms')
                    }}
                  >
                    Terms &amp; Conditions
                  </button>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed text-gray-600">
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
                    className="font-bold text-[#1b734b] underline decoration-1 underline-offset-2"
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

            {legalFormError && <p className="m-0 text-xs leading-relaxed text-[#b42318]" role="alert">{legalFormError}</p>}

            <button className="mt-1 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-[linear-gradient(90deg,#b88628_0%,#7d6b2c_38%,#2d553b_100%)] text-[14.5px] font-bold text-white shadow-[0_6px_18px_-4px_rgba(45,85,59,.35)] transition hover:-translate-y-px hover:brightness-105 disabled:cursor-wait disabled:opacity-70" type="submit" disabled={registrationBusy}>
              {registrationBusy ? <>Sending verification code {'\u2026'}</> : <>Create Account {'\u2192'}</>}
            </button>
          </form>
          )}
          {!verificationRequired && registrationError && <p className="m-0 text-xs leading-relaxed text-[#b42318]" role="alert">{registrationError}</p>}

          <p className="mt-5 text-center text-[13.5px] text-gray-500">
            Already have an account? <button type="button" onClick={onBack}>Log In</button>
          </p>
        </div>
      </section>
      </main>
    </>
  )
}

/* ── Reusable toggle switch component ── */
