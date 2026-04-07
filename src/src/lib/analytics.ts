import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com'

export function initAnalytics() {
  if (!POSTHOG_KEY) return
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true, // automatically tracks clicks, inputs, etc.
    persistence: 'localStorage',
  })
}

export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return
  posthog.identify(userId, properties)
}

export function trackEvent(event: string, properties?: Record<string, any>) {
  if (!POSTHOG_KEY) return
  posthog.capture(event, properties)
}

export function resetUser() {
  if (!POSTHOG_KEY) return
  posthog.reset()
}
