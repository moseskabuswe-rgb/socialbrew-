import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GOOGLE_KEY = Deno.env.get('GOOGLE_PLACES_KEY') || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Major chains to always exclude from discover (not search)
const CHAINS = [
  'starbucks', 'dunkin', 'dutch bros', "peet's", 'caribou', 'tim hortons',
  'mcdonalds', "mcdonald's", 'panera', 'einstein', 'biggby', "scooter's",
  'costa coffee', 'burger king', 'wendy', 'subway', 'chick-fil-a', 'taco bell',
  'sonic', 'dominos', "domino's", 'pizza hut', 'kfc', 'chipotle', 'ihop', 'denny'
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { lat, lng, query, searchMode } = await req.json()

    let url: string

    if (query && searchMode) {
      // SEARCH MODE: user is typing a name — search all cafes/coffee shops, no restriction
      // This covers shops that might be named unusually
      url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=80000&type=cafe&key=${GOOGLE_KEY}`
    } else if (query) {
      // Targeted search within coffee shops
      url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' coffee cafe')}&location=${lat},${lng}&radius=50000&type=cafe&key=${GOOGLE_KEY}`
    } else {
      // DISCOVER MODE: proximity-based, coffee/cafe only
      url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=25000&type=cafe&keyword=coffee&rankby=prominence&key=${GOOGLE_KEY}`
    }

    const res = await fetch(url)
    const data = await res.json()

    const shops = (data.results || [])
      .filter((p: any) => {
        const name = (p.name || '').toLowerCase()
        // In search mode, don't filter chains (user is specifically looking for something)
        if (searchMode) return true
        return !CHAINS.some(c => name.includes(c))
      })
      .slice(0, searchMode ? 20 : 15) // more results in search mode
      .map((p: any) => ({
        id: `gpl-${p.place_id}`,
        name: p.name,
        address: p.vicinity || p.formatted_address || null,
        city: null,
        state: null,
        lat: p.geometry?.location?.lat || null,
        lng: p.geometry?.location?.lng || null,
        photo_url: p.photos?.[0]?.photo_reference
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${p.photos[0].photo_reference}&key=${GOOGLE_KEY}`
          : null,
        avg_rating: p.rating || 0,
        total_ratings: p.user_ratings_total || 0,
        weekly_visits: 0,
        is_certified: false,
        vibes: [],
        website: null,
        phone: p.formatted_phone_number || null,
      }))

    return new Response(JSON.stringify({ shops }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, shops: [] }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
