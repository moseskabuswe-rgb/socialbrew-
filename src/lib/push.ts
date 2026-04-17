// src/lib/push.ts

import { supabase } from './supabase'

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAyo_95tISPnqA1U8Q53JaFaomGc7meWYk",
  authDomain: "social-brew-206d3.firebaseapp.com",
  projectId: "social-brew-206d3",
  storageBucket: "social-brew-206d3.firebasestorage.app",
  messagingSenderId: "783967513849",
  appId: "1:783967513849:web:668f29777b863a8e8cc628"
}

const SUPABASE_URL = 'https://pifpkfuulfnweeiqufbq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZnBrZnV1bGZud2VlaXF1ZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjY5ODIsImV4cCI6MjA5MTM0Mjk4Mn0.5jtK3M5Y-ZQdqXlBL1FLxsr10najtUfpQ3pTP8eimpw'
const VAPID_KEY = "BA1W2abkOqr3ozttsf6gx31wNsrYZOeIkKIbiQ76eNzlINmsmxaJw2r4RZU-PG_7r3Bg7gH3pcVUdB-zIFAJcEs"

async function callEdgeFunction(body: object): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body)
    })
  } catch (err) {
    console.error('Edge function call failed:', err)
  }
}

let messagingInstance: any = null

async function getMessaging() {
  if (messagingInstance) return messagingInstance
  const { initializeApp, getApps } = await import('firebase/app')
  const { getMessaging: getFCMMessaging } = await import('firebase/messaging')
  const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
  messagingInstance = getFCMMessaging(app)
  return messagingInstance
}

export async function registerPushNotifications(userId: string): Promise<boolean> {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false

    // iOS must be installed as PWA
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isIOSPWA = (window.navigator as any).standalone === true
    if (isIOS && !isIOSPWA) {
      alert('To receive notifications, tap the Share button in Safari and select "Add to Home Screen", then reopen the app.')
      return false
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    // Register service worker with timeout
    let swReg: ServiceWorkerRegistration
    try {
      swReg = await Promise.race([
        navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 8000))
      ]) as ServiceWorkerRegistration
    } catch (e) {
      console.error('Service worker registration failed:', e)
      return false
    }

    // Wait for SW to be ready with timeout
    try {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), 8000))
      ])
    } catch (e) {
      console.error('Service worker ready timeout:', e)
      return false
    }

    // Get FCM token with timeout
    let token: string
    try {
      const { initializeApp, getApps } = await import('firebase/app')
      const { getMessaging: getFCMMessaging, getToken } = await import('firebase/messaging')
      const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG)
      const messaging = getFCMMessaging(app)
      token = await Promise.race([
        getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Token timeout')), 10000))
      ]) as string
    } catch (e) {
      console.error('FCM token fetch failed:', e)
      return false
    }

    if (!token) return false

    await supabase
      .from('profiles')
      .update({ push_token: token, push_enabled: true })
      .eq('id', userId)

    return true
  } catch (err) {
    console.error('Push registration failed:', err)
    return false
  }
}

export async function unregisterPushNotifications(userId: string): Promise<void> {
  try {
    const messaging = await getMessaging()
    const { deleteToken } = await import('firebase/messaging')
    await deleteToken(messaging)
    await supabase
      .from('profiles')
      .update({ push_token: null, push_enabled: false })
      .eq('id', userId)
  } catch (err) {
    console.error('Push unregister failed:', err)
  }
}

// Called by the app to send a notification to another user via Edge Function
export async function sendPushToUser(
  targetUserId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    await callEdgeFunction({ targetUserId, title, body, data })
  } catch (err) {
    console.error('sendPushToUser failed:', err)
  }
}

// Broadcast to all users (admin only)
export async function sendBroadcastNotification(
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    await callEdgeFunction({ broadcast: true, title, body, data })
  } catch (err) {
    console.error('sendBroadcastNotification failed:', err)
  }
}

// Notification helpers — called throughout the app
export async function notifyLike(postOwnerId: string, likerUsername: string) {
  if (!postOwnerId) return
  await sendPushToUser(
    postOwnerId,
    'Someone liked your brew ☕',
    `${likerUsername} liked your post`,
    { type: 'like', tag: 'like' }
  )
}

export async function notifyComment(postOwnerId: string, commenterUsername: string, commentPreview: string) {
  if (!postOwnerId) return
  await sendPushToUser(
    postOwnerId,
    `${commenterUsername} commented`,
    commentPreview.slice(0, 100),
    { type: 'comment', tag: 'comment' }
  )
}

export async function notifyFollow(followedUserId: string, followerUsername: string) {
  if (!followedUserId) return
  await sendPushToUser(
    followedUserId,
    'New follower!',
    `${followerUsername} started following you`,
    { type: 'follow', tag: 'follow' }
  )
}

export async function notifyMention(mentionedUserId: string, mentionerUsername: string, context: string) {
  if (!mentionedUserId) return
  await sendPushToUser(
    mentionedUserId,
    `${mentionerUsername} mentioned you`,
    context.slice(0, 100),
    { type: 'mention', tag: 'mention' }
  )
}

export async function notifyDM(toUserId: string, fromUsername: string, messagePreview: string) {
  if (!toUserId) return
  await sendPushToUser(
    toUserId,
    `${fromUsername} sent you a message ☕`,
    messagePreview.slice(0, 100),
    { type: 'dm', tag: 'dm' }
  )
}
