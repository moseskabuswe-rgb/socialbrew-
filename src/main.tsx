import { initAnalytics, identifyUser, trackEvent } from './analytics'

// 1. Initialize PostHog
initAnalytics()

// 2. Identify the user (any string works)
identifyUser('test_user_1')

// 3. Track a test event
trackEvent('coffee_ordered', { coffee_type: 'latte', size: 'medium' })
