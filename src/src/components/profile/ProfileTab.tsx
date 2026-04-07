import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { MapPin, LogOut, Coffee, Camera, Search, UserPlus, Check, ChevronRight, Bell, Lock, HelpCircle, Settings } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Rating } from '../../lib/supabase'

const CoffeeMap = lazy(() => import('./CoffeeMap'))

// Badge progression system
const BADGES = [
  { label: 'Coffee Curious', emoji: '🌱', minRatings: 0, color: '#8a9e7a' },
  { label: 'Coffee Lover', emoji: '☕', minRatings: 3, color: '#c8853a' },
  { label: 'Regular', emoji: '⭐', minRatings: 10, color: '#c8a832' },
  { label: 'Coffee Enthusiast', emoji: '🏅', minRatings: 25, color: '#7a8ac8' },
  { label: 'Connoisseur', emoji: '🏆', minRatings: 50, color: '#9a7ac8' },
  { label: 'Brew Master', emoji: '👑', minRatings: 100, color: '#c87a32' },
]

function getBadgeInfo(ratingCount: number) {
  let current = BADGES[0]
  let next = BADGES[1]
  for (let i = BADGES.length - 1; i >= 0; i--) {
    if (ratingCount >= BADGES[i].minRatings) { current = BADGES[i]; next = BADGES[i + 1] || BADGES[i]; break }
  }
  const progress = next === current ? 100
    : Math.round(((ratingCount - current.minRatings) / (next.minRatings - current.minRatings)) * 100)
  return { current, next, progress, ratingCount }
}

type VisitedShop = {
  shop_id: string; visit_count: number
  coffee_shops: { name: string; city: string; state: string; lat: number | null; lng: number | null; photo_url: string | null }
}

type ProfileUser = { id: string; username: string; full_name: string | null; avatar_url: string | null; badge: string | null }

