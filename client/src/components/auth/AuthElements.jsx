import { useEffect, useRef } from 'react'

export function GoogleIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.2H5.8a20 20 0 0 0 0 17.6l6.8-5.2Z" />
      <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 6 29.5 4 24 4A20 20 0 0 0 5.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12Z" />
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
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <section
        ref={modalRef}
        className="flex max-h-[min(88dvh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="legal-modal-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4 sm:px-7">
          <div>
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-[#9b6b1f]">UPang Assist · Version {policy.version}</p>
            <h2 id="legal-modal-title" className="text-xl font-extrabold text-[#1e2f23]">{policy.title}</h2>
          </div>
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            onClick={onClose}
            aria-label="Close legal document"
          >
            ✕
          </button>
        </div>

        <div
          ref={documentBodyRef}
          className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 text-sm leading-7 text-gray-700 outline-none sm:px-7"
          role="region"
          aria-label={`${policy.title} document`}
          tabIndex={0}
          onScroll={handleDocumentScroll}
        >
          {policy.sections.map((section) => (
            <section className="space-y-2" key={section.heading}>
              <h3 className="text-base font-bold text-[#1e2f23]">{section.heading}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-t border-gray-100 bg-gray-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className={`m-0 text-xs ${hasReachedEnd ? 'text-emerald-700' : 'text-gray-500'}`} role="status" aria-live="polite">
            {hasReachedEnd
              ? 'You have reached the end of this document.'
              : 'Scroll to the end of this document to continue.'}
          </p>
          <button
            type="button"
            className="h-11 shrink-0 rounded-xl bg-[#1b734b] px-5 text-sm font-bold text-white transition hover:bg-[#155d3c] disabled:cursor-not-allowed disabled:opacity-50"
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
