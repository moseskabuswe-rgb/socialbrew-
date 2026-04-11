// Social Brew Service Worker
// Handles push notifications + auto-updates

const CACHE_NAME = 'social-brew-v1'

self.addEventListener('install', () => {
  // Take over immediately — don't wait for old SW to die
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  // Clear old caches
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Don't cache anything — always fetch fresh from network
// This ensures users always get the latest version
self.addEventListener('fetch', event => {
  // Let all requests go to network directly
  event.respondWith(fetch(event.request))
})

// Push notifications
self.addEventListener('push', event => {
  if (!event.data) return
  let data = {}
  try { data = event.data.json() } catch { data = { title: 'Social Brew', body: event.data.text() } }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Social Brew ☕', {
      body: data.body || 'You have a new notification',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [100, 50, 100],
      data: { url: data.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus()
      }
      return clients.openWindow('/')
    })
  )
})
