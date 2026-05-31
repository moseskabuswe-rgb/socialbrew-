import { useState, useEffect, lazy, Suspense } from 'react'
import { X, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { getBadge } from '../../lib/badges'
import { cachedUrl } from '../../lib/storageUrl'

const CoffeeMap = lazy(() => import('../profile/CoffeeMap'))

type Props = {
  userId: string
  onClose: () => void
}

export default function UserProfileModal({ userId, onClose }: Props) {
  const { profile: me } = useAuth()
  const [user, setUser] = useState<any>(null)
  const [ratings, setRatings] = useState<any[]>([])
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followPending, setFollowPending] = useState(false)
  const [visitedShops, setVisitedShops] = useState<any[]>([])
  const [activeSection, setActiveSection] = useState<'sips' | 'map'>('sips')
  const [loading, setLoading] = useState(true)
  const [zoomedAvatar, setZoomedAvatar] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const profileRes = await supabase.from('profiles').select('*').eq('id', userId).single()
      const ratingsRes = await supabase.from('ratings').select('*, coffee_shops(name,photo_url,city,state,country,continent)').eq('user_id', userId).order('created_at', { ascending: false }).limit(8)
      const visitsRes = await supabase.from('user_shop_visits').select('*, coffee_shops(id,name,city,state,lat,lng,photo_url)').eq('user_id', userId).order('visit_count', { ascending: false })
      const { count: fCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId).eq('status', 'accepted')
      const { count: fgCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId).eq('status', 'accepted')
      let amFollowing = false
      let amPending = false
      if (me) {
        const { data: followRow } = await supabase.from('follows').select('status').eq('follower_id', me.id).eq('following_id', userId).maybeSingle()
        amFollowing = followRow?.status === 'accepted'
        amPending = followRow?.status === 'pending'
      }
      if (profileRes.data) setUser(profileRes.data)
      if (ratingsRes.data) setRatings(ratingsRes.data)
      if (visitsRes.data) setVisitedShops(visitsRes.data)
      setFollowerCount(fCount ?? 0)
      setFollowingCount(fgCount ?? 0)
      setIsFollowing(amFollowing)
      setFollowPending(amPending)
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
      if (isFollowing) setFollowerCount(n => Math.max(0, n - 1))
    } else {
      await supabase.from('follows').insert({ follower_id: me.id, following_id: userId, status: 'pending' })
      await supabase.from('notifications').insert({ user_id: userId, actor_id: me.id, type: 'follow_request' })
      setFollowPending(true)
    }
  }

  // Build exploration stats from loaded ratings for accurate badge calculation
  const explorationStats = (() => {
    const shops = ratings.filter((r: any) => r.coffee_shops)
    return {
      uniqueShops:      new Set(shops.map((r: any) => r.shop_id)).size,
      uniqueCities:     new Set(shops.map((r: any) => r.coffee_shops?.city).filter(Boolean)).size,
      uniqueStates:     new Set(shops.map((r: any) => r.coffee_shops?.state).filter(Boolean)).size,
      uniqueCountries:  new Set(shops.map((r: any) => r.coffee_shops?.country).filter(Boolean)).size,
      uniqueContinents: new Set(shops.map((r: any) => r.coffee_shops?.continent).filter(Boolean)).size,
      firstBrews:       0,
      streakWeeks:      0,
    }
  })()

  const badge = getBadge(ratings.length, explorationStats).current

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.85)'}}>
      <div className="w-full max-w-sm bg-cream-100 rounded-t-3xl animate-slide-up flex flex-col" style={{ maxHeight: '88vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-cream-200 rounded-t-3xl flex-shrink-0">
          <h3 className="font-display font-bold text-coffee-800 text-lg">Profile</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500">
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-8">
          {loading && (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
            </div>
          )}

          {!loading && user && (
            <>
              {/* Profile card */}
              <div className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm border border-cream-200">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => user.avatar_url && setZoomedAvatar(cachedUrl(user.avatar_url))}
                    className="w-20 h-20 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0 active:scale-95 transition-transform"
                    style={{ border: '1px solid rgba(200,180,150,0.3)' }}
                  >
                    {user.avatar_url
                      ? <img src={cachedUrl(user.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)', willChange: 'transform' }} />
                      : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500">
                          <span className="text-white font-bold text-3xl">{user.username?.[0]?.toUpperCase()}</span>
                        </div>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-coffee-800 font-bold text-xl">{user.username}</p>
                    {user.full_name && <p className="text-coffee-500 text-sm">{user.full_name}</p>}
                    {user.bio && <p className="text-coffee-400 text-xs mt-1 line-clamp-2">{user.bio}</p>}
                    <div className="flex items-center gap-1.5 mt-2 w-fit bg-cream-100 rounded-full px-3 py-1 border border-cream-200">
                      <span>{badge.emoji}</span>
                      <span className="text-sm font-semibold" style={{ color: badge.color }}>{badge.label}</span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-cream-100 text-center">
                  <div>
                    <p className="text-coffee-800 font-bold text-lg">{ratings.length}</p>
                    <p className="text-coffee-400 text-xs">Sips</p>
                  </div>
                  <div>
                    <p className="text-coffee-800 font-bold text-lg">{followerCount}</p>
                    <p className="text-coffee-400 text-xs">Followers</p>
                  </div>
                  <div>
                    <p className="text-coffee-800 font-bold text-lg">{followingCount}</p>
                    <p className="text-coffee-400 text-xs">Following</p>
                  </div>
                </div>

                {/* Follow button — only show if viewing someone else's profile */}
                {me?.id !== userId && (
                  <button onClick={toggleFollow}
                    className={`w-full mt-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-1.5 ${
                      (isFollowing || followPending)
                        ? 'bg-cream-100 text-coffee-700 border border-cream-300'
                        : 'bg-caramel text-white'
                    }`}>
                    {isFollowing ? '✓ Following' : followPending ? '✓ Requested' : <><UserPlus size={15} /> Follow</>}
                  </button>
                )}
              </div>

              {/* Section toggle */}
              <div className="mx-4 mt-4 flex bg-white rounded-xl p-1 border border-cream-200 shadow-sm">
                <button onClick={() => setActiveSection('sips')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'sips' ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'}`}>
                  ☕ Coffee Sips
                </button>
                <button onClick={() => setActiveSection('map')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${activeSection === 'map' ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'}`}>
                  🗺️ Coffee Map
                </button>
              </div>

              {/* Sips */}
              {activeSection === 'sips' && (
                <div className="px-4 mt-3">
                  {ratings.length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-3xl mb-2">☕</p>
                      <p className="text-coffee-400 text-sm">No sips yet</p>
                    </div>
                  )}
                  <div className="space-y-2">
                    {ratings.map(r => {
                      const shop = r.coffee_shops as any
                      return (
                        <div key={r.id} className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm border border-cream-200">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-coffee-200 flex-shrink-0">
                            {shop?.photo_url
                              ? <img src={shop.photo_url} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)', willChange: 'transform' }} />
                              : <div className="w-full h-full flex items-center justify-center text-coffee-300 text-lg">☕</div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-coffee-700 font-semibold text-sm truncate">{shop?.name ?? 'Moment'}</p>
                            {r.drink_name
                              ? <p className="text-coffee-400 text-xs truncate">{r.drink_name}</p>
                              : shop?.city && <p className="text-coffee-400 text-xs">{shop.city}, {shop.state}</p>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-caramel font-bold text-sm">{r.fill_level}%</p>
                            <div className="w-10 h-1 bg-cream-200 rounded-full overflow-hidden mt-1">
                              <div className="h-full rounded-full bg-caramel" style={{ width: `${r.fill_level}%` }} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Map */}
              {activeSection === 'map' && (
                <div className="px-4 mt-3">
                  {visitedShops.length === 0 && (
                    <div className="text-center py-10">
                      <p className="text-3xl mb-2">🗺️</p>
                      <p className="text-coffee-400 text-sm">No shops visited yet</p>
                    </div>
                  )}
                  {visitedShops.length > 0 && (
                    <>
                      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-cream-200 mb-3">
                        <Suspense fallback={<div className="h-56 flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}>
                          <CoffeeMap visits={visitedShops as any} />
                        </Suspense>
                        <div className="px-4 py-2 border-t border-cream-100">
                          <p className="text-coffee-400 text-xs">{visitedShops.length} shop{visitedShops.length !== 1 ? 's' : ''} visited</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {visitedShops.map(v => {
                          const shop = v.coffee_shops as any
                          return (
                            <div key={v.shop_id} className="bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm border border-cream-200">
                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-coffee-200 flex-shrink-0">
                                {shop?.photo_url && <img src={shop.photo_url} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)', willChange: 'transform' }} />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-coffee-700 font-semibold text-sm truncate">{shop?.name}</p>
                                <p className="text-coffee-400 text-xs">{shop?.city}, {shop?.state}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-caramel font-bold text-sm">{v.visit_count}x</p>
                                <p className="text-coffee-400 text-xs">visited</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Avatar fullscreen zoom */}
      {zoomedAvatar && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center"
          onClick={() => setZoomedAvatar(null)}
        >
          <img
            src={zoomedAvatar}
            alt="Profile picture"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 12 }}
          />
          <button
            onClick={() => setZoomedAvatar(null)}
            style={{ position: 'absolute', top: 'max(16px, env(safe-area-inset-top, 16px))', right: 16, width: 44, height: 44, background: 'rgba(0,0,0,0.7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20, border: 'none', cursor: 'pointer', zIndex: 10 }}>
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
