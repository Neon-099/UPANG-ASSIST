const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export function notifyUnauthorized(detail = {}) {
  window.__upangUnauthorized = detail
  window.dispatchEvent(new CustomEvent('upang:unauthorized', { detail }))
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const requestPath = String(path).split('?')[0]
    const expectedUnauthenticatedPath = /^\/auth\/(?:login|me|logout|forgot-password|verify-reset-otp|reset-password|register(?:\/|$))/.test(requestPath)
    if ((response.status === 401 || response.status === 403) && !expectedUnauthenticatedPath) {
      notifyUnauthorized({ status: response.status, message: data.error || '' })
    }
    const error = new Error(data.error || `Request failed (${response.status})`)
    error.status = response.status
    error.data = data
    throw error
  }
  return data
}
