import { useState, useEffect, useId } from 'react'
import { ArrowLeft, MapPin, Users, Coffee, Heart } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import ShopPhotoGallery from './ShopPhotoGallery'
import UserProfilePage from './UserProfilePage'
import CoffeeDate from './CoffeeDate'
import { useAuth } from '../../contexts/AuthContext'
import type { CoffeeShop } from '../../lib/supabase'
import ClaimShopModal from '../shops/ClaimShopModal'
import { isAffiliatedWithShop } from '../../lib/shopAffiliation'

type Props = {
  shop: Partial<CoffeeShop> & { id: string; name: string }
  onBack: () => void
  onNavigateToBrew?: (shop: any) => void
}

type Tab = 'overview' | 'my-brews' | 'friends'

function parseOpeningHours(raw: string | null): string | null {
  if (!raw) return null
  // If already human-readable (contains full words like "Monday"), return as-is
  if (/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(raw)) return raw
  const dayMap: Record<string, string> = {
    'Mo': 'Mon', 'Tu': 'Tue', 'We': 'Wed', 'Th': 'Thu',
    'Fr': 'Fri', 'Sa': 'Sat', 'Su': 'Sun'
  }
  function to12h(time: string): string {
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'pm' : 'am'
    const h12 = h % 12 || 12
    return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`
  }
  try {
    return raw.split(';').map(segment => {
      segment = segment.trim()
      const match = segment.match(/^([A-Za-z,\- ]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/)
      if (!match) return segment
      let days = match[1].trim()
      Object.entries(dayMap).forEach(([k, v]) => { days = days.replace(new RegExp(k, 'g'), v) })
      return `${days} ${to12h(match[2])}–${to12h(match[3])}`
    }).join(' · ')
  } catch {
    return raw
  }
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
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

function MiniMug({ fill, size = 40 }: { fill: number; size?: number }) {
  const color = getMugColor(fill)
  const uid = useId()
  const id = `mug-${uid.replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 56 68" width={size} height={size * 1.2} style={{ flexShrink: 0 }}>
      <defs><clipPath id={id}><rect x="5" y="12" width="38" height="46" rx="5" /></clipPath></defs>
      <rect x="5" y="12" width="38" height="46" rx="5" fill="#f7f0e4" stroke="#c8b090" strokeWidth="1.5" />
      <g clipPath={`url(#${id})`}>
        <rect x="5" y={58 - (46 * fill / 100)} width="38" height={46 * fill / 100} fill={color} />
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
    <div className="bg-white rounded-2xl p-4 border border-cream-200 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
          {user?.avatar_url
            ? <img src={user.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center bg-caramel">
                <span className="text-white text-xs font-bold">{user?.username?.[0]?.toUpperCase()}</span>
              </div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-coffee-700 font-semibold text-sm">{user?.username}</p>
          <p className="text-coffee-400 text-xs">{timeAgo(r.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <MiniMug fill={r.fill_level} size={32} />
          <div className="text-right">
            <p className="text-coffee-700 font-bold text-sm">{r.fill_level}%</p>
            <p className="text-coffee-400 text-xs" style={{ fontSize: 9 }}>{getFillLabel(r.fill_level)}</p>
          </div>
        </div>
      </div>
      {r.drink_name && <p className="text-coffee-500 text-xs">☕ {r.drink_name}</p>}
      {r.visit_time && <p className="text-coffee-400 text-xs mt-0.5">🕐 {r.visit_time}</p>}
      {r.vibe_tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {r.vibe_tags.map((v: string) => (
            <span key={v} className="bg-cream-100 text-coffee-500 px-2 py-0.5 rounded-full text-xs border border-cream-200">{v}</span>
          ))}
        </div>
      )}
      {r.caption && (
        <p className="text-coffee-600 text-sm mt-2 italic">"{r.caption.split('🕐')[0].trim()}"</p>
      )}
    </div>
  )
}

export default function ShopDetailPage({ shop, onBack, onNavigateToBrew }: Props) {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [allRatings, setAllRatings] = useState<any[]>([])
  const [myRatings, setMyRatings] = useState<any[]>([])
  const [friendRatings, setFriendRatings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCoffeeDate, setShowCoffeeDate] = useState(false)
  const [activeTab, setActiveTab] = useState<'ratings' | 'photos'>('ratings')
  const [imgError, setImgError] = useState(false)
  const [resolvedShop, setResolvedShop] = useState<any>(shop)
  const [wishlisted, setWishlisted] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [shopStreak, setShopStreak] = useState<number>(0)
  const [followerCount, setFollowerCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [showClaim, setShowClaim] = useState(false)
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const [shopPosts, setShopPosts] = useState<any[]>([])

  const isInDb = !String(shop.id).startsWith('osm-') &&
    !String(shop.id).startsWith('fsq-') &&
    !String(shop.id).startsWith('gpl-')

 
  useEffect(() => {
    if (!profile?.id || !resolvedShop?.id) return
    supabase.from('visit_wishlist')
      .select('id').eq('user_id', profile.id).eq('shop_id', resolvedShop.id).maybeSingle()
      .then(({ data }) => { if (data) setWishlisted(true) })
  }, [profile?.id, resolvedShop?.id])
  useEffect(() => {
    async function load() {
      try {
        // Resolve shop ID — look up by name if from OSM
        let shopId = isInDb ? shop.id : null
        if (!isInDb && shop.name) {
          const { data: dbMatch } = await supabase
            .from('coffee_shops').select('*')
            .ilike('name', shop.name).eq('is_active', true).maybeSingle()
          if (dbMatch) {
            shopId = dbMatch.id
            setResolvedShop(dbMatch)
          }
        } else if (isInDb) {
          const { data: dbShop } = await supabase
            .from('coffee_shops').select('*').eq('id', shop.id).single()
          if (dbShop) setResolvedShop(dbShop)
        }

        if (!shopId) return

        // Fetch ratings, follower count, and user's follow status in parallel
        const [{ data: ratings }, { count: fCount }, { data: fData }, { data: follows }] = await Promise.all([
          supabase.from('ratings')
            .select('*, profiles!ratings_user_id_fkey(id, username, avatar_url)')
            .eq('shop_id', shopId).order('created_at', { ascending: false }).limit(50),
          supabase.from('shop_follows').select('user_id', { count: 'exact', head: true }).eq('shop_id', shopId),
          profile?.id
            ? supabase.from('shop_follows').select('user_id').eq('shop_id', shopId).eq('user_id', profile.id).maybeSingle()
            : Promise.resolve({ data: null }),
          profile?.id
            ? supabase.from('follows').select('following_id').eq('follower_id', profile.id)
            : Promise.resolve({ data: [] }),
        ])

        setFollowerCount(fCount || 0)
        setIsFollowing(!!fData)

        if (ratings) {
          setAllRatings(ratings)
          if (profile?.id) {
            const mine = ratings.filter((r: any) => r.user_id === profile.id)
            setMyRatings(mine)

            // Calculate consecutive weekly shop streak
            if (mine.length > 0) {
              const weekKeys = Array.from(new Set(mine.map((r: any) => {
                const d = new Date(r.created_at)
                const year = d.getFullYear()
                const week = Math.ceil((((d.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + new Date(year, 0, 1).getDay() + 1) / 7)
                return year + '-' + String(week).padStart(2, '0')
              }))).sort().reverse()
              let streak = 1
              for (let i = 0; i < weekKeys.length - 1; i++) {
                const [y1, w1] = weekKeys[i].split('-').map(Number)
                const [y2, w2] = weekKeys[i + 1].split('-').map(Number)
                if ((y1 === y2 && w1 === w2 + 1) || (y1 === y2 + 1 && w1 === 1 && w2 >= 52)) {
                  streak++
                } else break
              }
              setShopStreak(streak)
            }

            const followingIds = new Set((follows || []).map((f: any) => f.following_id))
            setFriendRatings(ratings.filter((r: any) => followingIds.has(r.user_id)))
          }
        }

        // Fetch approved shop posts
        const { data: posts } = await supabase
          .from('shop_posts')
          .select('id,title,body,photo_url,category,created_at')
          .eq('shop_id', shopId)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(10)
        setShopPosts(posts || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [shop.id, shop.name, isInDb, profile])

  const avgFill = allRatings.length > 0
    ? Math.round(allRatings.reduce((s, r) => s + r.fill_level, 0) / allRatings.length)
    : (resolvedShop.avg_fill ?? 0)

  const tabs = [
    { key: 'overview' as Tab, icon: <span className="text-sm">☕</span>, label: `All${allRatings.length > 0 ? ` (${allRatings.length})` : ''}` },
    { key: 'my-brews' as Tab, icon: <Coffee size={13} />, label: `Mine${myRatings.length > 0 ? ` (${myRatings.length})` : ''}` },
    { key: 'friends' as Tab, icon: <Users size={13} />, label: `Friends${friendRatings.length > 0 ? ` (${friendRatings.length})` : ''}` },
  ]

  const activeList = tab === 'overview' ? allRatings : tab === 'my-brews' ? myRatings : friendRatings

  async function toggleWishlist() {
    if (!profile?.id || !resolvedShop?.id || wishlistLoading) return
    setWishlistLoading(true)
    if (wishlisted) {
      await supabase.from('visit_wishlist')
        .delete().eq('user_id', profile.id).eq('shop_id', resolvedShop.id)
      setWishlisted(false)
    } else {
      await supabase.from('visit_wishlist').upsert({
        user_id: profile.id,
        shop_id: resolvedShop.id,
        shop_name: resolvedShop.name || 'Unknown Shop',
        lat: resolvedShop.lat || null,
        lng: resolvedShop.lng || null,
        notified: false,
      }, { onConflict: 'user_id,shop_id' })
      setWishlisted(true)
    }
    setWishlistLoading(false)
  }

  async function toggleFollow() {
    if (!profile?.id || !resolvedShop?.id || followLoading) return
    if (isAffiliatedWithShop(profile, resolvedShop.id)) return
    setFollowLoading(true)
    if (isFollowing) {
      await supabase.from('shop_follows').delete().eq('user_id', profile.id).eq('shop_id', resolvedShop.id)
      setIsFollowing(false)
      setFollowerCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('shop_follows').upsert(
        { user_id: profile.id, shop_id: resolvedShop.id },
        { onConflict: 'user_id,shop_id' }
      )
      setIsFollowing(true)
      setFollowerCount(c => c + 1)
    }
    setFollowLoading(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-cream-100 flex flex-col"
      onTouchStart={e => { (e.currentTarget as any)._swipeX = e.touches[0].clientX }}
      onTouchEnd={e => { const dx = e.changedTouches[0].clientX - ((e.currentTarget as any)._swipeX || 0); if (dx > 80) onBack() }}
    >
      {/* Hero image with back button */}
      <div className="relative flex-shrink-0" style={{ height: 220 }}>
        {resolvedShop.photo_url && !imgError ? (
          <img src={resolvedShop.photo_url} alt={resolvedShop.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-coffee-600 to-coffee-900 flex items-center justify-center">
            <span className="text-8xl opacity-20">☕</span>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,5,1,0.9) 0%, rgba(10,5,1,0.1) 60%, transparent 100%)' }} />
        {/* Back button */}
        <button onClick={onBack}
          className="absolute top-safe-top top-4 left-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
          <ArrowLeft size={20} />
        </button>
        {/* Shop name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {resolvedShop.is_certified && (
            <span className="bg-caramel text-white text-xs font-bold px-2 py-0.5 rounded-full mb-1.5 inline-block">✓ Certified Independent</span>
          )}
          <h1 className="text-white font-display font-bold text-2xl leading-tight">{resolvedShop.name}</h1>
          {(resolvedShop.address || resolvedShop.city) && (
            <p className="text-cream-300 text-sm flex items-center gap-1 mt-1">
              <MapPin size={12} />
              {[resolvedShop.address, resolvedShop.city, resolvedShop.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-cream-200 px-4 py-3 flex items-center gap-4 flex-shrink-0">
        {avgFill > 0 ? (
          <div className="flex items-center gap-2">
            <MiniMug fill={avgFill} size={32} />
            <div>
              <p className="text-coffee-700 font-bold text-sm">{getFillLabel(avgFill)}</p>
              <p className="text-coffee-400 text-xs">{avgFill}% avg · {allRatings.length} review{allRatings.length !== 1 ? 's' : ''}</p>
              {shopStreak >= 2 && profile && (
                <div className="flex items-center gap-1 mt-1">
                  <span style={{ fontSize: 11 }}>{shopStreak >= 8 ? '🔥' : shopStreak >= 4 ? '⭐' : '☕'}</span>
                  <p className="text-caramel font-semibold" style={{ fontSize: 11 }}>
                    {shopStreak >= 26 ? 'Six-month regular' : shopStreak >= 12 ? 'Part of the furniture' : shopStreak >= 8 ? 'Local legend' : shopStreak >= 4 ? 'Becoming a regular' : `${shopStreak} weeks running`} · your streak
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-coffee-400 text-sm">No reviews yet — be the first!</p>
        )}
        {resolvedShop.vibes && (resolvedShop.vibes as any[]).length > 0 && (
          <div className="flex flex-wrap gap-1 ml-auto">
            {(resolvedShop.vibes as any[]).slice(0, 2).map((v: string) => (
              <span key={v} className="bg-cream-100 text-coffee-500 px-2 py-0.5 rounded-full text-xs border border-cream-200">{v}</span>
            ))}
          </div>
        )}
      </div>

      {/* Follower row */}
      {isInDb && (
        <div className="bg-white border-b border-cream-200 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1.5 text-coffee-500 text-xs">
            <Heart size={13} className="text-caramel" />
            <span><span className="font-semibold text-coffee-700">{followerCount}</span> follower{followerCount !== 1 ? 's' : ''}</span>
            {resolvedShop.claimed_by && (
              <span className="ml-2 bg-caramel/10 text-caramel px-2 py-0.5 rounded-full text-xs font-medium border border-caramel/20">✓ Verified owner</span>
            )}
          </div>
          {profile && (
            <button
              onClick={toggleFollow}
              disabled={followLoading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50"
              style={{
                background: isFollowing ? '#fdf0dc' : 'white',
                borderColor: isFollowing ? '#c8853a' : '#e0c8a0',
                color: isFollowing ? '#c8853a' : '#9b7a55',
              }}>
              <Heart size={12} fill={isFollowing ? '#c8853a' : 'none'} />
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      )}

      {/* Hours and website */}
      {((resolvedShop as any).opening_hours || (resolvedShop as any).website) && (
        <div className="bg-white border-b border-cream-200 px-4 py-2.5 flex flex-wrap gap-3 flex-shrink-0">
          {(resolvedShop as any).opening_hours && (
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🕐</span>
              <p className="text-coffee-600 text-xs">{parseOpeningHours((resolvedShop as any).opening_hours)}</p>
            </div>
          )}
          {(resolvedShop as any).website && (
            <a
              href={(resolvedShop as any).website.startsWith('http') ? (resolvedShop as any).website : `https://${(resolvedShop as any).website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5"
            >
              <span className="text-sm">🌐</span>
              <p className="text-caramel text-xs underline">Visit website</p>
            </a>
          )}
        </div>
      )}

      {/* Roast Profile */}
      {(() => {
        const rp = (resolvedShop as any).roast_profile
        if (!rp) return null
        const hasContent = rp.roaster || rp.roast_levels?.length || rp.origins?.length || rp.brew_methods?.length || rp.notes
        if (!hasContent) return null
        return (
          <div className="bg-white border-b border-cream-200 px-4 py-3 flex-shrink-0 space-y-2">
            {rp.roaster && (
              <p className="text-coffee-700 text-xs font-semibold">☕ {rp.roaster}</p>
            )}
            <div className="flex flex-wrap gap-1">
              {(rp.roast_levels || []).map((l: string) => (
                <span key={l} className="bg-coffee-100 text-coffee-600 px-2 py-0.5 rounded-full text-xs border border-coffee-200">{l}</span>
              ))}
              {(rp.origins || []).map((o: string) => (
                <span key={o} className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs border border-green-100">{o}</span>
              ))}
              {(rp.brew_methods || []).map((m: string) => (
                <span key={m} className="bg-caramel/10 text-caramel px-2 py-0.5 rounded-full text-xs border border-caramel/20">{m}</span>
              ))}
            </div>
            {rp.notes && (
              <p className="text-coffee-500 text-xs italic border-l-2 border-caramel/30 pl-2">"{rp.notes}"</p>
            )}
          </div>
        )
      })()}

      {/* Tabs */}
      <div className="flex bg-white border-b border-cream-200 flex-shrink-0">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setActiveTab('ratings') }}
            className={`flex-1 flex items-center justify-center gap-1 py-3 text-xs font-medium transition-colors border-b-2 ${
              tab === t.key && activeTab === 'ratings' ? 'border-caramel text-caramel' : 'border-transparent text-coffee-400'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
        <button onClick={() => setActiveTab(activeTab === 'photos' ? 'ratings' : 'photos')}
          className={`flex-1 flex items-center justify-center gap-1 py-3 text-xs font-medium transition-colors border-b-2 ${
            activeTab === 'photos' ? 'border-caramel text-caramel' : 'border-transparent text-coffee-400'
          }`}>
          📷 Photos
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-8">
        {loading && activeTab === 'ratings' && (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && activeTab === 'ratings' && shopPosts.length > 0 && tab === 'overview' && (
          <div className="px-4 pt-4 space-y-2">
            <p className="text-xs font-semibold text-coffee-500 uppercase tracking-wide">From the shop</p>
            <div className="space-y-2 mb-4">
              {shopPosts.map(post => (
                <div key={post.id} className="bg-white rounded-2xl border border-cream-200 p-3 shadow-sm">
                  {post.photo_url && (
                    <div className="w-full aspect-video overflow-hidden rounded-xl mb-2">
                      <img src={post.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </div>
                  )}
                  <p className="text-coffee-700 font-semibold text-sm leading-tight">{post.title}</p>
                  {post.body && (
                    <p className="text-coffee-500 text-xs mt-1 leading-relaxed line-clamp-3">{post.body}</p>
                  )}
                  <p className="text-coffee-300 text-xs mt-1.5">{new Date(post.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && activeTab === 'ratings' && (
          <div className="px-4 pt-4 space-y-3">
            {activeList.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">
                  {tab === 'overview' ? '☕' : tab === 'my-brews' ? '☕' : '👥'}
                </p>
                <p className="text-coffee-500 font-display text-lg">
                  {tab === 'overview' ? 'No brews here yet' : tab === 'my-brews' ? "You haven't brewed here yet" : 'No friends here yet'}
                </p>
                <p className="text-coffee-400 text-sm mt-1">
                  {tab === 'overview' ? 'Be the first to rate a visit!' : tab === 'my-brews' ? 'Rate a visit to see your history' : 'Follow people to see their brews'}
                </p>
                {(tab === 'overview' || tab === 'my-brews') && onNavigateToBrew && (
                  <button
                    onClick={() => onNavigateToBrew(shop)}
                    className="mt-4 px-5 py-2.5 bg-caramel text-white rounded-full text-sm font-semibold"
                  >
                    Rate {shop.name} ☕
                  </button>
                )}
              </div>
            )}
            {activeList.map(r => <RatingCard key={r.id} r={r} />)}
          </div>
        )}
        {activeTab === 'photos' && (
          <div className="px-0 pt-0">
            <ShopPhotoGallery shopId={resolvedShop.id} shopName={resolvedShop.name} onUserClick={(id) => setViewingUserId(id)} />
          </div>
        )}
      </div>

      {/* Directions button + Rate button */}
      <div className="px-4 py-3 bg-white border-t border-cream-200 flex-shrink-0 flex gap-2">
        {(resolvedShop.lat && resolvedShop.lng) && (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${resolvedShop.lat},${resolvedShop.lng}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-cream-100 border border-cream-300 text-coffee-700 rounded-xl py-3 font-semibold text-sm px-4">
            <MapPin size={16} /> Directions
          </a>
        )}
        {onNavigateToBrew && (
          <button
            onClick={() => onNavigateToBrew(shop)}
            className="flex-1 flex items-center justify-center gap-2 text-white rounded-xl py-3 font-semibold text-sm"
            style={{ background: '#c8853a' }}>
            ☕ Rate a Visit
          </button>
        )}
        <button
          onClick={() => setShowCoffeeDate(true)}
          className="flex items-center justify-center gap-1.5 bg-cream-100 border border-cream-300 text-coffee-700 rounded-xl py-3 font-semibold text-sm px-4">
          📅 Date
        </button>
        <button
          onClick={toggleWishlist}
          disabled={wishlistLoading}
          className="flex items-center justify-center gap-1 rounded-xl py-3 font-semibold text-sm px-3 border transition-all disabled:opacity-50"
          style={{
            background: wishlisted ? '#fdf0dc' : 'white',
            borderColor: wishlisted ? '#c8853a' : '#e0c8a0',
            color: wishlisted ? '#c8853a' : '#9b7a55',
          }}>
          {wishlisted ? '☕ Saved' : '+ Wishlist'}
        </button>
        {!onNavigateToBrew && (resolvedShop.lat && resolvedShop.lng) && null}
      </div>
      {isInDb && !resolvedShop.claimed_by && profile && !['business', 'admin', 'moderator'].includes(profile.role) && (
        <div className="px-4 pb-3 bg-white flex-shrink-0">
          <button
            onClick={() => setShowClaim(true)}
            className="w-full py-2.5 rounded-xl text-xs font-medium border border-cream-300 text-coffee-500 bg-cream-50">
            Own this shop? Claim it free ☕
          </button>
        </div>
      )}
      {showCoffeeDate && (
        <CoffeeDate onClose={() => setShowCoffeeDate(false)} preselectedShop={resolvedShop} />
      )}
      {showClaim && (
        <ClaimShopModal
          shop={{ id: resolvedShop.id, name: resolvedShop.name }}
          onClose={() => setShowClaim(false)}
        />
      )}
      {viewingUserId && (
        <div className="fixed inset-0 z-[60] bg-cream-100 overflow-y-auto">
          <UserProfilePage userId={viewingUserId} onBack={() => setViewingUserId(null)} />
        </div>
      )}
    </div>
  )
}