export default function ProfileTab() {
  const { profile, signOut, refreshProfile } = useAuth()
  const [ratings, setRatings] = useState<Rating[]>([])
  const [visitedShops, setVisitedShops] = useState<VisitedShop[]>([])
  const [followerCount, setFollowerCount] = useState(0)
  const [followingList, setFollowingList] = useState<ProfileUser[]>([])
  const [followerList, setFollowerList] = useState<ProfileUser[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'sips' | 'map'>('sips')
  const [activeTab, setActiveTab] = useState<'profile' | 'friends' | 'following' | 'settings' | 'wishlist'>('profile')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [friendSearch, setFriendSearch] = useState('')
  const [searchResults, setSearchResults] = useState<ProfileUser[]>([])
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [wishlistItems, setWishlistItems] = useState<any[]>([])
  const [newDrink, setNewDrink] = useState('')
  const [newShop, setNewShop] = useState('')
  const [addingWishlist, setAddingWishlist] = useState(false)
  const [editUsername, setEditUsername] = useState('')
  const [editBio, setEditBio] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!profile) return
    setEditUsername(profile.username || '')
    setEditBio((profile as any).bio || '')
    async function load() {
      const [ratingsRes, visitsRes, followersRes, followingRes] = await Promise.all([
        supabase.from('ratings').select('*, coffee_shops(*)').eq('user_id', profile!.id).order('created_at', { ascending: false }),
        supabase.from('user_shop_visits').select('*, coffee_shops(id,name,city,state,lat,lng,photo_url)').eq('user_id', profile!.id).order('visit_count', { ascending: false }),
        supabase.from('follows').select('follower_id, profiles!follows_follower_id_fkey(id,username,full_name,avatar_url,badge)').eq('following_id', profile!.id),
        supabase.from('follows').select('following_id, profiles!follows_following_id_fkey(id,username,full_name,avatar_url,badge)').eq('follower_id', profile!.id),
        supabase.from('wishlist').select('*').eq('user_id', profile!.id).order('created_at', { ascending: false }),
      ])
      if (ratingsRes.data) setRatings(ratingsRes.data)
      if (visitsRes.data) setVisitedShops(visitsRes.data as any)
      if (followersRes.data) {
        setFollowerCount(followersRes.data.length)
        setFollowerList(followersRes.data.map((f: any) => f.profiles).filter(Boolean))
      }
      if (followingRes.data) {
        const followingProfiles = followingRes.data.map((f: any) => f.profiles).filter(Boolean)
        setFollowingList(followingProfiles)
        setFollowing(new Set(followingProfiles.map((p: any) => p.id)))
      }
      const wishRes = await supabase.from('wishlist').select('*').eq('user_id', profile!.id).order('created_at', { ascending: false })
      if (wishRes.data) setWishlistItems(wishRes.data)
      setLoading(false)
    }
    load()
  }, [profile])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10MB'); return }
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `avatars/${profile.id}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: `${publicUrl}?t=${Date.now()}` }).eq('id', profile.id)
      await refreshProfile()
    } catch (err: any) { alert(`Upload failed: ${err.message}`) }
    setUploadingAvatar(false)
  }

  async function searchFriends(q: string) {
    setFriendSearch(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase.from('profiles').select('id,username,full_name,avatar_url,badge')
      .ilike('username', `%${q}%`).neq('id', profile?.id).limit(10)
    setSearchResults((data || []) as any)
    setSearching(false)
  }

  async function toggleFollow(userId: string) {
    if (!profile) return
    if (following.has(userId)) {
      await supabase.from('follows').delete().eq('follower_id', profile.id).eq('following_id', userId)
      setFollowing(prev => { const n = new Set(prev); n.delete(userId); return n })
      setFollowingList(prev => prev.filter(p => p.id !== userId))
    } else {
      await supabase.from('follows').insert({ follower_id: profile.id, following_id: userId })
      setFollowing(prev => new Set([...prev, userId]))
      const user = searchResults.find(u => u.id === userId)
      if (user) setFollowingList(prev => [...prev, user])
    }
  }

  async function saveProfile() {
    if (!profile || !editUsername.trim()) return
    setSavingProfile(true)
    await supabase.from('profiles').update({ username: editUsername.trim(), bio: editBio.trim() }).eq('id', profile.id)
    await refreshProfile()
    setSavingProfile(false)
    alert('Profile updated!')
  }

  if (!profile) return null

  const badgeInfo = getBadgeInfo(ratings.length)
  const avgFill = ratings.length > 0 ? Math.round(ratings.reduce((s, r) => s + r.fill_level, 0) / ratings.length) : 0

  const UserCard = ({ user }: { user: ProfileUser }) => (
    <div className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-cream-200">
      <div className="w-11 h-11 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
        {user.avatar_url
          ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500">
              <span className="text-white font-bold text-sm">{user.username[0].toUpperCase()}</span>
            </div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-coffee-800 font-semibold text-sm">{user.username}</p>
        {user.full_name && <p className="text-coffee-400 text-xs">{user.full_name}</p>}
      </div>
      <button onClick={() => toggleFollow(user.id)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${following.has(user.id) ? 'bg-cream-200 text-coffee-600 border border-cream-300' : 'bg-caramel text-white'}`}>
        {following.has(user.id) ? <><Check size={12} /> Following</> : <><UserPlus size={12} /> Follow</>}
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="sticky top-0 z-10 bg-cream-100/95 backdrop-blur-sm border-b border-cream-200 px-5 py-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-coffee-800">Profile</h1>
        <button onClick={() => setActiveTab('settings')} className="text-coffee-500">
          <Settings size={22} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="mx-4 mt-4 flex bg-white rounded-xl p-1 border border-cream-200 shadow-sm overflow-x-auto scrollbar-hide">
        {[
          { id: 'profile', label: 'Me' },
          { id: 'friends', label: 'Find Friends' },
          { id: 'following', label: `Following ${followingList.length}` },
          { id: 'wishlist', label: '☕ Wishlist' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap px-2 ${activeTab === tab.id ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pb-28">


        {/* WISHLIST TAB */}
        {activeTab === 'wishlist' && (
          <div className="px-4 mt-4">
            {/* Add to wishlist */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-cream-200 mb-4">
              <p className="text-coffee-500 text-xs uppercase tracking-wider font-medium mb-3">Add a Drink</p>
              <div className="space-y-2 mb-3">
                <input value={newDrink} onChange={e => setNewDrink(e.target.value)}
                  placeholder="Drink name (e.g. Vanilla Latte)"
                  className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-2.5 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300" />
                <input value={newShop} onChange={e => setNewShop(e.target.value)}
                  placeholder="From which shop? (optional)"
                  className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-2.5 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300" />
              </div>
              <button
                disabled={!newDrink.trim() || addingWishlist}
                onClick={async () => {
                  if (!profile || !newDrink.trim()) return
                  setAddingWishlist(true)
                  const { data } = await supabase.from('wishlist').insert({
                    user_id: profile.id,
                    drink_name: newDrink.trim(),
                    shop_name: newShop.trim() || null,
                  }).select().single()
                  if (data) setWishlistItems(prev => [data, ...prev])
                  setNewDrink('')
                  setNewShop('')
                  setAddingWishlist(false)
                }}
                className="w-full py-2.5 rounded-xl bg-caramel text-white font-semibold text-sm disabled:opacity-40">
                {addingWishlist ? 'Adding...' : '+ Add to Wishlist'}
              </button>
            </div>

            {wishlistItems.length === 0 && (
              <div className="text-center py-10">
                <p className="text-3xl mb-2">☕</p>
                <p className="text-coffee-600 font-display">Your wishlist is empty</p>
                <p className="text-coffee-400 text-sm mt-1">Add drinks you want your friends to gift you</p>
              </div>
            )}

            <div className="space-y-2">
              {wishlistItems.map(item => (
                <div key={item.id} className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-cream-200">
                  <div className="w-10 h-10 rounded-xl bg-latte flex items-center justify-center flex-shrink-0">
                    <span className="text-xl">☕</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-coffee-800 font-semibold text-sm truncate">{item.drink_name}</p>
                    {item.shop_name && <p className="text-coffee-400 text-xs">{item.shop_name}</p>}
                  </div>
                  <button
                    onClick={async () => {
                      await supabase.from('wishlist').delete().eq('id', item.id)
                      setWishlistItems(prev => prev.filter(w => w.id !== item.id))
                    }}
                    className="text-coffee-300 hover:text-red-400 transition-colors flex-shrink-0 p-1">
                    <span className="text-lg">×</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="px-4 mt-4 space-y-3">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-cream-200">
              <div className="px-4 py-3 border-b border-cream-100">
                <p className="text-coffee-500 text-xs uppercase tracking-wider font-medium">Edit Profile</p>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-coffee-500 text-xs mb-1 block">Username</label>
                  <input value={editUsername} onChange={e => setEditUsername(e.target.value)}
                    className="w-full bg-cream-100 text-coffee-800 rounded-xl px-4 py-2.5 text-sm border border-cream-200 focus:border-caramel focus:outline-none" />
                </div>
                <div>
                  <label className="text-coffee-500 text-xs mb-1 block">Bio</label>
                  <textarea value={editBio} onChange={e => setEditBio(e.target.value)}
                    placeholder="Coffee lover based in..."
                    rows={2}
                    className="w-full bg-cream-100 text-coffee-800 rounded-xl px-4 py-2.5 text-sm border border-cream-200 focus:border-caramel focus:outline-none resize-none" />
                </div>
                <button onClick={saveProfile} disabled={savingProfile}
                  className="w-full py-2.5 rounded-xl bg-caramel text-white font-semibold text-sm disabled:opacity-50">
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-cream-200">
              {[
                { icon: Bell, label: 'Notifications', sub: 'Manage your alerts' },
                { icon: Lock, label: 'Privacy', sub: 'Control who sees your activity' },
                { icon: HelpCircle, label: 'Help & Support', sub: 'FAQs and contact' },
              ].map(({ icon: Icon, label, sub }) => (
                <button key={label} className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-cream-100 last:border-0 hover:bg-cream-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center flex-shrink-0">
                    <Icon size={15} className="text-coffee-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-coffee-800 text-sm font-medium">{label}</p>
                    <p className="text-coffee-400 text-xs">{sub}</p>
                  </div>
                  <ChevronRight size={16} className="text-coffee-300" />
                </button>
              ))}
            </div>

            <button onClick={signOut}
              className="w-full bg-white border border-red-100 text-red-500 rounded-2xl py-3.5 text-sm font-semibold shadow-sm flex items-center justify-center gap-2">
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        )}

        {/* FIND FRIENDS TAB */}
        {activeTab === 'friends' && (
          <div className="px-4 mt-4">
            <div className="flex items-center bg-white rounded-xl px-4 py-3 border border-cream-200 shadow-sm mb-4">
              <Search size={15} className="text-coffee-400 mr-2.5" />
              <input value={friendSearch} onChange={e => searchFriends(e.target.value)}
                placeholder="Search by username..."
                className="flex-1 bg-transparent text-coffee-800 text-sm placeholder-coffee-300 focus:outline-none" />
              {searching && <div className="w-4 h-4 rounded-full border-2 border-caramel border-t-transparent animate-spin" />}
            </div>
            {friendSearch.length < 2 && (
              <div className="text-center py-10">
                <p className="text-4xl mb-2">👥</p>
                <p className="text-coffee-600 font-display">Find your coffee crew</p>
                <p className="text-coffee-400 text-sm mt-1">Search by username</p>
              </div>
            )}
            <div className="space-y-2">
              {searchResults.map(user => <UserCard key={user.id} user={user} />)}
            </div>
          </div>
        )}

        {/* FOLLOWING TAB */}
        {activeTab === 'following' && (
          <div className="px-4 mt-4">
            <div className="mb-4">
              <p className="text-coffee-500 text-xs uppercase tracking-wider font-medium mb-2">
                Followers ({followerCount})
              </p>
              {followerList.length === 0
                ? <p className="text-coffee-400 text-sm text-center py-4">No followers yet</p>
                : <div className="space-y-2">{followerList.map(u => <UserCard key={u.id} user={u} />)}</div>
              }
            </div>
            <div>
              <p className="text-coffee-500 text-xs uppercase tracking-wider font-medium mb-2">
                Following ({followingList.length})
              </p>
              {followingList.length === 0
                ? <div className="text-center py-6">
                    <p className="text-coffee-400 text-sm">Not following anyone yet</p>
                    <button onClick={() => setActiveTab('friends')} className="text-caramel text-sm underline mt-2">Find friends →</button>
                  </div>
                : <div className="space-y-2">{followingList.map(u => <UserCard key={u.id} user={u} />)}</div>
              }
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <>
            {/* Profile card */}
            <div className="mx-4 mt-4 bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
              <div className="flex flex-col items-center">
                {/* Avatar */}
                <div className="relative mb-3">
                  <div className="w-20 h-20 rounded-full overflow-hidden bg-coffee-200 border-4 border-cream-100 shadow">
                    {profile.avatar_url
                      ? <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" key={profile.avatar_url} />
                      : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500">
                          <span className="text-white font-display text-3xl font-bold">{profile.username[0].toUpperCase()}</span>
                        </div>
                    }
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                        <div className="w-6 h-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 w-7 h-7 bg-caramel rounded-full flex items-center justify-center shadow border-2 border-white">
                    <Camera size={12} className="text-white" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                    style={{ display: 'none' }}
                  />
                </div>

                <h2 className="text-coffee-800 font-display text-xl font-bold">{profile.username}</h2>
                {(profile as any).bio && <p className="text-coffee-400 text-sm mt-1 text-center">{(profile as any).bio}</p>}

                {/* Badge */}
                <div className="mt-3 flex items-center gap-2 bg-cream-100 rounded-full px-4 py-1.5 border border-cream-200">
                  <span className="text-lg">{badgeInfo.current.emoji}</span>
                  <span className="font-semibold text-sm" style={{ color: badgeInfo.current.color }}>{badgeInfo.current.label}</span>
                </div>

                {/* Progress bar to next badge */}
                {badgeInfo.next !== badgeInfo.current && (
                  <div className="w-full mt-4 px-2">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-coffee-400 text-xs">{badgeInfo.current.label}</span>
                      <span className="text-coffee-400 text-xs">{badgeInfo.next.emoji} {badgeInfo.next.label}</span>
                    </div>
                    <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${badgeInfo.progress}%`, background: `linear-gradient(90deg, ${badgeInfo.current.color}, ${badgeInfo.next.color})` }} />
                    </div>
                    <p className="text-coffee-400 text-xs mt-1.5 text-center">
                      {ratings.length}/{badgeInfo.next.minRatings} ratings · {badgeInfo.next.minRatings - ratings.length} more to {badgeInfo.next.label}
                    </p>
                  </div>
                )}
                {badgeInfo.next === badgeInfo.current && (
                  <p className="text-caramel text-xs mt-2">🎉 Max level achieved!</p>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-cream-100">
                <div className="text-center">
                  <p className="text-coffee-800 font-bold text-lg">{ratings.length}</p>
                  <p className="text-coffee-400 text-xs">Sips</p>
                </div>
                <div className="text-center border-x border-cream-200">
                  <p className="text-coffee-800 font-bold text-lg">{visitedShops.length}</p>
                  <p className="text-coffee-400 text-xs">Shops</p>
                </div>
                <div className="text-center">
                  <p className="text-coffee-800 font-bold text-lg">{followerCount}</p>
                  <p className="text-coffee-400 text-xs">Followers</p>
                </div>
              </div>
            </div>

            {/* Avg satisfaction */}
            {ratings.length > 0 && (
              <div className="mx-4 mt-3 bg-white rounded-2xl p-4 shadow-sm border border-cream-200 flex items-center gap-4">
                <div className="w-14 h-14 flex-shrink-0">
                  <svg viewBox="0 0 56 56" width="56" height="56">
                    <defs><clipPath id="mm"><rect x="6" y="10" width="44" height="42" rx="6" /></clipPath></defs>
                    <rect x="6" y="10" width="44" height="42" rx="6" fill="#f7f0e4" stroke="#b8935a" strokeWidth="1.5" />
                    <g clipPath="url(#mm)">
                      <rect x="6" y={52-(42*avgFill/100)} width="44" height={42*avgFill/100}
                        fill={avgFill>70?'#7a3f15':avgFill>40?'#b8793a':'#8ca8c5'} />
                    </g>
                    <path d="M50 20 Q60 20 60 31 Q60 42 50 42" stroke="#b8935a" strokeWidth="4" fill="none" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-coffee-400 text-xs uppercase tracking-wider">Avg Satisfaction</p>
                  <p className="text-coffee-800 font-display font-bold text-xl">{avgFill}% Full</p>
                  <p className="text-coffee-400 text-xs">{ratings.length} visit{ratings.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
            )}

            {/* Section toggle */}
            <div className="mx-4 mt-4 flex bg-white rounded-xl p-1 border border-cream-200 shadow-sm">
              <button onClick={() => setActiveSection('sips')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${activeSection === 'sips' ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'}`}>
                <Coffee size={14} /> Coffee Sips
              </button>
              <button onClick={() => setActiveSection('map')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${activeSection === 'map' ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'}`}>
                <MapPin size={14} /> Coffee Map
              </button>
            </div>

            {/* Sips */}
            {activeSection === 'sips' && (
              <div className="px-4 mt-3">
                {loading && <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}
                {!loading && ratings.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-4xl mb-2">☕</p>
                    <p className="text-coffee-600 font-display">Your journey in cups</p>
                    <p className="text-coffee-400 text-sm mt-1">Rate a visit to start your collection</p>
                  </div>
                )}
                <div className="space-y-2">
                  {ratings.map(rating => {
                    const shop = rating.coffee_shops as any
                    return (
                      <div key={rating.id} className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-cream-200">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-coffee-200 flex-shrink-0">
                          {shop?.photo_url && <img src={shop.photo_url} alt={shop.name} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-coffee-800 font-semibold text-sm truncate">{shop?.name ?? 'Moment'}</p>
                          {rating.drink_name && <p className="text-coffee-400 text-xs">{rating.drink_name}</p>}
                          {rating.caption && <p className="text-coffee-400 text-xs truncate">{rating.caption}</p>}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-coffee-800 font-bold text-sm">{rating.fill_level}%</p>
                          <div className="w-10 h-1.5 bg-cream-200 rounded-full overflow-hidden mt-1">
                            <div className="h-full rounded-full bg-caramel" style={{ width: `${rating.fill_level}%` }} />
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
                {!loading && visitedShops.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-4xl mb-2">🗺️</p>
                    <p className="text-coffee-600 font-display">Your coffee map awaits</p>
                    <p className="text-coffee-400 text-sm mt-1">Every shop you rate gets pinned here</p>
                  </div>
                )}
                {visitedShops.length > 0 && (
                  <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-cream-200 mb-3">
                    <Suspense fallback={<div className="h-72 flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}>
                      <CoffeeMap visits={visitedShops as any} />
                    </Suspense>
                    <div className="px-4 py-2.5 border-t border-cream-100">
                      <p className="text-coffee-400 text-xs">{visitedShops.length} shop{visitedShops.length !== 1 ? 's' : ''} visited · tap a pin for details</p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {visitedShops.map(visit => {
                    const shop = visit.coffee_shops
                    return (
                      <div key={visit.shop_id} className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-cream-200">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-coffee-200 flex-shrink-0">
                          {shop?.photo_url && <img src={shop.photo_url} alt={shop.name} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-coffee-800 font-semibold text-sm truncate">{shop?.name}</p>
                          <p className="text-coffee-400 text-xs">{shop?.city}, {shop?.state}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-coffee-800 font-bold text-sm">{visit.visit_count}x</p>
                          <p className="text-coffee-400 text-xs">visited</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
