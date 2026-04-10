import { supabase } from './supabase'

export async function requestPushPermission(userId: string): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (!('serviceWorker' in navigator)) return false

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    // Register service worker
    await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // Subscribe to push (simplified - uses Notification API directly for now)
    // Store that this user wants push notifications
    await supabase.from('profiles').update({ 
      push_subscription: { enabled: true, permission: 'granted' } 
    }).eq('id', userId)

    return true
  } catch (err) {
    console.error('Push setup failed:', err)
    return false
  }
}

// Show a local notification (works when app is open or in background)
export async function showLocalNotification(title: string, body: string, url?: string) {
  if (!('serviceWorker' in navigator)) return
  if (Notification.permission !== 'granted') return
  
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    if (reg) {
      await reg.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [100, 50, 100],
        data: { url: url || '/' },
      } as any)
    } else {
      // Fallback to basic Notification API
      new Notification(title, { body, icon: '/icon-192.png' })
    }
  } catch {
    try { new Notification(title, { body, icon: '/icon-192.png' }) } catch { /* silent */ }
  }
}

// Parse @mentions from text and return usernames
export function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-z0-9_.]+)/gi) || []
  return matches.map(m => m.slice(1).toLowerCase())
}

// Send in-app notification
export async function sendNotification(params: {
  userId: string
  actorId: string
  type: 'like' | 'comment' | 'follow' | 'new_post' | 'mention'
  ratingId?: string
  message?: string
}) {
  if (params.userId === params.actorId) return // Don't notify yourself
  try {
    await supabase.from('notifications').insert({
      user_id: params.userId,
      actor_id: params.actorId,
      type: params.type,
      rating_id: params.ratingId || null,
    })
  } catch { /* silent */ }
}

// Notify all followers when someone posts
export async function notifyFollowersOfPost(actorId: string, ratingId: string) {
  try {
    const { data: follows } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', actorId)
    
    if (!follows || follows.length === 0) return
    
    // Insert notifications for all followers
    const notifications = follows.map((f: any) => ({
      user_id: f.follower_id,
      actor_id: actorId,
      type: 'new_post',
      rating_id: ratingId,
    }))
    
    await supabase.from('notifications').insert(notifications)
  } catch { /* silent */ }
}

// Notify mentioned users
export async function notifyMentions(text: string, actorId: string, ratingId?: string) {
  const usernames = extractMentions(text)
  if (usernames.length === 0) return
  
  try {
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .in('username', usernames)
      .neq('id', actorId)
    
    if (!users || users.length === 0) return
    
    const notifications = users.map((u: any) => ({
      user_id: u.id,
      actor_id: actorId,
      type: 'mention',
      rating_id: ratingId || null,
    }))
    
    await supabase.from('notifications').insert(notifications)
  } catch { /* silent */ }
}
