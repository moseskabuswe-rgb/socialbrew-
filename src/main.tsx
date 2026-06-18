import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initAnalytics } from './lib/analytics'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    // Check for updates when user returns to the tab.
    // Listener is stored so it can be removed if the registration is replaced.
    const onVisibility = () => { if (document.visibilityState === 'visible') reg.update() }
    document.addEventListener('visibilitychange', onVisibility)
  }).catch(() => {})
}

initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
