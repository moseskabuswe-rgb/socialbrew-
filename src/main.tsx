import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initAnalytics } from './lib/analytics'

// Unregister OLD service workers (old hash-prefixed ones from Cloudflare previews)
// but keep our own /sw.js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const reg of registrations) {
      if (!reg.scope.endsWith('/') || reg.active?.scriptURL?.includes('sw.js')) continue
      reg.unregister()
    }
  })

  // Register our push notification service worker
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Silent fail — push notifications just won't work
  })
}

initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
