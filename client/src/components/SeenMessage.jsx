import { useEffect, useRef } from 'react'

export default function SeenMessage({ messageId, enabled, onSeen, children }) {
  const elementRef = useRef(null)

  useEffect(() => {
    const element = elementRef.current
    if (!enabled || !messageId || !element || typeof onSeen !== 'function') return undefined

    let submitted = false
    let retryTimer
    const markVisibleMessage = (entries, observer) => {
      const entry = entries[0]
      if (!entry?.isIntersecting || document.visibilityState === 'hidden') return
      const enoughVisible = entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= 120
      if (!enoughVisible || submitted) return
      submitted = true
      observer.disconnect()
      Promise.resolve(onSeen(messageId)).catch(() => {
        submitted = false
        retryTimer = window.setTimeout(() => observer.observe(element), 2000)
      })
    }

    if (typeof IntersectionObserver !== 'function') {
      if (document.visibilityState !== 'hidden') Promise.resolve(onSeen(messageId)).catch(() => {})
      return undefined
    }

    const observer = new IntersectionObserver(markVisibleMessage, { threshold: [0, 0.5] })
    observer.observe(element)
    return () => {
      observer.disconnect()
      window.clearTimeout(retryTimer)
    }
  }, [enabled, messageId, onSeen])

  return <div ref={elementRef}>{children}</div>
}
