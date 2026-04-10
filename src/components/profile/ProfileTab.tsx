import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Settings, MapPin, LogOut, Coffee, Camera, X, Check, ArrowLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import BadgeCelebration from '../shared/BadgeCelebration'

const CoffeeMap = lazy(() => import('./CoffeeMap'))

function getBadgeInfo(count: number) {
  const tiers = [
    { label: 'Coffee Curious', emoji: '🌱', color: '#7aaa6a', min: 0 },
    { label: 'Coffee Lover', emoji: '☕', color: '#c8853a', min: 3 },
    { label: 'Regular', emoji: '⭐', color: '#d4a017', min: 10 },
    { label: 'Enthusiast', emoji: '🔥', color: '#e06030', min: 25 },
    { label: 'Connoisseur', emoji: '🏆', color: '#9b59b6', min: 50 },
    { label: 'Brew Master', emoji: '👑', color: '#c0392b', min: 100 },
  ]
  let current = tiers[0], next = tiers[1]
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (count >= tiers[i].min) { current = tiers[i]; next = tiers[Math.min(i + 1, tiers.length - 1)]; break }
  }
  const progress = next === current ? 100 : Math.round(((count - current.min) / (next.min - current.min)) * 100)
  return { current, next, progress }
}

// ── FOLLOWERS MODAL ─────────────────────────────────────
function FollowersModal({ userId, type, onClose }: { userId: string; type: 'followers' | 'following'; onClose: () => void }) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    async function load() {
      if (type === 'followers') {
        const { data } = await supabase.from('follows')
          .select('follower_id, profiles!follows_follower_id_fkey(id,username,full_name,avatar_url,badge)')
          .eq('following_id', userId)
        setUsers((data || []).map((d: any) => d.profiles).filter(Boolean))
      } else {
        const { data } = await supabase.from('follows')
          .select('following_id, profiles!follows_following_id_fkey(id,username,full_name,avatar_url,badge)')
          .eq('follower_id', userId)
        setUsers((data || []).map((d: any) => d.profiles).filter(Boolean))
      }
      setLoading(false)
    }
    load()
  }, [userId, type])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.8)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up flex flex-col" style={{ maxHeight: '70vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <h3 className="font-display font-bold text-coffee-800 text-lg capitalize">{type}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}
          {!loading && users.length === 0 && <div className="text-center py-10"><p className="text-coffee-400">No {type} yet</p></div>}
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-cream-100">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white font-bold text-sm">{u.username?.[0]?.toUpperCase()}</span></div>}
              </div>
              <div>
                <p className="text-coffee-800 font-semibold text-sm">{u.username}</p>
                <p className="text-coffee-400 text-xs">{u.badge || 'Coffee Curious'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── VISITED SHOPS MODAL ──────────────────────────────────
function VisitedShopsModal({ visits, onClose }: { visits: any[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.8)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up flex flex-col" style={{ maxHeight: '70vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <h3 className="font-display font-bold text-coffee-800 text-lg">Shops Visited</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {visits.length === 0 && <div className="text-center py-10"><p className="text-coffee-400">No shops visited yet</p></div>}
          {visits.map(v => {
            const shop = v.coffee_shops
            return (
              <div key={v.shop_id} className="flex items-center gap-3 px-5 py-3.5 border-b border-cream-100">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-coffee-200 flex-shrink-0">
                  {shop?.photo_url && <img src={shop.photo_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-coffee-800 font-semibold text-sm truncate">{shop?.name}</p>
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
      </div>
    </div>
  )
}

// ── SETTINGS MODAL ───────────────────────────────────────
function SettingsModal({ onClose }: { onClose: () => void }) {
  const { profile, signOut, refreshProfile } = useAuth()
  const [username, setUsername] = useState(profile?.username || '')
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [isPrivate, setIsPrivate] = useState(profile?.is_private || false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function saveSettings() {
    if (!profile || saving) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({
      username: username.trim(),
      full_name: fullName.trim() || null,
      bio: bio.trim() || null,
      is_private: isPrivate,
    }).eq('id', profile.id)
    if (!error) { await refreshProfile(); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    setSaving(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !profile) return
    const file = e.target.files[0]
    if (!file.type.startsWith('image/')) { alert('Please select an image'); return }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return }
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `avatars/${profile.id}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const { error: updErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id)
      if (updErr) throw updErr
      await refreshProfile()
    } catch (err: any) { alert(`Upload failed: ${err.message}`) }
    setUploadingAvatar(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-cream-100 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-cream-200 bg-white">
        <button onClick={onClose} className="text-coffee-500"><ArrowLeft size={22} /></button>
        <h2 className="font-display text-xl font-bold text-coffee-800 flex-1">Settings</h2>
        <button onClick={saveSettings} disabled={saving}
          className="flex items-center gap-1.5 bg-caramel text-white px-4 py-1.5 rounded-full text-sm font-semibold disabled:opacity-40">
          {saved ? <><Check size={14} /> Saved</> : saving ? 'Saving...' : 'Save'}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Avatar */}
        <div className="bg-white mx-4 mt-4 rounded-2xl p-5 border border-cream-200 shadow-sm">
          <p className="text-coffee-600 font-semibold text-sm mb-3">Profile Photo</p>
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-coffee-200 border-4 border-cream-100 shadow">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500"><span className="text-white font-bold text-3xl">{profile?.username?.[0]?.toUpperCase()}</span></div>}
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                    <div className="w-6 h-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  </div>
                )}
              </div>
              <button onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-7 h-7 bg-caramel rounded-full flex items-center justify-center shadow border-2 border-white">
                <Camera size={12} className="text-white" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </div>
            <div>
              <p className="text-coffee-700 font-semibold text-sm">{profile?.username}</p>
              <button onClick={() => fileInputRef.current?.click()} className="text-caramel text-sm mt-1 font-medium">Change photo</button>
            </div>
          </div>
        </div>
        {/* Profile info */}
        <div className="bg-white mx-4 mt-3 rounded-2xl p-5 border border-cream-200 shadow-sm space-y-4">
          <p className="text-coffee-600 font-semibold text-sm">Profile Info</p>
          <div>
            <label className="text-coffee-500 text-xs font-medium block mb-1">Username</label>
            <input value={username} onChange={e => setUsername(e.target.value)}
              className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none" />
          </div>
          <div>
            <label className="text-coffee-500 text-xs font-medium block mb-1">Full Name</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Optional"
              className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300" />
          </div>
          <div>
            <label className="text-coffee-500 text-xs font-medium block mb-1">Bio</label>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Tell your coffee story..."
              className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none resize-none placeholder-coffee-300" />
          </div>
        </div>
        {/* Privacy */}
        <div className="bg-white mx-4 mt-3 rounded-2xl p-5 border border-cream-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-coffee-700 font-semibold text-sm">Private Account</p>
              <p className="text-coffee-400 text-xs mt-0.5">Only followers can see your posts</p>
            </div>
            <button onClick={() => setIsPrivate(!isPrivate)}
              className={`w-11 h-6 rounded-full transition-colors relative ${isPrivate ? 'bg-caramel' : 'bg-cream-300'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>
        {/* Account */}
        <div className="bg-white mx-4 mt-3 rounded-2xl border border-cream-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-cream-100">
            <p className="text-coffee-600 font-semibold text-sm">Account</p>
          </div>
          <div className="px-5 py-3 border-b border-cream-100">
            <p className="text-coffee-500 text-xs">Email</p>
            <p className="text-coffee-700 text-sm mt-0.5">{profile?.email_verified ? '✓ Verified' : 'Not verified'}</p>
          </div>
          <div className="px-5 py-3 border-b border-cream-100">
            <p className="text-coffee-500 text-xs">Role</p>
            <p className="text-coffee-700 text-sm mt-0.5 capitalize">{profile?.role || 'consumer'}</p>
          </div>
          <button onClick={signOut} className="w-full flex items-center gap-3 px-5 py-4 text-red-500 hover:bg-red-50 transition-colors">
            <LogOut size={18} />
            <span className="font-medium text-sm">Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProfileTab() {
  const { profile } = useAuth()
  const [ratings, setRatings] = useState<any[]>([])
  const [visitedShops, setVisitedShops] = useState<any[]>([])
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<'sips' | 'map'>('sips')
  const [showSettings, setShowSettings] = useState(false)
  const [celebrateBadge, setCelebrateBadge] = useState<any>(null)
  const [prevRatingCount, setPrevRatingCount] = useState(0)
  const [showFollowers, setShowFollowers] = useState<'followers' | 'following' | null>(null)
  const [showShops, setShowShops] = useState(false)

  useEffect(() => {
    if (!profile) return
    async function load() {
      const [ratingsRes, visitsRes, followersRes, followingRes] = await Promise.all([
        supabase.from('ratings').select('*, coffee_shops(*)').eq('user_id', profile!.id).order('created_at', { ascending: false }),
        supabase.from('user_shop_visits').select('*, coffee_shops(id,name,city,state,lat,lng,photo_url)').eq('user_id', profile!.id).order('visit_count', { ascending: false }),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile!.id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile!.id),
      ])
      const newCount = ratingsRes.data?.length || 0
      if (prevRatingCount > 0 && newCount > prevRatingCount) {
        const oldBadge = getBadgeInfo(prevRatingCount).current
        const newBadge = getBadgeInfo(newCount).current
        if (oldBadge.label !== newBadge.label) setCelebrateBadge(newBadge)
      }
      setPrevRatingCount(newCount)
      if (ratingsRes.data) setRatings(ratingsRes.data)
      if (visitsRes.data) setVisitedShops(visitsRes.data)
      setFollowerCount(followersRes.count ?? 0)
      setFollowingCount(followingRes.count ?? 0)
      setLoading(false)
    }
    load()
  }, [profile])

  if (!profile) return null
  const badgeInfo = getBadgeInfo(ratings.length)

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="sticky top-0 z-10 bg-cream-100/95 backdrop-blur-sm border-b border-cream-200 px-5 py-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-coffee-800">Profile</h1>
        <button onClick={() => setShowSettings(true)} className="w-9 h-9 flex items-center justify-center text-coffee-500 hover:text-caramel transition-colors">
          <Settings size={22} />
        </button>
      </div>

      <div className="pb-28">
        {/* Profile card */}
        <div className="mx-4 mt-4 bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-coffee-200 border-4 border-cream-100 shadow flex-shrink-0">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500"><span className="text-white font-display text-3xl font-bold">{profile.username[0].toUpperCase()}</span></div>}
              </div>
              <button onClick={() => setShowSettings(true)} className="absolute bottom-0 right-0 w-7 h-7 bg-caramel rounded-full flex items-center justify-center shadow border-2 border-white">
                <Camera size={12} className="text-white" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-coffee-800 font-display text-xl font-bold truncate">{profile.username}</h2>
              {profile.full_name && <p className="text-coffee-500 text-sm truncate">{profile.full_name}</p>}
              {profile.bio && <p className="text-coffee-400 text-xs mt-1 line-clamp-2">{profile.bio}</p>}
              <div className="flex items-center gap-1.5 mt-2 w-fit bg-cream-100 rounded-full px-3 py-1 border border-cream-200">
                <span>{badgeInfo.current.emoji}</span>
                <span className="text-sm font-semibold" style={{ color: badgeInfo.current.color }}>{badgeInfo.current.label}</span>
              </div>
            </div>
          </div>

          {/* Stats — clickable */}
          <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-cream-100">
            <div className="text-center">
              <p className="text-coffee-800 font-bold text-lg">{ratings.length}</p>
              <p className="text-coffee-400 text-xs">Sips</p>
            </div>
            <button onClick={() => setShowShops(true)} className="text-center hover:opacity-70 transition-opacity">
              <p className="text-coffee-800 font-bold text-lg">{visitedShops.length}</p>
              <p className="text-caramel text-xs font-medium flex items-center justify-center gap-0.5">Shops <ChevronRight size={10} /></p>
            </button>
            <button onClick={() => setShowFollowers('followers')} className="text-center hover:opacity-70 transition-opacity">
              <p className="text-coffee-800 font-bold text-lg">{followerCount}</p>
              <p className="text-caramel text-xs font-medium flex items-center justify-center gap-0.5">Followers <ChevronRight size={10} /></p>
            </button>
            <button onClick={() => setShowFollowers('following')} className="text-center hover:opacity-70 transition-opacity">
              <p className="text-coffee-800 font-bold text-lg">{followingCount}</p>
              <p className="text-caramel text-xs font-medium flex items-center justify-center gap-0.5">Following <ChevronRight size={10} /></p>
            </button>
          </div>

          {/* Badge progress */}
          {badgeInfo.next !== badgeInfo.current && (
            <div className="mt-4 pt-3 border-t border-cream-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-coffee-400 text-xs">{badgeInfo.current.label}</span>
                <span className="text-coffee-400 text-xs">{badgeInfo.next.emoji} {badgeInfo.next.label}</span>
              </div>
              <div className="h-1.5 bg-cream-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${badgeInfo.progress}%`, background: `linear-gradient(90deg, ${badgeInfo.current.color}, ${badgeInfo.next.color})` }} />
              </div>
              <p className="text-coffee-400 text-xs mt-1 text-right">{badgeInfo.progress}% to {badgeInfo.next.label}</p>
            </div>
          )}


        </div>

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
              <div className="text-center py-10"><p className="text-4xl mb-2">☕</p><p className="text-coffee-600 font-display">Your journey in cups</p><p className="text-coffee-400 text-sm mt-1">Rate a visit to start your collection</p></div>
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
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-coffee-800 font-bold text-sm">{rating.fill_level}%</p>
                      <div className="w-12 h-1.5 bg-cream-200 rounded-full overflow-hidden mt-1">
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
              <div className="text-center py-10"><p className="text-4xl mb-2">🗺️</p><p className="text-coffee-600 font-display">Your coffee map awaits</p><p className="text-coffee-400 text-sm mt-1">Every shop you rate gets pinned here</p></div>
            )}
            {visitedShops.length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-cream-200 mb-3">
                <Suspense fallback={<div className="h-72 flex items-center justify-center"><div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}>
                  <CoffeeMap visits={visitedShops as any} />
                </Suspense>
                <div className="px-4 py-2.5 border-t border-cream-100">
                  <p className="text-coffee-500 text-xs">{visitedShops.length} shop{visitedShops.length !== 1 ? 's' : ''} visited · tap a pin for details</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showFollowers && <FollowersModal userId={profile.id} type={showFollowers} onClose={() => setShowFollowers(null)} />}
      {showShops && <VisitedShopsModal visits={visitedShops} onClose={() => setShowShops(false)} />}
      {celebrateBadge && <BadgeCelebration badge={celebrateBadge} onClose={() => setCelebrateBadge(null)} />}
    </div>
  )
}
