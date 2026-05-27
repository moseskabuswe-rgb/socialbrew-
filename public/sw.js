// Social Brew Service Worker v4
// Handles push notifications, offline caching, and auto-updates

const CACHE_NAME = 'social-brew-v4'
const APP_SHELL = ['/', '/manifest.json', '/icon-192.png']

// ── Install: pre-cache app shell, do NOT skip waiting ────────
// skipWaiting was removed — it caused forced page reloads during
// active sessions whenever an update deployed (blank screen on resume).
// New SWs now wait until all tabs are closed before activating.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  )
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

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  // Navigation requests (HTML) — cache-first so the app shell loads instantly
  // even on slow connections or when resuming from background
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('/').then(cached => cached || fetch(event.request))
    )
    return
  }

  // All other GET requests — network-first with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})

// ── Push notification handler ────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let title = 'Social Brew ☕'
  let body = ''
  let icon = '/icon-192.png'
  let badge = '/icon-192.png'
  let tag = 'social-brew'
  let data = {}

  try {
    const payload = event.data.json()

    if (payload.notification) {
      title = payload.notification.title || title
      body = payload.notification.body || body
      icon = payload.notification.icon || icon
      badge = payload.notification.badge || badge
      tag = payload.notification.tag || tag
    }

    if (payload.data) {
      title = payload.data.title || title
      body = payload.data.body || body
      tag = payload.data.tag || tag
      data = payload.data
    }

    if (payload.title) title = payload.title
    if (payload.body) body = payload.body
    if (payload.tag) tag = payload.tag
  } catch {
    body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      data,
      vibrate: [100, 50, 100],
      renotify: false,
      requireInteraction: false,
    })
  )
})

// ── Notification click: open or focus app ────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const notifData = event.notification.data || {}
  let targetUrl = 'https://socialbrewapp.com'

  if (notifData.rating_id) targetUrl += `/?open=post&id=${notifData.rating_id}`
  else if (notifData.actor_id && (notifData.type === 'follow' || notifData.type === 'dm')) {
    targetUrl += `/?open=${notifData.type === 'dm' ? 'messages' : 'profile'}&id=${notifData.actor_id}`
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url.startsWith('https://socialbrewapp.com') && 'focus' in client) {
            client.postMessage({ type: 'NOTIFICATION_CLICK', data: notifData })
            return client.focus()
          }
        }
        if (clients.openWindow) return clients.openWindow(targetUrl)
      })
  )
})

// ── Push subscription change (Firefox Android) ───────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self.VAPID_PUBLIC_KEY || null,
    }).then(subscription => {
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
