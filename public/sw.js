// Social Brew Service Worker v3
// Handles push notifications, offline caching, and auto-updates
// Fixed for Android Firefox/Chrome strict SW scoping

const CACHE_NAME = 'social-brew-v3'

// ── Install: take over immediately ───────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// ── Activate: clear old caches, claim clients ────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── Fetch: network-first for all requests ────────────────────
self.addEventListener('fetch', (event) => {
  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})

// ── Push notification handler ────────────────────────────────
// Works on iOS Safari PWA, Android Chrome, Android Firefox
// Firefox note: requires strict same-origin SW scope
self.addEventListener('push', (event) => {
  if (!event.data) return

  let title = 'Social Brew ☕'
  let body = ''
  let icon = '/icons/icon-192.png'
  let badge = '/icons/icon-72.png'
  let tag = 'social-brew'
  let data = {}

  try {
    const payload = event.data.json()

    // Standard web push payload
    if (payload.notification) {
      title = payload.notification.title || title
      body = payload.notification.body || body
      icon = payload.notification.icon || icon
      badge = payload.notification.badge || badge
      tag = payload.notification.tag || tag
    }

    // FCM data payload fallback
    if (payload.data) {
      title = payload.data.title || title
      body = payload.data.body || body
      tag = payload.data.tag || tag
      data = payload.data
    }

    // Direct payload (our Edge Function format)
    if (payload.title) title = payload.title
    if (payload.body) body = payload.body
    if (payload.tag) tag = payload.tag
  } catch {
    // Plain text fallback
    body = event.data.text()
  }

  const options = {
    body,
    icon,
    badge,
    tag,
    data,
    // Android: vibrate pattern
    vibrate: [100, 50, 100],
    // Prevents notification stacking for same tag
    renotify: false,
    // Required for Firefox Android
    requireInteraction: false,
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// ── Notification click: open or focus app ────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = 'https://socialbrew-ani.pages.dev'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url.startsWith(targetUrl) && 'focus' in client) {
            return client.focus()
          }
        }
        // Open new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl)
        }
      })
  )
})

// ── Push subscription change (Firefox Android) ───────────────
// Firefox may rotate push subscriptions — handle gracefully
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    // Re-subscribe and update server
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.VAPID_PUBLIC_KEY || null,
    }).then(subscription => {
      // Notify app to update subscription in database
      return clients.matchAll({ type: 'window' }).then(clientList => {
        clientList.forEach(client => {
          client.postMessage({
            type: 'PUSH_SUBSCRIPTION_CHANGED',
            subscription: JSON.parse(JSON.stringify(subscription))
          })
        })
      })
    }).catch(err => {
      console.error('Push resubscription failed:', err)
    })
  )
})
