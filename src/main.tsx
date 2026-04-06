import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { initAnalytics, identifyUser, trackEvent } from './analytics'

// 1. Initialize PostHog
initAnalytics()

// 2. Identify the user
identifyUser('test_user_1')

// 3. Track a test event
trackEvent('coffee_ordered', { coffee_type: 'latte', size: 'medium' })

// 4. Render the app
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
