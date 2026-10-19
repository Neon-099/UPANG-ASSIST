import { useEffect, useRef } from 'react'

export function GoogleIcon() {
  return (
    <svg className="social-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.2 0-5.8-2.7-5.8-6s2.6-6 5.8-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.7 3.1 14.6 2.2 12 2.2 6.9 2.2 2.8 6.3 2.8 11.4s4.1 9.2 9.2 9.2c5.3 0 8.8-3.7 8.8-8.9 0-.6-.1-1.1-.2-1.5H12Z"/>
      <path fill="#4285F4" d="M3.7 7.1l3.5 2.6c1-1.9 3.1-3.1 5.8-3.1 1.8 0 3 .8 3.7 1.5l2.5-2.4C16.7 3.1 14.6 2.2 12 2.2c-3.7 0-6.9 2.1-8.3 5.1Z"/>
      <path fill="#FBBC05" d="M3.8 15.6A9.3 9.3 0 0 1 3.3 11c0-.9.2-1.8.5-2.6L.9 6.1A11.2 11.2 0 0 0 0 11c0 1.8.4 3.5 1.2 5l2.6-1.4Z"/>
      <path fill="#34A853" d="M12 21.7c2.5 0 4.5-.8 6-2.2l-2.9-2.4c-.8.5-1.9.9-3.1.9-2.7 0-4.9-1.9-5.4-4.3l-3 2.3A9.2 9.2 0 0 0 12 21.7Z"/>
    </svg>
  )
}

import { LEGAL_POLICIES } from '../../data/legalPolicies'


export function LegalDocumentModal({ type, onClose, onReachEnd, onConfirm, hasReachedEnd }) {
  const policy = LEGAL_POLICIES[type]
  const modalRef = useRef(null)
  const documentBodyRef = useRef(null)

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    documentBodyRef.current?.focus()

    return () => {
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [])

  if (!policy) return null

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return
    const focusableElements = modalRef.current?.querySelectorAll(
      'button:not([disabled]), [tabindex="0"]'
    )
    if (!focusableElements?.length) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }

  const handleDocumentScroll = (event) => {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget
    if (scrollTop > 0 && scrollTop + clientHeight >= scrollHeight - 2) {
      onReachEnd(type, policy.version)
    }
  }

  return (
    <div className="legal-modal-backdrop" onClick={onClose}>
      <section
        ref={modalRef}
        className="legal-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="legal-modal-header">
          <div>
            <p className="legal-kicker">UPang Assist · Version {policy.version}</p>
            <h2 id="legal-modal-title">{policy.title}</h2>
          </div>
          <button
            type="button"
            className="legal-modal-close"
            onClick={onClose}
            aria-label="Close legal document"
          >
            ✕
          </button>
        </div>

        <div
          ref={documentBodyRef}
          className="legal-modal-body"
          role="region"
          aria-label={`${policy.title} document`}
          tabIndex={0}
          onScroll={handleDocumentScroll}
        >
          {policy.sections.map((section) => (
            <section className="legal-section" key={section.heading}>
              <h3>{section.heading}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
        <div className={`legal-modal-footer ${hasReachedEnd ? 'is-complete' : ''}`}>
          <p className="legal-modal-status" role="status" aria-live="polite">
            {hasReachedEnd
              ? 'You have reached the end of this document.'
              : 'Scroll to the end of this document to continue.'}
          </p>
          <button
            type="button"
            className="legal-modal-confirm"
            disabled={!hasReachedEnd}
            onClick={() => onConfirm(type, policy.version)}
          >
            I have read and agree
          </button>
        </div>
      </section>
    </div>
  )
}
