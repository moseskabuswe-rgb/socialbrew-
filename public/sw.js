// Social Brew Service Worker
// Handles push notifications and ensures users always get latest version

const CACHE_NAME = 'social-brew-v2'

self.addEventListener('install', () => {
  // Take over immediately — don't wait for old SW to die
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  // Clear old caches on activation
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// Don't cache anything — always fetch fresh from network
// This ensures users always get the latest version on every deploy
self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request))
})

// Push notification handler
// iOS Safari PWAs receive push via this handler
// event.data contains the FCM payload
self.addEventListener('push', event => {
  if (!event.data) return

  let title = 'Social Brew'
  let body = ''
  const icon = '/icons/icon-192.png'
  const badge = '/icons/icon-72.png'

  try {
    const payload = event.data.json()
    // FCM webpush notification fields
    if (payload.notification) {
      title = payload.notification.title || title
      body = payload.notification.body || body
    }
    // Data fields as fallback
    if (payload.data) {
      title = payload.data.title || title
      body = payload.data.body || body
    }
  } catch {
    body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      vibrate: [100, 50, 100],
    })
  )
})

// When user taps a notification — open or focus the app
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if ('focus' in client) return client.focus()
        }
        return clients.openWindow('https://socialbrew-ani.pages.dev')
      })
  )
})
