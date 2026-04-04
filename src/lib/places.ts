// Overpass API (OpenStreetMap) - free, no API key, works from browser
// Queries specifically for cafes/coffee shops only

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
  return CHAINS.some(c => name.toLowerCase().includes(c))
}

function mapOsmNode(node: any): PlaceShop {
  const t = node.tags || {}
  const addr = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ')
  return {
    id: `osm-${node.id}`,
    name: t.name || 'Coffee Shop',
    address: addr || t['addr:full'] || null,
    city: t['addr:city'] || null,
    state: t['addr:state'] || null,
    lat: node.lat ?? null,
    lng: node.lon ?? null,
    photo_url: null,
    avg_rating: 0,
    total_ratings: 0,
    weekly_visits: 0,
    is_certified: false,
    vibes: [],
    website: t.website || t['contact:website'] || null,
    phone: t.phone || t['contact:phone'] || null,
    _fromDb: false,
  }
}

// Fetch coffee shops near a location using Overpass
export async function fetchNearbyCoffeeShops(lat: number, lng: number, radiusMeters = 25000): Promise<PlaceShop[]> {
  // Query for cafes AND places with coffee in name/cuisine
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="cafe"]["name"](around:${radiusMeters},${lat},${lng});
      node["amenity"="coffee_shop"]["name"](around:${radiusMeters},${lat},${lng});
      node["cuisine"="coffee_shop"]["name"](around:${radiusMeters},${lat},${lng});
    );
    out body;
  `
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    })
    const data = await res.json()
    return (data.elements || [])
      .filter((n: any) => n.tags?.name && !isChain(n.tags.name))
      .map(mapOsmNode)
      .slice(0, 30)
  } catch {
    return []
  }
}

// Search by name using Overpass — searches wider area
export async function searchCoffeeShops(query: string, lat: number, lng: number): Promise<PlaceShop[]> {
  const q = query.toLowerCase()
  // Search in a large radius, filter by name match
  const overpassQuery = `
    [out:json][timeout:25];
    (
      node["amenity"="cafe"]["name"~"${q}",i](around:80000,${lat},${lng});
      node["amenity"="coffee_shop"]["name"~"${q}",i](around:80000,${lat},${lng});
      node["cuisine"="coffee_shop"]["name"~"${q}",i](around:80000,${lat},${lng});
    );
    out body;
  `
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
    })
    const data = await res.json()
    return (data.elements || [])
      .filter((n: any) => n.tags?.name)
      .map(mapOsmNode)
      .slice(0, 20)
  } catch {
    return []
  }
}
