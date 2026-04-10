import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { NotificationBell } from '../shared/NotificationsPanel'
import ShopDetailModal from '../shared/ShopDetailModal'

function getMugColor(fill: number) {
  if (fill <= 20) return '#b0c4d4'
  if (fill <= 40) return '#c8924a'
  if (fill <= 60) return '#a06428'
  if (fill <= 80) return '#7a3e10'
  return '#4e2008'
}

function getFillLabel(fill: number) {
  if (fill <= 15) return 'Just a Sip'
  if (fill <= 30) return 'Getting There'
  if (fill <= 50) return 'Half Cup'
  if (fill <= 70) return 'Good Pour'
  if (fill <= 85) return 'Almost Perfect'
  return 'Perfect Brew ✨'
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function HomeTab({ refresh }: { refresh: number }) {
  const { profile } = useAuth()
  const [ratings, setRatings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [_savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [selectedShop, setSelectedShop] = useState<any>(null)

  useEffect(() => {
    async function load() {
      try {
        const result = await supabase
          .from('ratings')
          .select('*, profiles!ratings_user_id_fkey(*), coffee_shops(*)')
          .order('created_at', { ascending: false })
          .limit(50)
        
        
        if (result.error) {
          setError(result.error.message)
        } else {
          setRatings(result.data || [])
        }
      } catch(e: any) {
        setError(e?.message || 'Unknown error')
      }
      setLoading(false)
    }
    load()
  }, [refresh])

  useEffect(() => {
    if (!profile) return
    supabase.from('likes').select('rating_id').eq('user_id', profile.id)
      .then(({ data }) => { if (data) setLikedIds(new Set(data.map((l: any) => l.rating_id))) })
    supabase.from('saved_posts').select('rating_id').eq('user_id', profile.id)
      .then(({ data }) => { if (data) setSavedIds(new Set(data.map((s: any) => s.rating_id))) })
  }, [profile, refresh])

  async function toggleLike(ratingId: string) {
    if (!profile) return
    if (likedIds.has(ratingId)) {
      await supabase.from('likes').delete().eq('user_id', profile.id).eq('rating_id', ratingId)
      setLikedIds(prev => { const n = new Set(prev); n.delete(ratingId); return n })
      setRatings(prev => prev.map(r => r.id === ratingId ? { ...r, likes_count: Math.max(0, (r.likes_count||0) - 1) } : r))
    } else {
      await supabase.from('likes').insert({ user_id: profile.id, rating_id: ratingId })
      setLikedIds(prev => new Set([...prev, ratingId]))
      setRatings(prev => prev.map(r => r.id === ratingId ? { ...r, likes_count: (r.likes_count||0) + 1 } : r))
    }
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="sticky top-0 z-10 bg-cream-100/95 backdrop-blur-sm border-b border-cream-200 px-5 py-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-coffee-800">Social Brew</h1>
        <div className="flex items-center gap-1">
          <NotificationBell />
        </div>
      </div>

      <div className="pb-24 px-4 pt-2">


        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-red-600 text-sm font-medium">Error: {error}</p>
          </div>
        )}

        {!loading && !error && ratings.length === 0 && (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">☕</div>
            <p className="text-coffee-700 font-display text-xl">No brews yet</p>
            <p className="text-coffee-400 text-sm mt-2">Be the first to rate a visit!</p>
          </div>
        )}

        {ratings.map(rating => {
          const shop = rating.coffee_shops as any
          const user = rating.profiles as any
          const isLiked = likedIds.has(rating.id)
          const mugColor = getMugColor(rating.fill_level)
          const isQuickSip = rating.is_quick_sip === true

          if (isQuickSip) {
            return (
              <div key={rating.id} className="bg-white mb-2 rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-caramel flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-xs">{user?.username?.[0]?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-coffee-700 font-semibold text-sm">{user?.username}</span>
                      <span className="text-coffee-400 text-xs">had a quick sip</span>
                      {shop && <button onClick={() => setSelectedShop(shop)} className="text-caramel text-xs font-semibold">@ {shop.name}</button>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-14 h-1.5 bg-cream-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${rating.fill_level}%`, background: mugColor }} />
                      </div>
                      <span className="text-coffee-400 text-xs">{rating.fill_level}%</span>
                      <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-400">⚡ Quick Sip</span>
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-3 flex items-center gap-4 border-t border-cream-50 pt-2">
                  <button onClick={() => toggleLike(rating.id)} className="flex items-center gap-1" style={{ color: isLiked ? '#e05a5a' : '#9b7a45' }}>
                    <span>{isLiked ? '❤️' : '🤍'}</span>
                    {(rating.likes_count||0) > 0 && <span className="text-xs">{rating.likes_count}</span>}
                  </button>
                  <p className="text-coffee-300 text-xs ml-auto">{formatDate(rating.created_at)}</p>
                </div>
              </div>
            )
          }

          return (
            <div key={rating.id} className="bg-white mb-3 rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
              <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                <div className="w-9 h-9 rounded-full bg-caramel flex items-center justify-center flex-shrink-0">
                  {user?.avatar_url
                    ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                    : <span className="text-white font-bold text-sm">{user?.username?.[0]?.toUpperCase()}</span>}
                </div>
                <div>
                  <p className="text-coffee-800 font-semibold text-sm">{user?.username}</p>
                  <p className="text-coffee-400 text-xs">{timeAgo(rating.created_at)}</p>
                </div>
              </div>

              <div className="px-4 pb-2">
                {rating.drink_name && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-coffee-500 text-sm">ordered</span>
                    <span className="bg-cream-100 text-coffee-700 px-2.5 py-0.5 rounded-full text-sm font-medium border border-cream-200">{rating.drink_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 my-3">
                  <div className="w-12 h-14 flex-shrink-0">
                    <svg viewBox="0 0 56 68" width="48" height="56">
                      <defs><clipPath id={`c-${rating.id}`}><rect x="5" y="12" width="38" height="46" rx="5" /></clipPath></defs>
                      <rect x="5" y="12" width="38" height="46" rx="5" fill="#f7f0e4" stroke="#c8b090" strokeWidth="1.5" />
                      <g clipPath={`url(#c-${rating.id})`}>
                        <rect x="5" y={58-(46*rating.fill_level/100)} width="38" height={46*rating.fill_level/100} fill={mugColor} />
                      </g>
                      <rect x="3" y="8" width="42" height="8" rx="4" fill="#d4b890" />
                      <path d="M43 22 Q56 22 56 33 Q56 44 43 44" stroke="#c8b090" strokeWidth="5" fill="none" strokeLinecap="round" />
                      <ellipse cx="24" cy="58" rx="19" ry="5" fill="#e8ddc8" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-coffee-700 font-bold text-base">{getFillLabel(rating.fill_level)}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="h-1.5 w-20 bg-cream-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${rating.fill_level}%`, background: mugColor }} />
                      </div>
                      <span className="text-coffee-400 text-xs">{rating.fill_level}%</span>
                    </div>
                  </div>
                </div>
                {rating.photo_url && (
                  <div className="rounded-xl overflow-hidden mb-2 h-52">
                    <img src={rating.photo_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                {rating.caption && <p className="text-coffee-700 text-sm mb-2">{rating.caption}</p>}
              </div>

              {shop && (
                <button onClick={() => setSelectedShop(shop)}
                  className="mx-4 mb-3 flex items-center gap-3 bg-cream-50 rounded-xl p-2.5 border border-cream-200 w-full text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-coffee-700 font-semibold text-sm truncate">{shop.name}</p>
                    {shop.city && <p className="text-coffee-400 text-xs">{shop.city}, {shop.state}</p>}
                  </div>
                  <span className="text-caramel text-xs font-medium">View →</span>
                </button>
              )}

              <div className="flex items-center px-4 pb-2 gap-4">
                <button onClick={() => toggleLike(rating.id)} className="flex items-center gap-1.5" style={{ color: isLiked ? '#e05a5a' : '#9b7a45' }}>
                  <span>{isLiked ? '❤️' : '🤍'}</span>
                  {(rating.likes_count||0) > 0 && <span className="text-sm">{rating.likes_count}</span>}
                </button>
              </div>
              <div className="px-4 pb-3">
                <p className="text-coffee-300 text-xs">{formatDate(rating.created_at)}</p>
              </div>
            </div>
          )
        })}
      </div>

      {selectedShop && <ShopDetailModal shop={selectedShop} onClose={() => setSelectedShop(null)} />}
    </div>
  )
}
