import { useState, useEffect } from 'react'
import { useSwipeDown } from '../../lib/useSwipeDown'
import { X, MapPin, Star, Users, Coffee } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { CoffeeShop } from '../../lib/supabase'

type Props = {
  shop: Partial<CoffeeShop> & { id: string; name: string }
  onClose: () => void
}

function getMugColor(fill: number) {
  if (fill <= 20) return '#b0c4d4'
  if (fill <= 40) return '#c8924a'
  if (fill <= 60) return '#a06428'
  if (fill <= 80) return '#7a3e10'
  return '#4e2008'
}
function getFillLabel(fill: number) {
  if (fill <= 20) return 'Just a Sip'
  if (fill <= 40) return 'Getting There'
  if (fill <= 60) return 'Half Cup'
  if (fill <= 80) return 'Good Pour'
  if (fill <= 95) return 'Almost Perfect'
  return 'Perfect Brew ✨'
}
function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m/60)}h ago`
  return `${Math.floor(m/1440)}d ago`
}

type Tab = 'overview' | 'my-brews' | 'friends'

export default function ShopDetailModal({ shop, onClose }: Props) {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [allRatings, setAllRatings] = useState<any[]>([])
  const [myRatings, setMyRatings] = useState<any[]>([])
  const [friendRatings, setFriendRatings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [imgError, setImgError] = useState(false)

  const swipe = useSwipeDown(onClose)
  const isInDb = !String(shop.id).startsWith('osm-') && !String(shop.id).startsWith('fsq-') && !String(shop.id).startsWith('gpl-')

  useEffect(() => {
    async function load() {
      // Determine the real shop ID — if from OSM, look up by name in our DB
      let shopId = isInDb ? shop.id : null
      if (!isInDb && shop.name) {
        const { data: dbMatch } = await supabase
          .from('coffee_shops').select('id').ilike('name', shop.name).eq('is_active', true).maybeSingle()
        if (dbMatch) shopId = dbMatch.id
      }

      if (!shopId) { setLoading(false); return }

      // Load ratings for this shop
      const { data: ratings } = await supabase
        .from('ratings')
        .select('*, profiles!ratings_user_id_fkey(id, username, avatar_url)')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(30)

      if (ratings) {
        setAllRatings(ratings)
        if (profile?.id) {
          setMyRatings(ratings.filter((r: any) => r.user_id === profile.id))
          const { data: follows } = await supabase.from('follows').select('following_id').eq('follower_id', profile.id)
          const followingIds = new Set((follows || []).map((f: any) => f.following_id))
          setFriendRatings(ratings.filter((r: any) => followingIds.has(r.user_id)))
        }
      }
      setLoading(false)
    }
    load()
  }, [shop.id, shop.name, isInDb, profile])

  const avgFill = allRatings.length > 0
    ? Math.round(allRatings.reduce((s: number, r: any) => s + r.fill_level, 0) / allRatings.length)
    : shop.avg_rating ? Math.round(shop.avg_rating * 20) : 0

  function MiniMug({ fill, size = 44 }: { fill: number; size?: number }) {
    const color = getMugColor(fill)
    return (
      <svg viewBox="0 0 56 68" width={size} height={size * 1.2}>
        <defs><clipPath id={`mc-${fill}-${size}`}><rect x="5" y="12" width="38" height="46" rx="5" /></clipPath></defs>
        <rect x="5" y="12" width="38" height="46" rx="5" fill="#f7f0e4" stroke="#c8b090" strokeWidth="1.5" />
        <g clipPath={`url(#mc-${fill}-${size})`}>
          <rect x="5" y={58-(46*fill/100)} width="38" height={46*fill/100} fill={color} />
        </g>
        <rect x="3" y="8" width="42" height="8" rx="4" fill="#d4b890" />
        <path d="M43 22 Q56 22 56 33 Q56 44 43 44" stroke="#c8b090" strokeWidth="5" fill="none" strokeLinecap="round" />
        <ellipse cx="24" cy="58" rx="19" ry="5" fill="#e8ddc8" />
      </svg>
    )
  }

  function RatingCard({ r }: { r: any }) {
    const user = r.profiles as any
    return (
      <div className="bg-cream-50 rounded-2xl p-3.5 border border-cream-200">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white text-xs font-bold">{user?.username?.[0]?.toUpperCase()}</span></div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-coffee-700 font-semibold text-xs">{user?.username}</p>
            <p className="text-coffee-400 text-xs">{timeAgo(r.created_at)}</p>
          </div>
          <MiniMug fill={r.fill_level} size={32} />
          <div className="text-right">
            <p className="text-coffee-700 font-bold text-xs">{r.fill_level}%</p>
            <p className="text-coffee-400 text-xs" style={{ fontSize: 9 }}>{getFillLabel(r.fill_level)}</p>
          </div>
        </div>
        {r.drink_name && (
          <p className="text-coffee-500 text-xs">☕ {r.drink_name}</p>
        )}
        {r.caption && (
          <p className="text-coffee-600 text-xs mt-1 italic">"{r.caption.split('🕐')[0].trim()}"</p>
        )}
        {r.visit_time && (
          <p className="text-coffee-400 text-xs mt-1">🕐 {r.visit_time}</p>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.85)', backdropFilter: 'blur(8px)' }}>
      <div ref={swipe.ref} className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up flex flex-col" style={{ maxHeight: '88vh' }}>
        <div className="flex justify-center pt-3 pb-1 cursor-grab flex-shrink-0" onTouchStart={swipe.onTouchStart} onTouchMove={swipe.onTouchMove} onTouchEnd={swipe.onTouchEnd}><div className="w-10 h-1 bg-cream-300 rounded-full" /></div>

        {/* Header image */}
        <div className="relative flex-shrink-0" style={{ height: 160 }}>
          {shop.photo_url && !imgError ? (
            <img src={shop.photo_url} alt={shop.name} className="w-full h-full object-cover rounded-t-3xl" onError={() => setImgError(true)} />
          ) : (
            <div className="w-full h-full rounded-t-3xl bg-gradient-to-br from-coffee-600 to-coffee-900 flex items-center justify-center">
              <span className="text-6xl opacity-30">☕</span>
            </div>
          )}
          <div className="absolute inset-0 rounded-t-3xl" style={{ background: 'linear-gradient(to top, rgba(10,5,1,0.85) 0%, transparent 50%)' }} />
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-sm">
            <X size={16} />
          </button>
          <div className="absolute bottom-0 left-0 p-4">
            <div className="flex items-center gap-2 mb-1">
              {shop.is_certified && (
                <span className="bg-caramel text-white text-xs font-bold px-2 py-0.5 rounded-full">✓ Certified</span>
              )}
            </div>
            <h2 className="text-white font-display font-bold text-xl leading-tight">{shop.name}</h2>
            {(shop.address || shop.city) && (
              <p className="text-cream-300 text-xs flex items-center gap-1 mt-0.5">
                <MapPin size={10} />{shop.address}{shop.city ? `, ${shop.city}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Stats bar */}
        {isInDb && (
          <div className="flex items-center gap-0 px-4 py-3 border-b border-cream-200 bg-cream-50 flex-shrink-0">
            <div className="flex items-center gap-2 flex-1">
              <MiniMug fill={avgFill} size={36} />
              <div>
                <p className="text-coffee-700 font-bold text-sm">{getFillLabel(avgFill)}</p>
                <p className="text-coffee-400 text-xs">{avgFill}% avg · {allRatings.length} reviews</p>
              </div>
            </div>
            {shop.vibes && (shop.vibes as any[]).length > 0 && (
              <div className="flex flex-wrap gap-1 justify-end">
                {(shop.vibes as any[]).slice(0,2).map((v: string) => (
                  <span key={v} className="bg-cream-200 text-coffee-500 px-2 py-0.5 rounded-full text-xs">{v}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        {isInDb && (
          <div className="flex border-b border-cream-200 flex-shrink-0">
            {([
              { key: 'overview', icon: <Star size={13} />, label: 'All Brews' },
              { key: 'my-brews', icon: <Coffee size={13} />, label: `My Brews${myRatings.length > 0 ? ` (${myRatings.length})` : ''}` },
              { key: 'friends', icon: <Users size={13} />, label: `Friends${friendRatings.length > 0 ? ` (${friendRatings.length})` : ''}` },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1 py-3 text-xs font-medium transition-colors border-b-2 ${
                  tab === t.key ? 'border-caramel text-caramel' : 'border-transparent text-coffee-400'
                }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {!isInDb && (
            <div className="px-5 py-8 text-center">
              <p className="text-4xl mb-3">📍</p>
              <p className="text-coffee-700 font-display text-lg font-bold">{shop.name}</p>
              {shop.address && <p className="text-coffee-400 text-sm mt-1">{shop.address}</p>}
              {shop.city && <p className="text-coffee-400 text-sm">{shop.city}{shop.state ? `, ${shop.state}` : ''}</p>}
              <p className="text-coffee-300 text-xs mt-4">This shop isn't in our database yet</p>
            </div>
          )}

          {isInDb && loading && (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
            </div>
          )}

          {isInDb && !loading && (
            <div className="px-4 py-3 space-y-2.5 pb-6">
              {/* Overview tab */}
              {tab === 'overview' && (
                <>
                  {allRatings.length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-3xl mb-2">☕</p>
                      <p className="text-coffee-500 font-display">No brews here yet</p>
                      <p className="text-coffee-400 text-xs mt-1">Be the first to rate a visit!</p>
                    </div>
                  )}
                  {allRatings.map(r => <RatingCard key={r.id} r={r} />)}
                </>
              )}

              {/* My brews tab */}
              {tab === 'my-brews' && (
                <>
                  {myRatings.length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-3xl mb-2">☕</p>
                      <p className="text-coffee-500 font-display">You haven't brewed here yet</p>
                      <p className="text-coffee-400 text-xs mt-1">Rate a visit to see your history</p>
                    </div>
                  )}
                  {myRatings.map(r => <RatingCard key={r.id} r={r} />)}
                </>
              )}

              {/* Friends tab */}
              {tab === 'friends' && (
                <>
                  {friendRatings.length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-3xl mb-2">👥</p>
                      <p className="text-coffee-500 font-display">No friends here yet</p>
                      <p className="text-coffee-400 text-xs mt-1">Follow people to see their brews</p>
                    </div>
                  )}
                  {friendRatings.map(r => <RatingCard key={r.id} r={r} />)}
                </>
              )}
            </div>
          )}
        </div>

        {/* Directions button */}
        {(shop.lat && shop.lng) && (
          <div className="px-4 py-3 border-t border-cream-200 flex-shrink-0">
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${shop.lat},${shop.lng}`}
              target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-caramel text-white rounded-xl py-3 font-semibold text-sm">
              <MapPin size={16} /> Get Directions
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
