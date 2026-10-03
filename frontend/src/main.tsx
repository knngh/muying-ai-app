import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles/index.css'

// Keep other tabs from retaining a previous account after sign-out/sign-in.
window.addEventListener('storage', (event) => {
  if (event.key === 'token' && event.newValue === null) window.location.replace('/login')
  if (event.key === 'app_user') {
    const id = (value: string | null) => {
      try { return value ? JSON.parse(value)?.id : null } catch { return null }
    }
    if (id(event.oldValue) !== id(event.newValue)) window.location.replace(event.newValue ? '/knowledge' : '/login')
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
