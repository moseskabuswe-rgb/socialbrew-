import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initAnalytics, identifyUser, trackEvent } from './lib/analytics' // correct path

// 1. Initialize PostHog
initAnalytics()

// 2. Identify a test user
identifyUser('test_user_1', { email: 'test@example.com' })

// 3. Track a test event
trackEvent('coffee_ordered', { coffee_type: 'latte', size: 'medium' })

// 4. Render the app
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
