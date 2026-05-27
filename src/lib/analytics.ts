import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || 'phc_rLczdbAiAbMoFRd83rwsdkxshZy7EEGnhCWEYLCNmycf'
const POSTHOG_HOST = 'https://us.i.posthog.com'

export function initAnalytics() {
  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: false,
      persistence: 'localStorage',
    })
  } catch { /* silently skip if CSP blocks eval */ }
}

export function identifyUser(userId: string, properties?: Record<string, any>) {
  try { posthog.identify(userId, properties) } catch { /* noop */ }
}

export function trackEvent(event: string, properties?: Record<string, any>) {
  try { posthog.capture(event, properties) } catch { /* noop */ }
}

export function resetUser() {
  try { posthog.reset() } catch { /* noop */ }
}
