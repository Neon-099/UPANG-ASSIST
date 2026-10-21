import { useEffect, useState } from 'react'
import { apiRequest } from '../api'
import './UnauthorizedModal.css'

export default function UnauthorizedModal() {
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const handleUnauthorized = () => setOpen(true)
    window.addEventListener('upang:unauthorized', handleUnauthorized)
    if (window.__upangUnauthorized) handleUnauthorized()
    return () => window.removeEventListener('upang:unauthorized', handleUnauthorized)
  }, [])

  const returnToLogin = async () => {
    if (leaving) return
    setLeaving(true)
    window.__upangUnauthorized = null
    try { await apiRequest('/auth/logout', { method: 'POST' }) } catch { /* Continue to login if the API is unavailable. */ }
    window.location.replace('/')
  }

  if (!open) return null

  return (
    <div className="unauthorized-modal-backdrop">
      <section className="unauthorized-modal" role="alertdialog" aria-modal="true" aria-labelledby="unauthorized-modal-title" aria-describedby="unauthorized-modal-description">
        <div className="unauthorized-modal-mark" aria-hidden="true">!</div>
        <p className="unauthorized-modal-kicker">SIGN-IN REQUIRED</p>
        <h2 id="unauthorized-modal-title">Your access is unauthorized</h2>
        <p id="unauthorized-modal-description">Please go back and log in again to continue using this page.</p>
        <button type="button" onClick={returnToLogin} disabled={leaving}>
          {leaving ? 'Returning to login…' : 'Go back to login'}
        </button>
      </section>
    </div>
  )
}
