import { useState, useEffect, lazy, Suspense } from 'react'
import PostDetailModal from './PostDetailModal'
import ShopDetailPage from './ShopDetailPage'
import { ArrowLeft, UserPlus, Check, MapPin, Coffee, Gift } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const CoffeeMap = lazy(() => import('../profile/CoffeeMap'))

function getBadgeInfo(count: number) {
  if (count >= 100) return { label: 'Brew Master', emoji: '👑', color: '#c0392b' }
  if (count >= 50) return { label: 'Connoisseur', emoji: '🏆', color: '#9b59b6' }
  if (count >= 25) return { label: 'Enthusiast', emoji: '🔥', color: '#e06030' }
  if (count >= 10) return { label: 'Regular', emoji: '⭐', color: '#d4a017' }
  if (count >= 3) return { label: 'Coffee Lover', emoji: '☕', color: '#c8853a' }
  return { label: 'Coffee Curious', emoji: '🌱', color: '#7aaa6a' }
}

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
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null)

  useEffect(() => {
    if (!meId) return
    supabase.from('follows').select('*', { count: 'exact', head: true })
      .eq('follower_id', meId).eq('following_id', targetId)
      .then(({ count }) => setIsFollowing((count ?? 0) > 0))
  }, [targetId, meId])

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!meId || isFollowing === null) return
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', meId).eq('following_id', targetId)
      setIsFollowing(false)
    } else {
      await supabase.from('follows').insert({ follower_id: meId, following_id: targetId })
      await supabase.from('notifications').insert({ user_id: targetId, actor_id: meId, type: 'follow' })
      setIsFollowing(true)
    }
  }

  if (isFollowing === null) return <div className="w-16 h-7 bg-cream-200 rounded-full animate-pulse" />

  return (
    <button onClick={toggle}
      className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
        isFollowing ? 'bg-cream-100 text-coffee-600 border border-cream-300' : 'bg-caramel text-white'
      }`}>
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  )
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
  const [activeSection, setActiveSection] = useState<Section>('sips')
  const [showFollowers, setShowFollowers] = useState<'followers' | 'following' | null>(null)
  const [activePost, setActivePost] = useState<any>(null)
  const [profileStack, setProfileStack] = useState<string[]>([])
  const [selectedShop, setSelectedShop] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const profileRes = await supabase.from('profiles').select('*').eq('id', userId).single()
      const ratingsRes = await supabase.from('ratings').select('*, coffee_shops(name,photo_url,city,state,address)').eq('user_id', userId).order('created_at', { ascending: false })
      const visitsRes = await supabase.from('user_shop_visits').select('*, coffee_shops(id,name,city,state,lat,lng,photo_url)').eq('user_id', userId).order('visit_count', { ascending: false })
      const wishlistRes = await supabase.from('wishlist').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      const followersRes = await supabase.from('follows').select('follower_id, profiles!follows_follower_id_fkey(id,username,full_name,avatar_url,badge)').eq('following_id', userId)
      const followingRes = await supabase.from('follows').select('following_id, profiles!follows_following_id_fkey(id,username,full_name,avatar_url,badge)').eq('follower_id', userId)

      if (profileRes.data) setUser(profileRes.data)
      if (ratingsRes.data) setRatings(ratingsRes.data)
      if (visitsRes.data) setVisitedShops(visitsRes.data)
      if (wishlistRes.data) setWishlist(wishlistRes.data)
      if (followersRes.data) setFollowers(followersRes.data.map((f: any) => f.profiles).filter(Boolean))
      if (followingRes.data) setFollowing(followingRes.data.map((f: any) => f.profiles).filter(Boolean))

      if (me) {
        const { count } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', me.id).eq('following_id', userId)
        setIsFollowing((count ?? 0) > 0)
      }
      setLoading(false)
    }
    load()
  }, [userId, me])

  async function toggleFollow() {
    if (!me || !user) return
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', me.id).eq('following_id', userId)
      setIsFollowing(false)
      setFollowers(prev => prev.filter(f => f.id !== me.id))
    } else {
      await supabase.from('follows').insert({ follower_id: me.id, following_id: userId })
      await supabase.from('notifications').insert({ user_id: userId, actor_id: me.id, type: 'follow' })
      setIsFollowing(true)
      setFollowers(prev => [...prev, { id: me.id, username: me.username, avatar_url: me.avatar_url, badge: me.badge }])
    }
  }

  const badge = getBadgeInfo(ratings.length)
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
                    ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
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
            <div className="w-20 h-20 rounded-full overflow-hidden bg-coffee-200 isolate flex-shrink-0" style={{ border: '1px solid rgba(200,180,150,0.3)' }}>
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500">
                    <span className="text-white font-bold text-3xl">{user?.username?.[0]?.toUpperCase()}</span>
                  </div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-coffee-800 font-bold text-xl">{user?.username}</p>
              {user?.full_name && <p className="text-coffee-500 text-sm">{user.full_name}</p>}
              {user?.bio && <p className="text-coffee-400 text-xs mt-1 line-clamp-2">{user.bio}</p>}
              <div className="flex items-center gap-1.5 mt-2 w-fit bg-cream-100 rounded-full px-3 py-1 border border-cream-200">
                <span>{badge.emoji}</span>
                <span className="text-sm font-semibold" style={{ color: badge.color }}>{badge.label}</span>
              </div>
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
                isFollowing ? 'bg-cream-100 text-coffee-700 border border-cream-300' : 'bg-caramel text-white'
              }`}>
              {isFollowing ? <><Check size={15} /> Following</> : <><UserPlus size={15} /> Follow</>}
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
                      ? <img src={shop.photo_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xl">☕</div>}
                  </button>
                  <button onClick={() => setActivePost(r)} className="flex-1 min-w-0 text-left">
                    <p className="text-coffee-800 font-semibold text-sm truncate">{shop?.name ?? 'Moment'}</p>
                    {r.drink_name && <p className="text-coffee-400 text-xs">{r.drink_name}</p>}
                    {r.visit_time && <p className="text-coffee-300 text-xs">🕐 {r.visit_time}</p>}
                    {r.photo_url && <p className="text-caramel text-xs">📷 Photo</p>}
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
                    {shop?.photo_url && <img src={shop.photo_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-coffee-800 font-semibold text-sm truncate">{shop?.name}</p>
                    <p className="text-coffee-400 text-xs">{shop?.city}, {shop?.state}</p>
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
    </div>
  )
}
