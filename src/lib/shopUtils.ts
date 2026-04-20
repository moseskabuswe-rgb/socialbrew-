// src/lib/shopUtils.ts
// Utility to auto-add OSM shops to the Social Brew database when a user rates them.
// This allows the database to grow organically from real user visits.

import { supabase } from './supabase'

const CHAINS = [
  'starbucks', 'dunkin', 'dutch bros', "peet's", 'caribou', 'tim hortons',
  "mcdonald's", 'mcdonalds', 'panera', 'einstein', 'biggby', "scooter's",
  'costa coffee', 'burger king', 'wendys', 'subway', 'chick-fil-a',
  'taco bell', 'chipotle', 'dairy queen', 'little caesars', 'popeyes',
]

function isChain(name: string) {
  return CHAINS.some(c => name.toLowerCase().includes(c))
}

/**
 * Given a shop object (which may be an OSM shop with an 'osm-' prefixed id),
 * returns the real database UUID to use as shop_id when saving a rating.
 *
 * If the shop is already in the database, returns its existing id.
 * If the shop is from OSM and not a chain, inserts it into coffee_shops
 * and returns the new UUID.
 * If the shop is a chain or insert fails, returns null.
 */
export async function resolveShopId(shop: any): Promise<string | null> {
  if (!shop?.id) return null

  // Already a real DB shop
  const isOsm = String(shop.id).startsWith('osm-')
  const isFsq = String(shop.id).startsWith('fsq-')
  const isGpl = String(shop.id).startsWith('gpl-')

  if (!isOsm && !isFsq && !isGpl) {
    return shop.id
  }

  // OSM shop — check if it's a chain first
  if (!shop.name || isChain(shop.name)) return null

  // Check if already exists in DB by name + approximate location
  if (shop.lat && shop.lng) {
    const { data: existing } = await supabase
      .from('coffee_shops')
      .select('id')
      .ilike('name', shop.name)
      .gte('lat', shop.lat - 0.001)
      .lte('lat', shop.lat + 0.001)
      .gte('lng', shop.lng - 0.001)
      .lte('lng', shop.lng + 0.001)
      .maybeSingle()

    if (existing?.id) return existing.id
  } else {
    // No coordinates — check by name only
    const { data: existing } = await supabase
      .from('coffee_shops')
      .select('id')
      .ilike('name', shop.name)
      .maybeSingle()

    if (existing?.id) return existing.id
  }

  // Not in DB — insert it as a community-added shop
  const { data: inserted, error } = await supabase
    .from('coffee_shops')
    .insert({
      name: shop.name,
      address: shop.address || null,
      city: shop.city || null,
      state: shop.state || null,
      lat: shop.lat || null,
      lng: shop.lng || null,
      website: shop.website || null,
      opening_hours: shop.opening_hours || null,
      is_verified: false,
      is_active: true,
      avg_rating: 0,
      total_ratings: 0,
      weekly_visits: 0,
      vibes: [],
    })
    .select('id')
    .single()

  if (error || !inserted) {
    console.error('Failed to auto-add shop:', error?.message)
    return null
  }

  console.log(`Auto-added shop to Social Brew: ${shop.name}`)
  return inserted.id
}
