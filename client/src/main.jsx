import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
const appModule = window.location.pathname.startsWith('/admin')
  ? import('./admin/AdminApp.jsx')
  : import('./App.jsx')

appModule.then(({ default: App }) => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
