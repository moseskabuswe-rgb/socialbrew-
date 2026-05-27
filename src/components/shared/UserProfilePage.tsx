import { useState, useEffect, lazy, Suspense } from 'react'
import PostDetailModal from './PostDetailModal'
import ShopDetailPage from './ShopDetailPage'
import { ArrowLeft, UserPlus, Check, MapPin, Coffee, Gift } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getBadge } from '../../lib/badges'
import { notifyFollow } from '../../lib/push'
import BadgeExplainerModal from './BadgeExplainerModal'
import { useAuth } from '../../contexts/AuthContext'
import { cachedUrl } from '../../lib/storageUrl'

const CoffeeMap = lazy(() => import('../profile/CoffeeMap'))

// getBadgeInfo replaced by getBadge from badges.ts

function getMugColor(fill: number) {
  if (fill <= 20) return '#b0c4d4'
  if (fill <= 40) return '#c8924a'
  if (fill <= 60) return '#a06428'
  if (fill <= 80) return '#7a3e10'
  return '#4e2008'
}

type Section = 'sips' | 'map' | 'shops' | 'wishlist'

type Props = {
  userId: string
  onBack: () => void
}


// Standalone follow button with its own state
function FollowButton({ targetId, meId }: { targetId: string; meId?: string }) {
  const [followStatus, setFollowStatus] = useState<'none' | 'pending' | 'accepted' | null>(null)

  useEffect(() => {
    if (!meId) return
    supabase.from('follows').select('status')
      .eq('follower_id', meId).eq('following_id', targetId)
      .maybeSingle()
      .then(({ data }) => setFollowStatus(data ? (data.status as 'pending' | 'accepted') : 'none'))
  }, [targetId, meId])

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!meId || followStatus === null) return
    if (followStatus !== 'none') {
      await supabase.from('follows').delete().eq('follower_id', meId).eq('following_id', targetId)
      setFollowStatus('none')
    } else {
      await supabase.from('follows').insert({ follower_id: meId, following_id: targetId, status: 'pending' })
      await supabase.from('notifications').insert({ user_id: targetId, actor_id: meId, type: 'follow_request' })
      const { data: me } = await supabase.from('profiles').select('username').eq('id', meId).single()
      if (me?.username) notifyFollow(targetId, me.username, meId)
      setFollowStatus('pending')
    }
  }

  if (followStatus === null) return <div className="w-16 h-7 bg-cream-200 rounded-full animate-pulse" />

  return (
    <button onClick={toggle}
      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
        followStatus === 'none' ? 'bg-caramel text-white' : 'bg-cream-100 text-coffee-600 border border-cream-300'
      }`}>
      {followStatus === 'accepted' ? 'Following' : followStatus === 'pending' ? 'Requested' : 'Follow'}
    </button>
  )
}

function formatLocation(city?: string | null, state?: string | null, country?: string | null): string {
  const c = city?.trim()
  const s = state?.trim()
  const co = country?.trim()
  if (!c) return s || co || ''
  if (s && (!co || co === 'United States')) return `${c}, ${s}`
  if (co && co !== 'United States') return `${c}, ${co}`
  return c
}

export default function UserProfilePage({ userId, onBack }: Props) {
  const { profile: me } = useAuth()
  const [user, setUser] = useState<any>(null)
  const [ratings, setRatings] = useState<any[]>([])
  const [visitedShops, setVisitedShops] = useState<any[]>([])
  const [wishlist, setWishlist] = useState<any[]>([])
  const [followers, setFollowers] = useState<any[]>([])
  const [following, setFollowing] = useState<any[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [followPending, setFollowPending] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('sips')
  const [showFollowers, setShowFollowers] = useState<'followers' | 'following' | null>(null)
  const [activePost, setActivePost] = useState<any>(null)
  const [profileStack, setProfileStack] = useState<string[]>([])
  const [selectedShop, setSelectedShop] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showBadgeExplainer, setShowBadgeExplainer] = useState(false)

  useEffect(() => {
    async function load() {
      const [profileRes, ratingsRes, visitsRes, wishlistRes, followersRes, followingRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('ratings').select('*, coffee_shops(id,name,photo_url,city,state,country,continent,address,lat,lng)').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
        supabase.from('user_shop_visits').select('*, coffee_shops(id,name,city,state,lat,lng,photo_url)').eq('user_id', userId).order('visit_count', { ascending: false }),
        supabase.from('wishlist').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('follows').select('follower_id, profiles!follows_follower_id_fkey(id,username,full_name,avatar_url,badge)').eq('following_id', userId).eq('status', 'accepted'),
        supabase.from('follows').select('following_id, profiles!follows_following_id_fkey(id,username,full_name,avatar_url,badge)').eq('follower_id', userId).eq('status', 'accepted'),
      ])

      if (profileRes.data) setUser(profileRes.data)
      if (ratingsRes.data) setRatings(ratingsRes.data)

      // Use user_shop_visits if available, otherwise build from ratings as fallback
      // (handles case where trigger hasn't fired or RLS is blocking)
      if (visitsRes.data && visitsRes.data.length > 0) {
        setVisitedShops(visitsRes.data)
      } else if (ratingsRes.data && ratingsRes.data.length > 0) {
        // Build visit map from ratings — group by shop, count visits
        const shopMap: Record<string, any> = {}
        for (const r of ratingsRes.data) {
          if (!r.shop_id || !r.coffee_shops) continue
          if (!shopMap[r.shop_id]) {
            shopMap[r.shop_id] = {
              shop_id: r.shop_id,
              visit_count: 0,
              coffee_shops: r.coffee_shops,
            }
          }
          shopMap[r.shop_id].visit_count++
        }
        setVisitedShops(Object.values(shopMap))
      }
      if (wishlistRes.data) setWishlist(wishlistRes.data)
      if (followersRes.data) setFollowers(followersRes.data.map((f: any) => f.profiles).filter(Boolean))
      if (followingRes.data) setFollowing(followingRes.data.map((f: any) => f.profiles).filter(Boolean))

      if (me) {
        const { data: followRow } = await supabase.from('follows').select('status')
          .eq('follower_id', me.id).eq('following_id', userId).maybeSingle()
        setIsFollowing(followRow?.status === 'accepted')
        setFollowPending(followRow?.status === 'pending')
      }
      setLoading(false)
    }
    load()
  }, [userId, me])

  async function toggleFollow() {
    if (!me || !user) return
    if (isFollowing || followPending) {
      await supabase.from('follows').delete().eq('follower_id', me.id).eq('following_id', userId)
      setIsFollowing(false)
      setFollowPending(false)
      setFollowers(prev => prev.filter(f => f.id !== me.id))
    } else {
      await supabase.from('follows').insert({ follower_id: me.id, following_id: userId, status: 'pending' })
      await supabase.from('notifications').insert({ user_id: userId, actor_id: me.id, type: 'follow_request' })
      setFollowPending(true)
    }
  }

  // Compute exploration stats for badge
  const explorationStats = (() => {
    const shops = ratings.filter((r: any) => r.coffee_shops)
    return {
      uniqueShops: new Set(shops.map((r: any) => r.shop_id)).size,
      uniqueCities: new Set(shops.map((r: any) => r.coffee_shops?.city).filter(Boolean)).size,
      uniqueStates: new Set(shops.map((r: any) => r.coffee_shops?.state).filter(Boolean)).size,
      uniqueCountries: new Set(shops.map((r: any) => r.coffee_shops?.country).filter(Boolean)).size,
      uniqueContinents: new Set(shops.map((r: any) => r.coffee_shops?.continent).filter(Boolean)).size,
      firstBrews: 0, // first_brew column not yet in schema
      streakWeeks: 0,
    }
  })()
  const badgeResult = getBadge(ratings.length, explorationStats)
  const badge = badgeResult.current
  const isOwnProfile = me?.id === userId

  // ── FOLLOWERS/FOLLOWING SHEET ────────────────────────────
  if (showFollowers) {
    const list = showFollowers === 'followers' ? followers : following
    return (
      <div
        className="min-h-screen bg-cream-100 flex flex-col"
        onTouchStart={e => { (e.currentTarget as any)._swipeX = e.touches[0].clientX }}
        onTouchEnd={e => { const dx = e.changedTouches[0].clientX - ((e.currentTarget as any)._swipeX || 0); if (dx > 80) { if (profileStack.length > 0) setProfileStack(prev => prev.slice(0, -1)); else setShowFollowers(null) } }}
      >
        <div className="sticky top-0 z-10 bg-white border-b border-cream-200 px-5 py-4 flex items-center gap-3">
          <button onClick={() => setShowFollowers(null)} className="text-coffee-500"><ArrowLeft size={22} /></button>
          <h2 className="font-display text-xl font-bold text-coffee-800 capitalize">{showFollowers}</h2>
        </div>
        <div className="flex-1">
          {list.length === 0 && <div className="text-center py-16"><p className="text-coffee-400">No {showFollowers} yet</p></div>}
          {list.map((u: any) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-cream-100 bg-white">
              <button onClick={() => setProfileStack(prev => [...prev, u.id])} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                  {u.avatar_url
                    ? <img src={cachedUrl(u.avatar_url)} alt="" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)', willChange: 'transform' }} />
                    : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white font-bold text-sm">{u.username?.[0]?.toUpperCase()}</span></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-coffee-800 font-semibold text-sm">{u.username}</p>
                  <p className="text-coffee-400 text-xs">{u.badge || 'Coffee Curious'}</p>
                </div>
              </button>
              {me?.id !== u.id && (
                <FollowButton targetId={u.id} meId={me?.id} />
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className="min-h-screen bg-cream-100 flex flex-col"
        onTouchStart={e => { (e.currentTarget as any)._swipeX = e.touches[0].clientX }}
        onTouchEnd={e => { const dx = e.changedTouches[0].clientX - ((e.currentTarget as any)._swipeX || 0); if (dx > 80) onBack() }}
      >
        <div className="sticky top-0 z-10 bg-white border-b border-cream-200 px-5 py-4 flex items-center gap-3">
          <button onClick={onBack} className="text-coffee-500"><ArrowLeft size={22} /></button>
        </div>
        <div className="flex justify-center py-20"><div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen bg-cream-100 flex flex-col"
      onTouchStart={e => { (e.currentTarget as any)._swipeX = e.touches[0].clientX }}
      onTouchEnd={e => { const dx = e.changedTouches[0].clientX - ((e.currentTarget as any)._swipeX || 0); if (dx > 80) onBack() }}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-cream-200 px-5 py-4 flex items-center gap-3">
        <button onClick={onBack} className="text-coffee-500"><ArrowLeft size={22} /></button>
        <h2 className="font-display text-xl font-bold text-coffee-800 flex-1 truncate">{user?.username}</h2>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        {/* Profile Card */}
        <div className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm border border-cream-200">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0" style={{ border: '1px solid rgba(200,180,150,0.3)' }}>
              {user?.avatar_url
                ? <img src={cachedUrl(user.avatar_url)} alt="" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)', willChange: 'transform' }} />
                : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500">
                    <span className="text-white font-bold text-3xl">{user?.username?.[0]?.toUpperCase()}</span>
                  </div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-coffee-800 font-bold text-xl">{user?.username}</p>
              {user?.full_name && <p className="text-coffee-500 text-sm">{user.full_name}</p>}
              {user?.bio && <p className="text-coffee-400 text-xs mt-1 line-clamp-2">{user.bio}</p>}
              <button
                onClick={() => setShowBadgeExplainer(true)}
                className="flex items-center gap-1.5 mt-2 w-fit bg-cream-100 rounded-full px-3 py-1 border border-cream-200 active:scale-95 transition-all">
                <span>{badge.emoji}</span>
                <span className="text-sm font-semibold" style={{ color: badge.color }}>{badge.label}</span>
                <span className="text-coffee-300 text-xs">ⓘ</span>
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-cream-100">
            <div className="text-center">
              <p className="text-coffee-800 font-bold text-lg">{ratings.length}</p>
              <p className="text-coffee-400 text-xs">Sips</p>
            </div>
            <div className="text-center">
              <p className="text-coffee-800 font-bold text-lg">{visitedShops.length}</p>
              <p className="text-coffee-400 text-xs">Shops</p>
            </div>
            <button onClick={() => setShowFollowers('followers')} className="text-center hover:opacity-70 transition-opacity">
              <p className="text-coffee-800 font-bold text-lg">{followers.length}</p>
              <p className="text-caramel text-xs font-medium">Followers</p>
            </button>
            <button onClick={() => setShowFollowers('following')} className="text-center hover:opacity-70 transition-opacity">
              <p className="text-coffee-800 font-bold text-lg">{following.length}</p>
              <p className="text-caramel text-xs font-medium">Following</p>
            </button>
          </div>

          {/* Streak */}
          {(user?.current_streak > 0) && (
            <div className="flex items-center gap-3 mt-4 bg-cream-50 rounded-2xl px-4 py-3 border border-cream-200">
              <div className="w-9 h-9 rounded-full bg-caramel/10 flex items-center justify-center flex-shrink-0">
                <span className="text-lg">{user.current_streak >= 4 ? '🔥' : '☕'}</span>
              </div>
              <div className="flex-1">
                <p className="text-coffee-800 font-bold text-sm">{user.current_streak}-week streak</p>
                <p className="text-coffee-400 text-xs">Best: {user.longest_streak || user.current_streak} weeks</p>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(7, user.current_streak) }).map((_: any, i: number) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-caramel" />
                ))}
              </div>
            </div>
          )}

          {/* Follow button */}
          {!isOwnProfile && (
            <button onClick={toggleFollow}
              className={`w-full mt-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-1.5 ${
                (isFollowing || followPending) ? 'bg-cream-100 text-coffee-700 border border-cream-300' : 'bg-caramel text-white'
              }`}>
              {isFollowing ? <><Check size={15} /> Following</> : followPending ? <><Check size={15} /> Requested</> : <><UserPlus size={15} /> Follow</>}
            </button>
          )}
        </div>

        {/* Section tabs */}
        <div className="mx-4 mt-4 grid grid-cols-4 bg-white rounded-xl p-1 border border-cream-200 shadow-sm gap-1">
          {([
            { key: 'sips', icon: <Coffee size={13} />, label: 'Sips' },
            { key: 'map', icon: <MapPin size={13} />, label: 'Map' },
            { key: 'shops', icon: '🏪', label: 'Shops' },
            { key: 'wishlist', icon: <Gift size={13} />, label: 'Wishlist' },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setActiveSection(tab.key)}
              className={`py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                activeSection === tab.key ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'
              }`}>
              {typeof tab.icon === 'string' ? <span>{tab.icon}</span> : tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── SIPS ─────────────────────────────────────── */}
        {activeSection === 'sips' && (
          <div className="px-4 mt-3 space-y-2">
            {ratings.length === 0 && (
              <div className="text-center py-12"><p className="text-4xl mb-2">☕</p><p className="text-coffee-400">No sips yet</p></div>
            )}
            {ratings.map(r => {
              const shop = r.coffee_shops as any
              return (
                <div key={r.id} className="w-full bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-cream-200">
                  <button onClick={() => shop && setSelectedShop(shop)} className="w-10 h-10 rounded-xl overflow-hidden bg-coffee-200 flex-shrink-0">
                    {shop?.photo_url
                      ? <img src={cachedUrl(shop.photo_url)} alt="" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)', willChange: 'transform' }} />
                      : <div className="w-full h-full flex items-center justify-center text-xl">☕</div>}
                  </button>
                  <button onClick={() => setActivePost(r)} className="flex-1 min-w-0 text-left">
                    <p className="text-coffee-800 font-semibold text-sm truncate">{shop?.name ?? 'Moment'}</p>
                    {r.drink_name && <p className="text-coffee-400 text-xs">{r.drink_name}</p>}
                    {r.visit_time && <p className="text-coffee-300 text-xs">🕐 {r.visit_time}</p>}
                    {(r.photo_urls?.length > 0 || r.photo_url) && <p className="text-caramel text-xs">📷 {r.photo_urls?.length > 1 ? `${r.photo_urls.length} photos` : 'Photo'}</p>}
                  </button>
                  <div className="text-right flex-shrink-0">
                    <p className="text-coffee-800 font-bold text-sm">{r.fill_level}%</p>
                    <div className="w-12 h-1.5 bg-cream-200 rounded-full overflow-hidden mt-1">
                      <div className="h-full rounded-full" style={{ width: `${r.fill_level}%`, background: getMugColor(r.fill_level) }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── MAP ──────────────────────────────────────── */}
        {activeSection === 'map' && (
          <div className="px-4 mt-3">
            {visitedShops.length === 0 && (
              <div className="text-center py-12"><p className="text-4xl mb-2">🗺️</p><p className="text-coffee-400">No shops on the map yet</p></div>
            )}
            {visitedShops.length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-cream-200">
                <Suspense fallback={<div className="h-72 flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}>
                  <CoffeeMap visits={visitedShops as any} />
                </Suspense>
                <div className="px-4 py-2 border-t border-cream-100">
                  <p className="text-coffee-400 text-xs">{visitedShops.length} shop{visitedShops.length !== 1 ? 's' : ''} visited</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SHOPS ────────────────────────────────────── */}
        {activeSection === 'shops' && (
          <div className="px-4 mt-3 space-y-2">
            {visitedShops.length === 0 && (
              <div className="text-center py-12"><p className="text-4xl mb-2">🏪</p><p className="text-coffee-400">No shops visited yet</p></div>
            )}
            {visitedShops.map(v => {
              const shop = v.coffee_shops as any
              return (
                <div key={v.shop_id} className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-cream-200">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-coffee-200 flex-shrink-0">
                    {shop?.photo_url && <img src={cachedUrl(shop.photo_url)} alt="" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)', willChange: 'transform' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-coffee-800 font-semibold text-sm truncate">{shop?.name}</p>
                    <p className="text-coffee-400 text-xs">{formatLocation(shop?.city, shop?.state, shop?.country)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-caramel font-bold text-base">{v.visit_count}x</p>
                    <p className="text-coffee-400 text-xs">visited</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── WISHLIST ──────────────────────────────────── */}
        {activeSection === 'wishlist' && (
          <div className="px-4 mt-3 space-y-2">
            {wishlist.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-2">☕</p>
                <p className="text-coffee-600 font-display">{isOwnProfile ? 'Your coffee wishlist' : `${user?.username}'s wishlist`}</p>
                <p className="text-coffee-400 text-sm mt-1">{isOwnProfile ? 'Add drinks you want to try' : 'Nothing on the wishlist yet'}</p>
              </div>
            )}
            {wishlist.map(item => (
              <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-cream-200">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-lg">☕</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-coffee-800 font-semibold text-sm">{item.drink_name}</p>
                    {item.shop_name && <p className="text-caramel text-xs mt-0.5">@ {item.shop_name}</p>}
                    {item.notes && <p className="text-coffee-400 text-xs mt-1">{item.notes}</p>}
                  </div>
                  {item.is_fulfilled && (
                    <span className="text-green-500 text-xs font-semibold bg-green-50 px-2 py-0.5 rounded-full border border-green-200 flex-shrink-0">
                      ✓ Tried it!
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    {activePost && <PostDetailModal rating={activePost} onClose={() => setActivePost(null)} onShopClick={(shop) => { setActivePost(null); setSelectedShop(shop) }} />}
    {selectedShop && <ShopDetailPage shop={selectedShop} onBack={() => setSelectedShop(null)} />}
    {profileStack.length > 0 && (
      <div className="fixed inset-0 z-[80] bg-cream-100 overflow-y-auto">
        <UserProfilePage
          userId={profileStack[profileStack.length - 1]}
          onBack={() => setProfileStack(prev => prev.slice(0, -1))}
        />
      </div>
    )}
      {showBadgeExplainer && (
        <BadgeExplainerModal
          type="badge"
          badge={badge}
          onClose={() => setShowBadgeExplainer(false)}
        />
      )}
    </div>
  )
}
