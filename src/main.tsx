import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initAnalytics } from './lib/analytics'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    // Check for updates when user returns to the tab
    // New SWs wait until all tabs close before activating (no forced reloads)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update()
    })
  }).catch(() => {})
}

initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
