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
// iOS Safari PWAs receive push via this handler (onBackgroundMessage does not fire on iOS)
// The webpush.notification fields from FCM are available in event.data
self.addEventListener('push', event => {
  if (!event.data) return

  let title = 'Social Brew'
  let body = ''
  let icon = '/icons/icon-192.png'
  let badge = '/icons/icon-72.png'

  try {
    const payload = event.data.json()
    // FCM webpush notification fields land here on iOS
    if (payload.notification) {
      title = payload.notification.title || title
      body = payload.notification.body || body
    }
    // Also check data fields as fallback
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

self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow('https://socialbrew-ani.pages.dev')
    })
  )
})
