// Direct Google Places API calls - no Edge Function needed
const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY || ''

export interface PlaceShop {
  id: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  lat: number | null
  lng: number | null
  photo_url: string | null
  avg_rating: number
  total_ratings: number
  weekly_visits: number
  is_certified: boolean
  vibes: string[]
  website: string | null
  phone: string | null
  _fromDb: boolean
}

const CHAINS = [
  'starbucks', 'dunkin', 'dutch bros', "peet's", 'caribou', 'tim hortons',
  'mcdonalds', "mcdonald's", 'panera', 'einstein', 'biggby', "scooter's",
  'costa coffee', 'burger king', 'wendy', 'subway', 'chick-fil-a', 'taco bell',
  'sonic', "domino's", 'pizza hut', 'kfc', 'chipotle', 'ihop', "denny's"
]

function isChain(name: string) {
  const lower = name.toLowerCase()
  return CHAINS.some(c => lower.includes(c))
}

function buildPhotoUrl(ref: string) {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${ref}&key=${GOOGLE_KEY}`
}

function mapPlace(p: any): PlaceShop {
  return {
    id: `gpl-${p.place_id}`,
    name: p.name,
    address: p.vicinity || p.formatted_address || null,
    city: null,
    state: null,
    lat: p.geometry?.location?.lat ?? null,
    lng: p.geometry?.location?.lng ?? null,
    photo_url: p.photos?.[0]?.photo_reference ? buildPhotoUrl(p.photos[0].photo_reference) : null,
    avg_rating: p.rating ?? 0,
    total_ratings: p.user_ratings_total ?? 0,
    weekly_visits: 0,
    is_certified: false,
    vibes: [],
    website: null,
    phone: null,
    _fromDb: false,
  }
}

// Nearby coffee shops for discover/default view
export async function fetchNearbyCoffeeShops(lat: number, lng: number): Promise<PlaceShop[]> {
  if (!GOOGLE_KEY) return []
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=25000&type=cafe&keyword=coffee&rankby=prominence&key=${GOOGLE_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    return (data.results || [])
      .filter((p: any) => !isChain(p.name))
      .slice(0, 20)
      .map(mapPlace)
  } catch {
    return []
  }
}

// Search — broader, includes all cafes, no chain filter
export async function searchCoffeeShops(query: string, lat: number, lng: number): Promise<PlaceShop[]> {
  if (!GOOGLE_KEY || !query.trim()) return []
  try {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' cafe coffee')}&location=${lat},${lng}&radius=80000&type=cafe&key=${GOOGLE_KEY}`
    const res = await fetch(url)
    const data = await res.json()
    return (data.results || []).slice(0, 20).map(mapPlace)
  } catch {
    return []
  }
}
