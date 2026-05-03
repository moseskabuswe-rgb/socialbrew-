/**
 * useWishlistProximity.ts
 *
 * On app open, checks user's geolocation against all unnotified
 * visit_wishlist entries. If any saved shop is within 0.5 miles,
 * sends a push notification and marks it as notified.
 *
 * Usage: call once in App.tsx after auth is confirmed.
 */

import { useEffect } from 'react'
import { supabase } from './supabase'
import { sendPushToUser } from './push'

// Haversine formula — returns distance in miles
function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function useWishlistProximity(userId: string | null) {
  useEffect(() => {
    if (!userId) return
    if (!navigator.geolocation) return

    // Only run once per session using sessionStorage flag
    const sessionKey = `sb_wishlist_check_${userId}`
    if (sessionStorage.getItem(sessionKey)) return
    sessionStorage.setItem(sessionKey, '1')

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: userLat, longitude: userLng } = pos.coords

        // Fetch all unnotified wishlist entries for this user
        const { data: wishlist, error } = await supabase
          .from('visit_wishlist')
          .select('id, shop_name, lat, lng')
          .eq('user_id', userId)
          .eq('notified', false)

        if (error || !wishlist || wishlist.length === 0) return

        for (const entry of wishlist) {
          if (!entry.lat || !entry.lng) continue
          const dist = haversineMiles(userLat, userLng, entry.lat, entry.lng)
          if (dist <= 0.5) {
            // Send push notification
            await sendPushToUser(
              userId,
              `You're near ${entry.shop_name} ☕`,
              "It's on your visit wishlist — now's your chance!",
              { type: 'wishlist_proximity', shopName: entry.shop_name }
            )
            // Mark as notified so it doesn't fire again
            await supabase
              .from('visit_wishlist')
              .update({ notified: true })
              .eq('id', entry.id)
          }
        }
      },
      () => { /* Geolocation denied or unavailable — fail silently */ },
      { timeout: 5000, maximumAge: 60000 }
    )
  }, [userId])
}
