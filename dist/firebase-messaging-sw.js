// public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js')

const firebaseConfig = {
  apiKey: "AIzaSyAyo_95tISPnqA1U8Q53JaFaomGc7meWYk",
  authDomain: "social-brew-206d3.firebaseapp.com",
  projectId: "social-brew-206d3",
  storageBucket: "social-brew-206d3.firebasestorage.app",
  messagingSenderId: "783967513849",
  appId: "1:783967513849:web:668f29777b863a8e8cc628"
}

firebase.initializeApp(firebaseConfig)
const messaging = firebase.messaging()

// Handle background messages (app closed / not focused)
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {}
  // Use notification fields first, fall back to data fields
  const title = payload.notification?.title || data.title || 'Social Brew'
  const body = payload.notification?.body || data.body || ''

  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: data.tag || 'social-brew',
    data,
    vibrate: [100, 50, 100],
  })
})

// Handle notification click — open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}

  // Build deep link URL from notification data
  let url = 'https://socialbrew-ani.pages.dev'
  if (data.type === 'like' || data.type === 'comment' || data.type === 'mention' || data.type === 'new_post') {
    if (data.rating_id) url = `https://socialbrew-ani.pages.dev/?open=post&id=${data.rating_id}`
  } else if (data.type === 'follow' || data.type === 'follow_request') {
    if (data.actor_id) url = `https://socialbrew-ani.pages.dev/?open=profile&id=${data.actor_id}`
  } else if (data.type === 'dm') {
    if (data.actor_id) url = `https://socialbrew-ani.pages.dev/?open=messages&id=${data.actor_id}`
  } else if (data.type === 'follow_request') {
    url = `https://socialbrew-ani.pages.dev/?open=follow_requests`
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it and send a message to navigate
      for (const client of clientList) {
        if (client.url.includes('socialbrew-ani.pages.dev') && 'focus' in client) {
          client.focus()
          client.postMessage({ type: 'NOTIFICATION_CLICK', url, data })
          return
        }
      }
      // App is closed — open with deep link URL
      return clients.openWindow(url)
    })
  )
})
