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

export async function registerPushNotifications(userId: string): Promise<boolean> {
  // Navigate to standalone registration page.
  // Firebase Messaging crashes React when called in the main thread.
  // The standalone page uses the same Firebase CDN approach as test-push.html
  // which is proven to work, and saves the token via Edge Function (service role key).
  window.location.href = `/enable-notifications.html?uid=${encodeURIComponent(userId)}`
  return false
}

export async function unregisterPushNotifications(userId: string): Promise<void> {
  try {
    await supabase
      .from('profiles')
      .update({ push_token: null, push_enabled: false })
      .eq('id', userId)
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

export async function notifyNewPost(followerIds: string[], posterUsername: string, shopName: string, isQuickSip = false, isVibe = false) {
  const title = isVibe
    ? `${posterUsername} posted a vibe ✨`
    : isQuickSip
    ? `${posterUsername} had a quick sip ⚡`
    : `${posterUsername} rated a visit ☕`
  const body = shopName || 'Check it out on Social Brew'
  await Promise.all(followerIds.map(id =>
    sendPushToUser(id, title, body, { type: 'new_post', tag: 'new_post' })
  ))
}

export async function notifyDM(toUserId: string, fromUsername: string, messagePreview: string) {
  if (!toUserId) return
  await sendPushToUser(toUserId, `${fromUsername} sent you a message ☕`, messagePreview.slice(0, 100), { type: 'dm', tag: 'dm' })
}
