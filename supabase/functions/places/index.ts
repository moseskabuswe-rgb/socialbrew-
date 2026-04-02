import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const GOOGLE_KEY = Deno.env.get('GOOGLE_PLACES_KEY') || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { lat, lng, query } = await req.json()

    let url: string
    if (query) {
      // Text search - for when user types a specific shop name
      url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' coffee shop')}&location=${lat},${lng}&radius=50000&type=cafe&key=${GOOGLE_KEY}`
    } else {
      // Nearby search - independent coffee shops near location
      url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=25000&type=cafe&keyword=coffee&key=${GOOGLE_KEY}`
    }

    const res = await fetch(url)
    const data = await res.json()

    // Chain names to filter out
    const chains = ['starbucks', 'dunkin', 'dutch bros', "peet's", 'caribou', 'tim hortons',
      'mcdonalds', "mcdonald's", 'panera', 'einstein', 'biggby', "scooter's",
      'costa coffee', 'burger king', 'wendys', 'subway', 'chick-fil-a', 'taco bell']

    const shops = (data.results || [])
      .filter((p: any) => {
        const name = (p.name || '').toLowerCase()
        return !chains.some(c => name.includes(c))
      })
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
