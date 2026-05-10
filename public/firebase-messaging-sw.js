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
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow('https://socialbrewapp.com')
    })
  )
})
