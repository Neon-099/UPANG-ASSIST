import { io } from 'socket.io-client'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const socketOrigin = /^https?:\/\//i.test(apiBaseUrl) ? new URL(apiBaseUrl).origin : undefined

export function createSupportSocket() {
  return io(socketOrigin, { withCredentials: true, autoConnect: false, reconnection: true })
}
