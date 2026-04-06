import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.phc_rLczdbAiAbMoFRd83rwsdkxshZy7EEGnhCWEYLCNmycf
const POSTHOG_HOST = import.meta.env.https://us.i.posthog.com || 'https://app.posthog.com'

export function initAnalytics() {
  if (!phc_rLczdbAiAbMoFRd83rwsdkxshZy7EEGnhCWEYLCNmycf) return
  posthog.init(phc_rLczdbAiAbMoFRd83rwsdkxshZy7EEGnhCWEYLCNmycf, {
    api_host: https://us.i.posthog.com,
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true, // automatically tracks clicks, inputs, etc.
    persistence: 'localStorage',
  })
}

export function identifyUser(userId: string, properties?: Record<string, any>) {
  if (!phc_rLczdbAiAbMoFRd83rwsdkxshZy7EEGnhCWEYLCNmycf) return
  posthog.identify(userId, properties)
}

export function trackEvent(event: string, properties?: Record<string, any>) {
  if (!phc_rLczdbAiAbMoFRd83rwsdkxshZy7EEGnhCWEYLCNmycf) return
  posthog.capture(event, properties)
}

export function resetUser() {
  if (!phc_rLczdbAiAbMoFRd83rwsdkxshZy7EEGnhCWEYLCNmycf) return
  posthog.reset()
}
