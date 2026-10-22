const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')

export function notifyUnauthorized(detail = {}) {
  window.__upangUnauthorized = detail
  window.dispatchEvent(new CustomEvent('upang:unauthorized', { detail }))
}

function createRequestError(status, path, data) {
  const requestPath = String(path).split('?')[0]
  const expectedUnauthenticatedPath = /^\/auth\/(?:login|me|logout|forgot-password|verify-reset-otp|reset-password|register(?:\/|$))/.test(requestPath)
  if ((status === 401 || status === 403) && !expectedUnauthenticatedPath) {
    notifyUnauthorized({ status, message: data.error || '' })
  }
  const error = new Error(data.error || `Request failed (${status})`)
  error.status = status
  error.data = data
  return error
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw createRequestError(response.status, path, data)
  return data
}

export async function apiStreamRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw createRequestError(response.status, path, data)
  }
  if (!response.body) throw new Error('Streaming responses are not supported by this browser.')
  return response.body
}
