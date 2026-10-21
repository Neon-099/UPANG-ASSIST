import { io } from 'socket.io-client'
import { notifyUnauthorized } from './api'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const socketOrigin = /^https?:\/\//i.test(apiBaseUrl) ? new URL(apiBaseUrl).origin : undefined

export function createSupportSocket() {
  const socket = io(socketOrigin, { withCredentials: true, autoConnect: false, reconnection: true })
  socket.on('connect_error', (error) => {
    if (/authentication required|invalid or expired authentication|valid active school account required/i.test(error.message || '')) {
      notifyUnauthorized({ status: 401, message: error.message })
    }
  })
  return socket
}
