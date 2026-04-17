// src/lib/push.ts

import { supabase } from './supabase'

const SUPABASE_URL = 'https://pifpkfuulfnweeiqufbq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZnBrZnV1bGZud2VlaXF1ZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjY5ODIsImV4cCI6MjA5MTM0Mjk4Mn0.5jtK3M5Y-ZQdqXlBL1FLxsr10najtUfpQ3pTP8eimpw'

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

// Get FCM token via hidden iframe — isolates Firebase from React context
// This is the only approach that avoids Firebase crashing the React app
function getFCMTokenViaIframe(): Promise<string | null> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.src = '/get-token.html'
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none'

    const timeout = setTimeout(() => {
      cleanup()
      resolve(null)
    }, 20000)

    function cleanup() {
      clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== 'fcm-token') return
      cleanup()
      resolve(event.data.token || null)
    }

    window.addEventListener('message', onMessage)
    document.body.appendChild(iframe)
  })
}

export async function registerPushNotifications(userId: string): Promise<boolean> {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return false

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isIOSPWA = (window.navigator as any).standalone === true
    if (isIOS && !isIOSPWA) {
      alert('To receive notifications, tap the Share button in Safari and select "Add to Home Screen", then reopen the app.')
      return false
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    // Register service worker — iframe will use this
    await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
    await navigator.serviceWorker.ready

    // Get token via iframe (Firebase runs isolated from React)
    const token = await getFCMTokenViaIframe()

    if (!token) {
      console.error('No FCM token received')
      return false
    }

    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token, push_enabled: true })
      .eq('id', userId)

    if (error) {
      console.error('Token save failed:', error)
      return false
    }

    console.log('Push token saved successfully')
    return true
  } catch (err) {
    console.error('Push registration failed:', err)
    return false
  }
}

export async function unregisterPushNotifications(userId: string): Promise<void> {
  try {
    const swReg = await navigator.serviceWorker.ready
    const subscription = await swReg.pushManager.getSubscription()
    if (subscription) await subscription.unsubscribe()
    await supabase.from('profiles').update({ push_token: null, push_enabled: false }).eq('id', userId)
  } catch (err) {
    console.error('Push unregister failed:', err)
  }
}

export async function sendPushToUser(targetUserId: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
  try { await callEdgeFunction({ targetUserId, title, body, data }) } catch (err) { console.error('sendPushToUser failed:', err) }
}

export async function sendBroadcastNotification(title: string, body: string, data?: Record<string, string>): Promise<void> {
  try { await callEdgeFunction({ broadcast: true, title, body, data }) } catch (err) { console.error('sendBroadcastNotification failed:', err) }
}

export async function notifyLike(postOwnerId: string, likerUsername: string) {
  if (!postOwnerId) return
  await sendPushToUser(postOwnerId, 'Someone liked your brew ☕', `${likerUsername} liked your post`, { type: 'like', tag: 'like' })
}

export async function notifyComment(postOwnerId: string, commenterUsername: string, commentPreview: string) {
  if (!postOwnerId) return
  await sendPushToUser(postOwnerId, `${commenterUsername} commented`, commentPreview.slice(0, 100), { type: 'comment', tag: 'comment' })
}

export async function notifyFollow(followedUserId: string, followerUsername: string) {
  if (!followedUserId) return
  await sendPushToUser(followedUserId, 'New follower!', `${followerUsername} started following you`, { type: 'follow', tag: 'follow' })
}

export async function notifyMention(mentionedUserId: string, mentionerUsername: string, context: string) {
  if (!mentionedUserId) return
  await sendPushToUser(mentionedUserId, `${mentionerUsername} mentioned you`, context.slice(0, 100), { type: 'mention', tag: 'mention' })
}

export async function notifyDM(toUserId: string, fromUsername: string, messagePreview: string) {
  if (!toUserId) return
  await sendPushToUser(toUserId, `${fromUsername} sent you a message ☕`, messagePreview.slice(0, 100), { type: 'dm', tag: 'dm' })
}
