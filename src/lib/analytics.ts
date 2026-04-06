import posthog from 'posthog-js'

// POSTHOG_KEY is your client key from PostHog
const POSTHOG_KEY = 'phc_rLczdbAiAbMoFRd83rwsdkxshZy7EEGnhCWEYLCNmycf'
const POSTHOG_HOST = 'https://us.i.posthog.com'

export function initAnalytics() {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage',
  })
  console.log('PostHog initialized')
}

export function identifyUser(userId: string) {
  posthog.identify(userId)
  console.log('User identified:', userId)
}

export function trackEvent(event: string, properties?: Record<string, any>) {
  posthog.capture(event, properties)
  console.log('Tracked event:', event, properties)
}

export function resetUser() {
  posthog.reset()
  console.log('User reset')
}
