import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
    },
    port: 5173,
  },
})
