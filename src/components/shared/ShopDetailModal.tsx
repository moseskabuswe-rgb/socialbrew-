import { useState, useEffect } from 'react'
import { X, MapPin, Globe, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CoffeeShop } from '../../lib/supabase'

type Props = {
  shop: Partial<CoffeeShop> & { id: string; name: string }
  onClose: () => void
}

type Rating = {
  id: string
  fill_level: number
  drink_name: string | null
  caption: string | null
  created_at: string
  profiles: { username: string; avatar_url: string | null }
}

function getFillLabel(fill: number) {
  if (fill <= 20) return 'Just a Sip'
  if (fill <= 40) return 'Getting There'
  if (fill <= 60) return 'Half Cup'
  if (fill <= 80) return 'Good Pour'
  if (fill <= 95) return 'Almost Perfect'
  return 'Perfect Brew ✨'
}

function getMugColor(fill: number) {
  if (fill <= 20) return '#b0c4d4'
  if (fill <= 40) return '#c8924a'
  if (fill <= 60) return '#a06428'
  if (fill <= 80) return '#7a3e10'
  return '#4e2008'
}

export default function ShopDetailModal({ shop, onClose }: Props) {
  const [ratings, setRatings] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
  const [imgError, setImgError] = useState(false)
  const isInDb = !String(shop.id).startsWith('osm-') && !String(shop.id).startsWith('fsq-') && !String(shop.id).startsWith('gpl-')

  useEffect(() => {
    if (!isInDb) { setLoading(false); return }
    async function load() {
      const { data } = await supabase
        .from('ratings')
        .select('id, fill_level, drink_name, caption, created_at, profiles(username, avatar_url)')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) setRatings(data as any)
      setLoading(false)
    }
    load()
  }, [shop.id, isInDb])

  const avgFill = ratings.length > 0
    ? Math.round(ratings.reduce((s, r) => s + r.fill_level, 0) / ratings.length)
    : shop.avg_rating ? Math.round(shop.avg_rating * 20) : 0

  // Build Google Maps URL
  const mapsUrl = shop.lat && shop.lng
    ? `https://maps.google.com/?q=${shop.lat},${shop.lng}`
    : `https://maps.google.com/?q=${encodeURIComponent(`${shop.name} ${shop.city || ''} ${shop.state || ''}`)}`

  // Build Google search URL for website/menu
  const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(`${shop.name} ${shop.city || ''} ${shop.state || ''} coffee shop`)}`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.9)', backdropFilter: 'blur(10px)' }}>
      <div className="w-full max-w-sm bg-cream-50 rounded-t-3xl animate-slide-up overflow-hidden"
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Hero image */}
        <div className="relative h-52 bg-coffee-200 flex-shrink-0">
          {shop.photo_url && !imgError ? (
            <img src={shop.photo_url} alt={shop.name} className="w-full h-full object-cover"
              onError={() => setImgError(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-latte to-cream-300">
              <span className="text-7xl opacity-40">☕</span>
            </div>
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)' }} />
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-sm">
            <X size={16} />
          </button>
          {shop.is_certified && (
            <div className="absolute top-4 left-4 bg-caramel rounded-full px-3 py-1 flex items-center gap-1.5">
              <CheckCircle size={12} className="text-white" />
              <span className="text-white text-xs font-bold">Social Brew Certified</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-white font-display text-2xl font-bold leading-tight">{shop.name}</h2>
            {(shop.address || shop.city) && (
              <p className="text-white/80 text-sm mt-0.5">
                {[shop.address, shop.city, shop.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Stats row */}
          <div className="flex items-center gap-0 border-b border-cream-200 bg-white">
            <div className="flex-1 py-3 text-center border-r border-cream-200">
              <p className="text-coffee-700 font-bold text-lg">{avgFill > 0 ? `${avgFill}%` : '—'}</p>
              <p className="text-coffee-400 text-xs">Avg Rating</p>
            </div>
            <div className="flex-1 py-3 text-center border-r border-cream-200">
              <p className="text-coffee-700 font-bold text-lg">{isInDb ? (shop.total_ratings || 0) : '—'}</p>
              <p className="text-coffee-400 text-xs">Reviews</p>
            </div>
            <div className="flex-1 py-3 text-center">
              <p className="text-coffee-700 font-bold text-lg">{isInDb ? (shop.weekly_visits || 0) : '—'}</p>
              <p className="text-coffee-400 text-xs">This Week</p>
            </div>
          </div>

          {/* Vibes */}
          {(shop.vibes?.length ?? 0) > 0 && (
            <div className="px-4 py-3 border-b border-cream-200 bg-white">
              <div className="flex flex-wrap gap-2">
                {shop.vibes!.map(v => (
                  <span key={v} className="bg-latte text-coffee-700 px-3 py-1 rounded-full text-xs font-medium">{v}</span>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-cream-100 border-b border-cream-200">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-white border border-cream-200 rounded-xl py-3 text-coffee-700 text-sm font-medium shadow-sm">
              <MapPin size={15} className="text-caramel" />
              Directions
            </a>
            <a href={googleUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-white border border-cream-200 rounded-xl py-3 text-coffee-700 text-sm font-medium shadow-sm">
              <Globe size={15} className="text-caramel" />
              Website & Menu
            </a>
          </div>

          {/* Recent brews */}
          <div className="px-4 pt-4 pb-8">
            <h3 className="font-display font-bold text-coffee-800 text-lg mb-3">
              {isInDb ? 'Recent Brews' : 'No reviews yet'}
            </h3>

            {loading && <div className="flex justify-center py-6"><div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}

            {!loading && !isInDb && (
              <div className="text-center py-6 bg-white rounded-2xl border border-cream-200">
                <p className="text-3xl mb-2">☕</p>
                <p className="text-coffee-500 text-sm">Be the first to rate this shop!</p>
                <p className="text-coffee-400 text-xs mt-1">Go to Brew tab → Rate a Visit</p>
              </div>
            )}

            {!loading && isInDb && ratings.length === 0 && (
              <div className="text-center py-6 bg-white rounded-2xl border border-cream-200">
                <p className="text-3xl mb-2">☕</p>
                <p className="text-coffee-500 text-sm">No brews yet — be the first!</p>
              </div>
            )}

            <div className="space-y-3">
              {ratings.map(rating => {
                const mugColor = getMugColor(rating.fill_level)
                return (
                  <div key={rating.id} className="bg-white rounded-2xl p-3.5 border border-cream-200">
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                        {rating.profiles?.avatar_url
                          ? <img src={rating.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center bg-caramel">
                              <span className="text-white text-xs font-bold">{rating.profiles?.username?.[0]?.toUpperCase()}</span>
                            </div>
                        }
                      </div>
                      <p className="text-coffee-700 font-semibold text-sm">{rating.profiles?.username}</p>
                      <div className="ml-auto flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full" style={{ background: mugColor }} />
                        <span className="text-coffee-600 text-xs font-medium">{rating.fill_level}%</span>
                      </div>
                    </div>
                    {rating.drink_name && (
                      <p className="text-coffee-500 text-xs mb-1">☕ {rating.drink_name}</p>
                    )}
                    {rating.caption && (
                      <p className="text-coffee-700 text-sm">{rating.caption}</p>
                    )}
                    <p className="text-coffee-400 text-xs mt-1">{getFillLabel(rating.fill_level)}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
