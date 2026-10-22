import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import process from 'node:process'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.API_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
    port: 5173,
  },
})
