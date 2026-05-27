// src/lib/push.ts

import { supabase } from './supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pifpkfuulfnweeiqufbq.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpZnBrZnV1bGZud2VlaXF1ZmJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjY5ODIsImV4cCI6MjA5MTM0Mjk4Mn0.5jtK3M5Y-ZQdqXlBL1FLxsr10najtUfpQ3pTP8eimpw'

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
  // Firebase Messaging must run in a standalone page (crashes React's event loop).
  // Open as popup so app state is preserved.
  const url = `/enable-notifications.html?uid=${encodeURIComponent(userId)}`
  const popup = window.open(url, 'sb-push-setup', 'width=480,height=360,menubar=no,toolbar=no,location=no')
  if (!popup) {
    // Popup blocked — fall back to full navigation
    window.location.href = url
  }
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

export async function notifyLike(postOwnerId: string, likerUsername: string, ratingId?: string) {
  if (!postOwnerId) return
  const data: Record<string, string> = { type: 'like', tag: 'like' }
  if (ratingId) data.rating_id = ratingId
  await sendPushToUser(postOwnerId, 'Someone liked your brew ☕', `${likerUsername} liked your post`, data)
}

export async function notifyComment(postOwnerId: string, commenterUsername: string, commentPreview: string, ratingId?: string) {
  if (!postOwnerId) return
  const data: Record<string, string> = { type: 'comment', tag: 'comment' }
  if (ratingId) data.rating_id = ratingId
  await sendPushToUser(postOwnerId, `${commenterUsername} commented`, commentPreview.slice(0, 100), data)
}

export async function notifyFollow(followedUserId: string, followerUsername: string, actorId?: string) {
  if (!followedUserId) return
  const data: Record<string, string> = { type: 'follow', tag: 'follow' }
  if (actorId) data.actor_id = actorId
  await sendPushToUser(followedUserId, 'New follower!', `${followerUsername} started following you`, data)
}

export async function notifyMention(mentionedUserId: string, mentionerUsername: string, context: string, ratingId?: string) {
  if (!mentionedUserId) return
  const data: Record<string, string> = { type: 'mention', tag: 'mention' }
  if (ratingId) data.rating_id = ratingId
  await sendPushToUser(mentionedUserId, `${mentionerUsername} mentioned you`, context.slice(0, 100), data)
}

export async function notifyNewPost(followerIds: string[], posterUsername: string, shopName: string, isQuickSip = false, isVibe = false, ratingId?: string) {
  const title = isVibe
    ? `${posterUsername} posted a vibe ✨`
    : isQuickSip
    ? `${posterUsername} had a quick sip ⚡`
    : `${posterUsername} rated a visit ☕`
  const body = shopName || 'Check it out on Social Brew'
  const data: Record<string, string> = { type: 'new_post', tag: 'new_post' }
  if (ratingId) data.rating_id = ratingId
  await Promise.all(followerIds.map(id =>
    sendPushToUser(id, title, body, data)
  ))
}

export async function notifyDM(toUserId: string, fromUsername: string, messagePreview: string, actorId?: string) {
  if (!toUserId) return
  const data: Record<string, string> = { type: 'dm', tag: 'dm' }
  if (actorId) data.actor_id = actorId
  await sendPushToUser(toUserId, `${fromUsername} sent you a message ☕`, messagePreview.slice(0, 100), data)
}
