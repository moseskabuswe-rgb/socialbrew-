import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Settings, MapPin, LogOut, Coffee, Camera, X, Check, ArrowLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { getBadge, TIER_LABELS } from '../../lib/badges'
import BadgeExplainerModal from '../shared/BadgeExplainerModal'
import { notifyFollow, unregisterPushNotifications } from '../../lib/push'
import BadgeCelebration from '../shared/BadgeCelebration'
import UserProfilePage from '../shared/UserProfilePage'
import AvatarCropper from '../shared/AvatarCropper'
import VerifiedBadge from '../shared/VerifiedBadge'
import PostDetailModal from '../shared/PostDetailModal'
import ShopDetailPage from '../shared/ShopDetailPage'
import BrewWrapped from '../shared/BrewWrapped'
import PunchCardRedemption from '../shops/PunchCardRedemption'
import QRScannerModal from '../shared/QRScannerModal'
import PrivacyPolicyPage from '../shared/PrivacyPolicyPage'
import TermsPage from '../shared/TermsPage'
import { compressAvatar } from '../../lib/compressImage'
import { cachedUrl } from '../../lib/storageUrl'
import ConversationView from '../messaging/ConversationView'
const CoffeeMap = lazy(() => import('./CoffeeMap'))
// getBadgeInfo replaced by getBadge from badges.ts
// ── FOLLOWERS MODAL ─────────────────────────────────────
function FollowersModal({ userId, type, onClose }: { userId: string; type: 'followers' | 'following'; onClose: () => void }) {
  const { profile: me } = useAuth()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingProfile, setViewingProfile] = useState<any>(null)
  const [following, setFollowing] = useState<Set<string>>(new Set())
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
    if (me) {
      supabase.from('follows').select('following_id').eq('follower_id', me.id)
        .then(({ data }) => { if (data) setFollowing(new Set(data.map((f: any) => f.following_id))) })
    }
  }, [userId, type, me])
  async function toggleFollow(targetId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!me || targetId === me.id) return
    if (following.has(targetId)) {
      await supabase.from('follows').delete().eq('follower_id', me.id).eq('following_id', targetId)
      setFollowing(prev => { const n = new Set(prev); n.delete(targetId); return n })
    } else {
      await supabase.from('follows').insert({ follower_id: me.id, following_id: targetId, status: 'pending' })
      await supabase.from('notifications').insert({ user_id: targetId, actor_id: me.id, type: 'follow_request' })
      notifyFollow(targetId, me.username || 'Someone', me.id)
      setFollowing(prev => new Set([...prev, targetId]))
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.8)'}}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up flex flex-col" style={{ maxHeight: '70vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <h3 className="font-display font-bold text-coffee-800 text-lg capitalize">{type}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500"><X size={15} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}
          {!loading && users.length === 0 && <div className="text-center py-10"><p className="text-coffee-400">No {type} yet</p></div>}
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-cream-100 bg-white">
              <button onClick={() => setViewingProfile(u)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                  {u.avatar_url ? <img src={cachedUrl(u.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)', willChange: 'transform' }} />
                    : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white font-bold text-sm">{u.username?.[0]?.toUpperCase()}</span></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-coffee-800 font-semibold text-sm">{u.username}</p>
                  <p className="text-coffee-400 text-xs">{u.badge || 'Coffee Curious'}</p>
                </div>
              </button>
              {me?.id !== u.id && (
                <button
                  onClick={e => toggleFollow(u.id, e)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    following.has(u.id)
                      ? 'bg-cream-100 text-coffee-600 border border-cream-300'
                      : 'bg-caramel text-white'
                  }`}>
                  {following.has(u.id) ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {viewingProfile && (
        <div className="fixed inset-0 z-[70] bg-cream-100 overflow-y-auto">
          <UserProfilePage userId={viewingProfile.id} onBack={() => setViewingProfile(null)} />
        </div>
      )}
    </div>
  )
}
// ── VISITED SHOPS MODAL ──────────────────────────────────
function VisitedShopsModal({ visits, onClose, onShopClick }: { visits: any[]; onClose: () => void; onShopClick: (shop: any) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.8)'}}>
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
              <button key={v.shop_id} onClick={() => { onClose(); onShopClick(shop) }} className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-cream-100 hover:bg-cream-50 transition-colors text-left">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-coffee-200 flex-shrink-0">
                  {shop?.photo_url && <img src={cachedUrl(shop.photo_url)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)', willChange: 'transform' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-coffee-800 font-semibold text-sm truncate">{shop?.name}</p>
                  <p className="text-coffee-400 text-xs">{shop?.city}, {shop?.state}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-caramel font-bold text-sm">{v.visit_count}x</p>
                  <p className="text-coffee-400 text-xs">visited</p>
                  <span className="text-coffee-300 text-xs">→</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
// ── SETTINGS MODAL ───────────────────────────────────────
function SettingsModal({ onClose, onShowPrivacy, onShowTerms }: { onClose: () => void; onShowPrivacy: () => void; onShowTerms: () => void }) {
  const { profile, signOut, refreshProfile } = useAuth()
  const [username, setUsername] = useState(profile?.username || '')
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [isPrivate, setIsPrivate] = useState(profile?.is_private || false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarKey, setAvatarKey] = useState(0) // increments to bust img cache
  const [cropFile, setCropFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState('')
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [changingEmail, setChangingEmail] = useState(false)
  const [emailMsg, setEmailMsg] = useState('')
  const [showBlockedUsers, setShowBlockedUsers] = useState(false)
  const [blockedProfiles, setBlockedProfiles] = useState<any[]>([])
  const [loadingBlocked, setLoadingBlocked] = useState(false)
  const [unblockingId, setUnblockingId] = useState<string | null>(null)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [homeCity, setHomeCity] = useState(() => localStorage.getItem('sb_home_city') || '')
  const [pushEnabled, setPushEnabled] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  )
  const [togglingPush, setTogglingPush] = useState(false)
  const [showSupportDM, setShowSupportDM] = useState(false)
  const [supportConversation, setSupportConversation] = useState<any>(null)
  const [openingDM, setOpeningDM] = useState(false)
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
    if (!e.target.files?.[0] || !profile) {
        return
    }
    const file = e.target.files[0]
    if (!file.type.startsWith('image/')) { alert('Please select an image'); return }
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return }
    setCropFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function uploadBlob(blob: Blob) {
    if (!profile) return
    setUploadingAvatar(true)
    try {
      // Compress avatar before upload (400px, saves significant egress)
      const compressed = await compressAvatar(blob)
      // Method 1: Try Supabase Storage
      const path = `avatars/${profile.id}-${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, compressed, {
        upsert: true,
        contentType: 'image/jpeg',
        cacheControl: '3600',
      })

      if (!upErr) {
        // Storage worked — use the public URL
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        const avatarUrl = `${publicUrl}?t=${Date.now()}`
        const { error: updErr } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', profile.id)
        if (updErr) throw new Error(`Profile update failed: ${updErr.message}`)
      } else {
        // Method 2: Storage failed — convert to base64 and store directly in profiles
        console.warn('Storage upload failed, using base64 fallback:', upErr.message)
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        const { error: updErr } = await supabase.from('profiles').update({ avatar_url: base64 }).eq('id', profile.id)
        if (updErr) throw new Error(`Profile update failed: ${updErr.message}`)
      }

      await refreshProfile()
      setAvatarKey(k => k + 1) // force img element to re-render
    } catch (err: any) {
      console.error('Avatar upload error:', err)
      alert(`Could not update photo: ${err.message}`)
    }
    setUploadingAvatar(false)
  }
  async function handleCroppedAvatar(blob: Blob) {
    setCropFile(null)
    await uploadBlob(blob)
  }
  async function handleChangePassword() {
    if (!newPassword || newPassword.length < 6) { setPasswordMsg('Password must be at least 6 characters'); return }
    setChangingPassword(true)
    setPasswordMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setPasswordMsg(error.message)
    else {
      setPasswordMsg('Password updated!')
      setNewPassword('')
      setTimeout(() => { setShowChangePassword(false); setPasswordMsg('') }, 1500)
    }
    setChangingPassword(false)
  }
  async function handleChangeEmail() {
    if (!newEmail.trim() || !newEmail.includes('@')) { setEmailMsg('Please enter a valid email'); return }
    setChangingEmail(true)
    setEmailMsg('')
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim().toLowerCase() })
    if (error) setEmailMsg(error.message)
    else {
      setEmailMsg('Confirmation sent to your new email!')
      setTimeout(() => { setShowChangeEmail(false); setEmailMsg(''); setNewEmail('') }, 2000)
    }
    setChangingEmail(false)
  }
  async function loadBlockedUsers() {
    if (!profile) return
    setLoadingBlocked(true)
    const { data: blockRows } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', profile.id)
    if (blockRows && blockRows.length > 0) {
      const ids = blockRows.map((b: any) => b.blocked_id)
      const { data: users } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids)
      setBlockedProfiles(users || [])
    } else {
      setBlockedProfiles([])
    }
    setLoadingBlocked(false)
  }
  async function handleDeleteAccount() {
    if (!profile || deleteConfirmText !== 'DELETE') return
    setDeletingAccount(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://pifpkfuulfnweeiqufbq.supabase.co'}/functions/v1/delete-account`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (!res.ok) throw new Error('Deletion failed')
      await signOut()
    } catch {
      alert('Could not delete account. Please try again or contact support.')
    }
    setDeletingAccount(false)
  }

  async function handleUnblock(blockedId: string) {
    if (!profile) return
    setUnblockingId(blockedId)
    await supabase.from('blocks').delete().eq('blocker_id', profile.id).eq('blocked_id', blockedId)
    setBlockedProfiles(prev => prev.filter(u => u.id !== blockedId))
    setUnblockingId(null)
  }
  async function handleOpenSupportDM() {
    if (!profile || openingDM) return
    setOpeningDM(true)
    try {
      const { data: support } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .eq('username', 'moses.kabuswe')
        .maybeSingle()
      if (!support) { setOpeningDM(false); return }

      const { data: myMemberships } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', profile.id)
      const myConvIds = (myMemberships || []).map((c: any) => c.conversation_id)

      let conversationId: string | null = null
      if (myConvIds.length > 0) {
        const { data: shared } = await supabase
          .from('conversation_members')
          .select('conversation_id,conversations!inner(type)')
          .eq('user_id', support.id)
          .in('conversation_id', myConvIds)
        const dm = (shared as any)?.find((c: any) => (c.conversations as any)?.type === 'dm')
        if (dm) conversationId = dm.conversation_id
      }

      if (!conversationId) {
        const { data: conv } = await supabase
          .from('conversations')
          .insert({ type: 'dm', name: null, created_by: profile.id })
          .select('id')
          .single()
        if (!conv) { setOpeningDM(false); return }
        await supabase.from('conversation_members').insert([
          { conversation_id: conv.id, user_id: profile.id },
          { conversation_id: conv.id, user_id: support.id },
        ])
        conversationId = conv.id
      }

      setSupportConversation({
        id: conversationId,
        type: 'dm',
        name: null,
        photo_url: null,
        created_by: profile.id,
        other_username: support.username,
        other_avatar: support.avatar_url,
      })
      setShowSupportDM(true)
    } catch {}
    setOpeningDM(false)
  }
  async function handleTogglePush() {
    if (!profile) return
    if (pushEnabled) {
      setTogglingPush(true)
      await unregisterPushNotifications(profile.id)
      setPushEnabled(false)
      setTogglingPush(false)
    } else {
      window.location.href = `/enable-notifications.html?uid=${encodeURIComponent(profile.id)}`
    }
  }
  return (
    <>
      {cropFile && (
        <div className="fixed inset-0 z-[200]">
          <AvatarCropper
            imageFile={cropFile}
            onCrop={handleCroppedAvatar}
            onCancel={() => setCropFile(null)}
          />
        </div>
      )}
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
                <div className="w-20 h-20 rounded-full overflow-hidden bg-coffee-200" style={{ border: '1px solid rgba(200,180,150,0.3)' }}>
                  {profile?.avatar_url
                    ? <img key={avatarKey} src={cachedUrl(profile.avatar_url ? `${profile.avatar_url.split("?")[0]}?cb=${avatarKey}` : "")} alt="" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)', willChange: 'transform' }} />
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
            <div>
              <label className="text-coffee-500 text-xs font-medium block mb-1">Home City</label>
              <input
                value={homeCity}
                onChange={e => { setHomeCity(e.target.value); localStorage.setItem('sb_home_city', e.target.value) }}
                placeholder="e.g. London, New York…"
                className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300"
              />
              <p className="text-coffee-400 text-xs mt-1">Used to personalise your discover feed</p>
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
            <div className="px-5 py-3.5 border-b border-cream-100 flex items-center justify-between">
              <div>
                <p className="text-coffee-700 text-sm font-medium">Push Notifications</p>
                <p className="text-coffee-400 text-xs mt-0.5">
                  {typeof Notification !== 'undefined' && Notification.permission === 'denied'
                    ? 'Blocked by browser — enable in device settings'
                    : pushEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              {(typeof Notification === 'undefined' || Notification.permission !== 'denied') && (
                <button
                  onClick={handleTogglePush}
                  disabled={togglingPush}
                  className={`w-11 h-6 rounded-full transition-colors relative disabled:opacity-40 ${pushEnabled ? 'bg-caramel' : 'bg-cream-300'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${pushEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              )}
            </div>
            <div className="px-5 py-3 border-b border-cream-100">
              <button
                onClick={() => setShowChangePassword(!showChangePassword)}
                className="w-full flex items-center justify-between"
              >
                <p className="text-coffee-700 text-sm font-medium">Change Password</p>
                <ChevronRight size={16} className={`text-coffee-400 transition-transform ${showChangePassword ? 'rotate-90' : ''}`} />
              </button>
              {showChangePassword && (
                <div className="mt-3 space-y-2">
                  <input
                    type="password"
                    placeholder="New password (min 6 chars)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-2.5 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300"
                  />
                  {passwordMsg && (
                    <p className={`text-xs ${passwordMsg.includes('updated') ? 'text-green-600' : 'text-red-500'}`}>
                      {passwordMsg}
                    </p>
                  )}
                  <button
                    onClick={handleChangePassword}
                    disabled={changingPassword}
                    className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
                  >
                    {changingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-b border-cream-100">
              <button
                onClick={() => setShowChangeEmail(!showChangeEmail)}
                className="w-full flex items-center justify-between"
              >
                <p className="text-coffee-700 text-sm font-medium">Change Email</p>
                <ChevronRight size={16} className={`text-coffee-400 transition-transform ${showChangeEmail ? 'rotate-90' : ''}`} />
              </button>
              {showChangeEmail && (
                <div className="mt-3 space-y-2">
                  <input
                    type="email"
                    placeholder="New email address"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-2.5 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300"
                  />
                  {emailMsg && (
                    <p className={`text-xs ${emailMsg.includes('sent') ? 'text-green-600' : 'text-red-500'}`}>
                      {emailMsg}
                    </p>
                  )}
                  <button
                    onClick={handleChangeEmail}
                    disabled={changingEmail}
                    className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
                  >
                    {changingEmail ? 'Sending...' : 'Update Email'}
                  </button>
                  <p className="text-coffee-400 text-xs">A confirmation link will be sent to your new email</p>
                </div>
              )}
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
          {/* Privacy & Legal */}
          <div className="bg-white mx-4 mt-3 rounded-2xl border border-cream-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-cream-100">
              <p className="text-coffee-600 font-semibold text-sm">Legal</p>
            </div>
            <button onClick={onShowPrivacy} className="w-full flex items-center justify-between px-5 py-3 border-b border-cream-100">
              <p className="text-coffee-700 text-sm font-medium">Privacy Policy</p>
              <ChevronRight size={16} className="text-coffee-400" />
            </button>
            <button onClick={onShowTerms} className="w-full flex items-center justify-between px-5 py-3">
              <p className="text-coffee-700 text-sm font-medium">Terms of Service</p>
              <ChevronRight size={16} className="text-coffee-400" />
            </button>
          </div>
          {/* Feedback & Support */}
          <div className="bg-white mx-4 mt-3 rounded-2xl border border-cream-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-cream-100">
              <p className="text-coffee-600 font-semibold text-sm">Feedback & Support</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-coffee-400 text-xs mb-3">Have a question, found a bug, or want to share feedback? Message us directly.</p>
              <button
                onClick={handleOpenSupportDM}
                disabled={openingDM}
                className="w-full py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
              >
                {openingDM ? 'Opening...' : '💬 Message Us'}
              </button>
            </div>
          </div>
          {/* Delete Account */}
          <div className="bg-white mx-4 mt-3 rounded-2xl border border-red-100 shadow-sm overflow-hidden mb-4">
            <button
              onClick={() => setShowDeleteAccount(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4"
            >
              <p className="text-red-600 font-semibold text-sm">Delete Account</p>
              <ChevronRight size={16} className={`text-red-400 transition-transform ${showDeleteAccount ? 'rotate-90' : ''}`} />
            </button>
            {showDeleteAccount && (
              <div className="px-5 pb-5 border-t border-red-50 space-y-3">
                <p className="text-coffee-500 text-xs pt-3">This permanently deletes your account, all your brews, ratings, and data. This cannot be undone.</p>
                <p className="text-coffee-600 text-xs font-medium">Type <span className="font-bold text-red-600">DELETE</span> to confirm:</p>
                <input
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-red-50 text-red-800 rounded-xl px-4 py-2.5 text-sm border border-red-200 focus:border-red-400 focus:outline-none placeholder-red-300 font-mono"
                />
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== 'DELETE' || deletingAccount}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white bg-red-500 disabled:opacity-30"
                >
                  {deletingAccount ? 'Deleting...' : 'Permanently Delete My Account'}
                </button>
              </div>
            )}
          </div>
          {/* Blocked Users */}
          <div className="bg-white mx-4 mt-3 rounded-2xl border border-cream-200 shadow-sm overflow-hidden">
            <button
              onClick={() => { setShowBlockedUsers(v => !v); if (!showBlockedUsers) loadBlockedUsers() }}
              className="w-full flex items-center justify-between px-5 py-4"
            >
              <p className="text-coffee-700 font-semibold text-sm">Blocked Users</p>
              <ChevronRight size={16} className={`text-coffee-400 transition-transform ${showBlockedUsers ? 'rotate-90' : ''}`} />
            </button>
            {showBlockedUsers && (
              <div className="border-t border-cream-100">
                {loadingBlocked && (
                  <div className="flex justify-center py-4">
                    <div className="w-4 h-4 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
                  </div>
                )}
                {!loadingBlocked && blockedProfiles.length === 0 && (
                  <p className="text-coffee-400 text-sm text-center py-4 px-5">No blocked users</p>
                )}
                {blockedProfiles.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-5 py-3 border-t border-cream-100">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                      {u.avatar_url
                        ? <img src={cachedUrl(u.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white text-xs font-bold">{u.username?.[0]?.toUpperCase()}</span></div>}
                    </div>
                    <p className="text-coffee-700 text-sm flex-1 font-medium">{u.username}</p>
                    <button
                      onClick={() => handleUnblock(u.id)}
                      disabled={unblockingId === u.id}
                      className="text-xs text-caramel font-semibold disabled:opacity-40 px-3 py-1.5 rounded-full border border-caramel"
                    >
                      {unblockingId === u.id ? '...' : 'Unblock'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {showSupportDM && supportConversation && profile && (
        <div className="fixed inset-0 z-[200]">
          <ConversationView
            conversation={supportConversation}
            currentUserId={profile.id}
            onBack={() => { setShowSupportDM(false); setSupportConversation(null) }}
          />
        </div>
      )}
    </>
  )
}
export default function ProfileTab({ onNavigateToBrew }: { onNavigateToBrew?: (shop?: any) => void }) {
  const { profile } = useAuth()
  const [ratings, setRatings] = useState<any[]>([])
  const [ratingsPage, setRatingsPage] = useState(0)
  const [ratingsHasMore, setRatingsHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const RATINGS_PER_PAGE = 50
  const [visitedShops, setVisitedShops] = useState<any[]>([])
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [wishlist, setWishlist] = useState<any[]>([])
  const [activeSection, setActiveSection] = useState<'sips' | 'map' | 'wishlist' | 'cards'>('sips')
  const [showSettings, setShowSettings] = useState(false)
  const [showPrivacyPage, setShowPrivacyPage] = useState(false)
  const [showTermsPage, setShowTermsPage] = useState(false)
  const [celebrateBadge, setCelebrateBadge] = useState<any>(null)
  const [explorationStats, setExplorationStats] = useState<any>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [showBadgeExplainer, setShowBadgeExplainer] = useState(false)
  const [showStreakExplainer, setShowStreakExplainer] = useState(false)
  const [showFollowers, setShowFollowers] = useState<'followers' | 'following' | null>(null)
  const [showShops, setShowShops] = useState(false)
  const [viewingUserId, setViewingUserId] = useState<string | null>(null)
  const [activePost, setActivePost] = useState<any>(null)
  const [selectedShop, setSelectedShop] = useState<any>(null)
  const [showAddWishlist, setShowAddWishlist] = useState(false)
  const [showWrapped, setShowWrapped] = useState(false)
  const [punchCards, setPunchCards] = useState<any[]>([])
  const [pendingRedemptionShopIds, setPendingRedemptionShopIds] = useState<Set<string>>(new Set())
  const [showRedemptionFor, setShowRedemptionFor] = useState<{ shopId: string; shopName: string; punchCardId: string } | null>(null)
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [stampToast, setStampToast] = useState<{ shopName: string; rewardEarned: boolean; newCount: number; required: number } | null>(null)
  const isWrappedSeason = [11, 0].includes(new Date().getMonth()) // December or January
  const [newDrink, setNewDrink] = useState('')
  const [newShop, setNewShop] = useState('')
  const [addingWishlist, setAddingWishlist] = useState(false)
  useEffect(() => {
    if (!stampToast) return
    const t = setTimeout(() => setStampToast(null), 4000)
    return () => clearTimeout(t)
  }, [stampToast])
  useEffect(() => {
    if (!profile) return
    async function load() {
      const [ratingsRes, visitsRes, followersRes, followingRes, wishlistRes] = await Promise.all([
        supabase.from('ratings').select('id, user_id, fill_level, drink_name, photo_url, photo_urls, caption, created_at, shop_id, coffee_shops(id, name, city, state, country, continent, photo_url, lat, lng)').eq('user_id', profile!.id).order('created_at', { ascending: false }).range(0, RATINGS_PER_PAGE - 1),
        supabase.from('user_shop_visits').select('*, coffee_shops(id,name,city,state,lat,lng,photo_url)').eq('user_id', profile!.id).order('visit_count', { ascending: false }),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile!.id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile!.id),
        supabase.from('wishlist').select('*').eq('user_id', profile!.id).order('created_at', { ascending: false }),
      ])
      // Use separate count for accurate badge (not limited by data fetch)
      const { count: serverCount } = await supabase
        .from('ratings').select('*', { count: 'exact', head: true }).eq('user_id', profile!.id)
      const newCount = serverCount || ratingsRes.data?.length || 0
      setTotalCount(newCount)
      const newBadge = getBadge(newCount, explorationStats || undefined).current
      const storedBadge = profile!.badge
      if (!storedBadge) {
        await supabase.from('profiles').update({ badge: newBadge.label }).eq('id', profile!.id)
      } else if (storedBadge !== newBadge.label) {
        const tiers = TIER_LABELS
        const oldIdx = tiers.indexOf(storedBadge)
        const newIdx = tiers.indexOf(newBadge.label)
        if (newIdx > oldIdx) {
          setCelebrateBadge(newBadge)
          await supabase.from('profiles').update({ badge: newBadge.label }).eq('id', profile!.id)
        } else {
          await supabase.from('profiles').update({ badge: newBadge.label }).eq('id', profile!.id)
        }
      }
      if (ratingsRes.data) {
        setRatings(ratingsRes.data)
        setRatingsHasMore(ratingsRes.data.length === RATINGS_PER_PAGE)
        // Compute exploration stats for advanced badge levels
        const shops = ratingsRes.data.filter((r: any) => r.coffee_shops)
        const uniqueShops = new Set(shops.map((r: any) => r.shop_id)).size
        const uniqueCities = new Set(shops.map((r: any) => r.coffee_shops?.city).filter(Boolean)).size
        const uniqueStates = new Set(shops.map((r: any) => r.coffee_shops?.state).filter(Boolean)).size
        const uniqueCountries = new Set(shops.map((r: any) => r.coffee_shops?.country).filter(Boolean)).size
        const uniqueContinents = new Set(shops.map((r: any) => r.coffee_shops?.continent).filter(Boolean)).size
        const firstBrews = 0 // first_brew tracking coming soon
        const streakWeeks = (profile as any)?.current_streak || 0
        setExplorationStats({ uniqueShops, uniqueCities, uniqueStates, uniqueCountries, uniqueContinents, firstBrews, streakWeeks })
      }
      // Use user_shop_visits if available, build from ratings as fallback
      if (visitsRes.data && visitsRes.data.length > 0) {
        setVisitedShops(visitsRes.data)
      } else if (ratingsRes?.data && ratingsRes.data.length > 0) {
        const shopMap: Record<string, any> = {}
        for (const r of ratingsRes.data) {
          if (!r.shop_id || !r.coffee_shops) continue
          if (!shopMap[r.shop_id]) {
            shopMap[r.shop_id] = { shop_id: r.shop_id, visit_count: 0, coffee_shops: r.coffee_shops }
          }
          shopMap[r.shop_id].visit_count++
        }
        setVisitedShops(Object.values(shopMap))
      }
      if (wishlistRes.data) setWishlist(wishlistRes.data)
      setFollowerCount(followersRes.count ?? 0)
      setFollowingCount(followingRes.count ?? 0)

      // Punch cards
      const { data: punchesData } = await supabase
        .from('user_punches')
        .select('shop_id, current_count, total_earned, coffee_shops(id, name, city)')
        .eq('user_id', profile!.id)
        .gt('current_count', 0)
      if (punchesData && punchesData.length > 0) {
        const shopIds = punchesData.map((p: any) => p.shop_id)
        const { data: cards } = await supabase
          .from('punch_cards')
          .select('id, shop_id, punches_required, reward_description')
          .in('shop_id', shopIds)
          .eq('is_active', true)
        if (cards) {
          const cardMap = Object.fromEntries(cards.map((c: any) => [c.shop_id, c]))
          setPunchCards(
            punchesData
              .map((p: any) => ({ ...p, punch_card: cardMap[p.shop_id] }))
              .filter((p: any) => p.punch_card)
          )
        }
      }

      // Track shops where an unconfirmed redemption QR is already open
      const { data: openRedemptions } = await supabase
        .from('punch_redemptions')
        .select('shop_id')
        .eq('user_id', profile!.id)
        .is('redeemed_at', null)
        .gt('expires_at', new Date().toISOString())
      if (openRedemptions) {
        setPendingRedemptionShopIds(new Set(openRedemptions.map((r: any) => r.shop_id)))
      }

      setLoading(false)
    }
    load()
  }, [profile])
  // Realtime: when barista resets current_count to 0, remove the card from the list
  useEffect(() => {
    if (!profile) return
    const channel = supabase
      .channel(`user-punches-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_punches', filter: `user_id=eq.${profile.id}` },
        (payload: any) => {
          const { shop_id, current_count } = payload.new
          if (current_count === 0) {
            setPunchCards(prev => prev.filter(p => p.shop_id !== shop_id))
            setPendingRedemptionShopIds(prev => { const n = new Set(prev); n.delete(shop_id); return n })
          } else {
            setPunchCards(prev => prev.map(p => p.shop_id === shop_id ? { ...p, current_count } : p))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile])

  if (!profile) return null
  async function addToWishlist() {
    if (!profile || !newDrink.trim() || addingWishlist) return
    setAddingWishlist(true)
    const { data } = await supabase.from('wishlist').insert({
      user_id: profile.id,
      drink_name: newDrink.trim(),
      shop_name: newShop.trim() || null,
    }).select().single()
    if (data) setWishlist(prev => [data, ...prev])
    setNewDrink('')
    setNewShop('')
    setShowAddWishlist(false)
    setAddingWishlist(false)
  }
  async function deleteWishlistItem(id: string) {
    await supabase.from('wishlist').delete().eq('id', id)
    setWishlist(prev => prev.filter(w => w.id !== id))
  }

  async function loadMoreRatings() {
    if (!profile || loadingMore || !ratingsHasMore) return
    setLoadingMore(true)
    const nextPage = ratingsPage + 1
    const { data } = await supabase
      .from('ratings')
      .select('id, user_id, fill_level, drink_name, photo_url, photo_urls, caption, created_at, shop_id, coffee_shops(id, name, city, state, country, continent, photo_url, lat, lng)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .range(nextPage * RATINGS_PER_PAGE, nextPage * RATINGS_PER_PAGE + RATINGS_PER_PAGE - 1)
    if (data) {
      setRatings(prev => [...prev, ...data])
      setRatingsHasMore(data.length === RATINGS_PER_PAGE)
      setRatingsPage(nextPage)
    }
    setLoadingMore(false)
  }
  const badgeInfo = getBadge(totalCount || ratings.length, explorationStats || undefined)
  return (
    <div className="min-h-screen bg-cream-100">
      <div className="sticky top-0 z-10 bg-cream-100 border-b border-cream-200 px-5 py-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-coffee-800">Profile</h1>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSettings(true)} className="w-9 h-9 flex items-center justify-center text-coffee-500 hover:text-caramel transition-colors">
            <Settings size={22} />
          </button>
        </div>
      </div>
      <div className="pb-28">
        {/* Profile card */}
        <div className="mx-4 mt-4 bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0" style={{ border: '1px solid rgba(200,180,150,0.3)' }}>
                {profile.avatar_url
                  ? <img src={cachedUrl(profile.avatar_url)} alt="" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)', willChange: 'transform' }} />
                  : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500"><span className="text-white font-display text-3xl font-bold">{profile.username[0].toUpperCase()}</span></div>}
              </div>
              <button onClick={() => setShowSettings(true)} className="absolute bottom-0 right-0 w-7 h-7 bg-caramel rounded-full flex items-center justify-center shadow border-2 border-white">
                <Camera size={12} className="text-white" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-coffee-800 font-display text-xl font-bold truncate">{profile.username}</h2>
                {profile.verified && <VerifiedBadge size={18} />}
              </div>
              {profile.full_name && <p className="text-coffee-500 text-sm truncate">{profile.full_name}</p>}
              {profile.bio && <p className="text-coffee-400 text-xs mt-1 line-clamp-2">{profile.bio}</p>}
              <button
                onClick={() => setShowBadgeExplainer(true)}
                className="flex items-center gap-1.5 mt-2 w-fit bg-cream-100 rounded-full px-3 py-1 border border-cream-200 active:scale-95 transition-all">
                <span>{badgeInfo.current.emoji}</span>
                <span className="text-sm font-semibold" style={{ color: badgeInfo.current.color }}>{badgeInfo.current.label}</span>
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
          {/* Brew Wrapped — December and January only */}
          {isWrappedSeason && (
            <div className="mt-4">
              <button
                onClick={() => setShowWrapped(true)}
                className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #1a0a02, #3d1a06)', color: 'white', border: '1px solid rgba(200,133,58,0.4)' }}
              >
                ✨ Your {new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()} Wrapped
              </button>
            </div>
          )}
          {/* Rate a visit — always visible */}
          {onNavigateToBrew && (
            <div className="mt-4">
              <button
                onClick={() => onNavigateToBrew()}
                className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)', color: 'white', boxShadow: '0 2px 12px rgba(200,133,58,0.25)' }}
              >
                ☕ Rate a visit
              </button>
            </div>
          )}
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
          {/* Brew Streak */}
          {(profile as any).current_streak > 0 && (
            <button
              onClick={() => setShowStreakExplainer(true)}
              className="mt-4 pt-3 border-t border-cream-100 flex items-center justify-between w-full text-left active:opacity-70 transition-opacity">
              <div className="flex items-center gap-2">
                <span className="text-xl">{(profile as any).current_streak >= 4 ? '🔥' : '☕'}</span>
                <div>
                  <p className="text-coffee-800 font-bold text-sm">{(profile as any).current_streak}-week streak <span className="text-coffee-300 text-xs font-normal">ⓘ</span></p>
                  <p className="text-coffee-400 text-xs">Best: {(profile as any).longest_streak || (profile as any).current_streak} weeks</p>
                </div>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: Math.min(7, (profile as any).current_streak) }).map((_, i) => (
                  <div key={i} className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#b87333' }}>
                    <span style={{ fontSize: 10 }}>☕</span>
                  </div>
                ))}
              </div>
            </button>
          )}
        </div>
        {/* Section toggle */}
        <div className="mx-4 mt-4 grid grid-cols-4 bg-white rounded-xl p-1 border border-cream-200 shadow-sm gap-1">
          <button onClick={() => setActiveSection('sips')}
            className={`py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${activeSection === 'sips' ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'}`}>
            <Coffee size={12} /> Sips
          </button>
          <button onClick={() => setActiveSection('map')}
            className={`py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${activeSection === 'map' ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'}`}>
            <MapPin size={12} /> Map
          </button>
          <button onClick={() => setActiveSection('wishlist')}
            className={`py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${activeSection === 'wishlist' ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'}`}>
            ☕ List
          </button>
          <button onClick={() => setActiveSection('cards')}
            className={`py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${activeSection === 'cards' ? 'bg-coffee-700 text-white shadow' : 'text-coffee-500'}`}>
            🎫 Cards
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
                {onNavigateToBrew && (
                  <button onClick={() => onNavigateToBrew()} className="mt-4 px-5 py-2.5 bg-caramel text-white rounded-full text-sm font-semibold">
                    Rate a coffee shop ☕
                  </button>
                )}
              </div>
            )}
            <div className="space-y-2">
              {ratings.map((rating: any) => {
                const shop = rating.coffee_shops as any
                return (
                  <div key={rating.id} className="w-full bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-cream-200">
                    <button onClick={() => shop && setSelectedShop(shop)} className="w-10 h-10 rounded-xl overflow-hidden bg-coffee-200 flex-shrink-0">
                      {shop?.photo_url
                        ? <img src={cachedUrl(shop.photo_url)} alt={shop?.name} className="w-full h-full object-cover" style={{ transform: 'translateZ(0)', willChange: 'transform' }} />
                        : <div className="w-full h-full flex items-center justify-center text-xl">☕</div>}
                    </button>
                    <button onClick={() => setActivePost(rating)} className="flex-1 min-w-0 text-left">
                      <p className="text-coffee-800 font-semibold text-sm truncate">{shop?.name ?? 'Moment'}</p>
                      {rating.drink_name && <p className="text-coffee-400 text-xs">{rating.drink_name}</p>}
                      {(rating.photo_urls?.length > 0 || rating.photo_url) && <p className="text-caramel text-xs">📷 {rating.photo_urls?.length > 1 ? `${rating.photo_urls.length} photos` : 'Photo'}</p>}
                    </button>
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
            {ratingsHasMore && (
              <button
                onClick={loadMoreRatings}
                disabled={loadingMore}
                className="w-full py-3 rounded-xl text-sm font-medium text-coffee-500 bg-white border border-cream-200 shadow-sm disabled:opacity-40 mt-1"
              >
                {loadingMore ? 'Loading...' : 'Load more sips'}
              </button>
            )}
          </div>
        )}
        {/* Wishlist */}
        {activeSection === 'wishlist' && (
          <div className="px-4 mt-3">
            <button onClick={() => setShowAddWishlist(true)}
              className="w-full mb-3 flex items-center justify-center gap-2 bg-caramel text-white rounded-xl py-3 font-semibold text-sm shadow-sm">
              <Plus size={16} /> Add a Drink
            </button>
            {showAddWishlist && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-cream-200 mb-3">
                <p className="text-coffee-700 font-semibold text-sm mb-3">Add to Wishlist</p>
                <div className="space-y-2 mb-3">
                  <input value={newDrink} onChange={e => setNewDrink(e.target.value)} placeholder="Drink name (e.g. Lavender Oat Latte)"
                    className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-2.5 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300" />
                  <input value={newShop} onChange={e => setNewShop(e.target.value)} placeholder="Shop name (optional)"
                    className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-2.5 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowAddWishlist(false); setNewDrink(''); setNewShop('') }}
                    className="flex-1 py-2 rounded-xl text-sm text-coffee-500 bg-cream-100 border border-cream-200 font-medium">Cancel</button>
                  <button onClick={addToWishlist} disabled={!newDrink.trim() || addingWishlist}
                    className="flex-1 py-2 rounded-xl text-sm text-white bg-caramel font-semibold disabled:opacity-40">
                    {addingWishlist ? 'Adding...' : 'Add ☕'}
                  </button>
                </div>
              </div>
            )}
            {wishlist.length === 0 && !showAddWishlist && (
              <div className="text-center py-10">
                <p className="text-4xl mb-2">☕</p>
                <p className="text-coffee-600 font-display">Your coffee wishlist</p>
                <p className="text-coffee-400 text-sm mt-1">Drinks you want to try</p>
              </div>
            )}
            <div className="space-y-2">
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.is_fulfilled && (
                        <span className="text-green-500 text-xs font-semibold bg-green-50 px-2 py-0.5 rounded-full border border-green-200">✓ Tried it!</span>
                      )}
                      <button onClick={() => deleteWishlistItem(item.id)} className="text-coffee-300 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Punch Cards */}
        {activeSection === 'cards' && (
          <div className="px-4 mt-3 space-y-3">
            {/* Scan to earn a stamp */}
            <button
              onClick={() => setShowQRScanner(true)}
              className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-white font-bold text-sm shadow-sm active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)', boxShadow: '0 4px 16px rgba(200,133,58,0.3)' }}
            >
              <span className="text-xl">📷</span> Scan Shop QR to Earn a Stamp
            </button>

            {loading && <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}
            {!loading && punchCards.length === 0 && (
              <div className="text-center py-6">
                <p className="text-coffee-400 text-sm">No stamps yet — visit a participating shop to get started</p>
              </div>
            )}
            <div className="space-y-3">
              {punchCards.map(pc => {
                const shop = pc.coffee_shops as any
                const card = pc.punch_card
                const count = pc.current_count as number
                const required = card.punches_required as number
                const progress = Math.min(count / required, 1)
                const earned = count >= required
                return (
                  <div key={pc.shop_id} className="bg-white rounded-2xl p-4 shadow-sm border border-cream-200">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-coffee-800 font-semibold text-sm">{shop?.name}</p>
                        {shop?.city && <p className="text-coffee-400 text-xs">{shop.city}</p>}
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${earned ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-cream-100 text-coffee-600 border border-cream-200'}`}>
                        {count}/{required} ☕
                      </span>
                    </div>
                    <div className="h-2 bg-cream-200 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${progress * 100}%`, background: earned ? 'linear-gradient(90deg, #d97706, #92400e)' : 'linear-gradient(90deg, #c8853a, #9b5e1a)' }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-coffee-500 text-xs flex-1">{card.reward_description}</p>
                      {earned && !pendingRedemptionShopIds.has(shop.id) && (
                        <button
                          onClick={() => {
                            setPendingRedemptionShopIds(prev => new Set([...prev, shop.id]))
                            setShowRedemptionFor({ shopId: shop.id, shopName: shop.name, punchCardId: card.id })
                          }}
                          className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold text-white"
                          style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
                        >
                          Redeem →
                        </button>
                      )}
                      {earned && pendingRedemptionShopIds.has(shop.id) && (
                        <span className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium text-coffee-400 bg-cream-100 border border-cream-200">
                          QR Open
                        </span>
                      )}
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
      {showWrapped && <BrewWrapped onClose={() => setShowWrapped(false)} />}
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onShowPrivacy={() => { setShowSettings(false); setShowPrivacyPage(true) }}
          onShowTerms={() => { setShowSettings(false); setShowTermsPage(true) }}
        />
      )}
      {showFollowers && <FollowersModal userId={profile.id} type={showFollowers} onClose={() => setShowFollowers(null)} />}
      {showShops && <VisitedShopsModal visits={visitedShops} onClose={() => setShowShops(false)} onShopClick={(s) => setSelectedShop(s)} />}
      {celebrateBadge && <BadgeCelebration badge={celebrateBadge} onClose={() => setCelebrateBadge(null)} />}
      {showBadgeExplainer && (
        <BadgeExplainerModal
          type="badge"
          badge={badgeInfo.current}
          onClose={() => setShowBadgeExplainer(false)}
          explorationStats={explorationStats}
          visitCount={ratings.length}
        />
      )}
      {showStreakExplainer && (
        <BadgeExplainerModal
          type="streak"
          streak={(profile as any).current_streak}
          onClose={() => setShowStreakExplainer(false)}
        />
      )}
      {viewingUserId && (
        <div className="fixed inset-0 z-50 bg-cream-100 overflow-y-auto">
          <UserProfilePage userId={viewingUserId} onBack={() => setViewingUserId(null)} />
        </div>
      )}
      {activePost && (
        <PostDetailModal rating={activePost} onClose={() => setActivePost(null)} onShopClick={(shop) => { setActivePost(null); setSelectedShop(shop) }} />
      )}
      {selectedShop && <ShopDetailPage shop={selectedShop} onBack={() => setSelectedShop(null)} />}
      {showRedemptionFor && (
        <PunchCardRedemption
          shop={{ id: showRedemptionFor.shopId, name: showRedemptionFor.shopName }}
          punchCardId={showRedemptionFor.punchCardId}
          userId={profile.id}
          onClose={() => {
            setShowRedemptionFor(null)
            // Re-check which shops still have an open QR (handles expiry)
            supabase
              .from('punch_redemptions')
              .select('shop_id')
              .eq('user_id', profile.id)
              .is('redeemed_at', null)
              .gt('expires_at', new Date().toISOString())
              .then(({ data }) => {
                setPendingRedemptionShopIds(new Set((data || []).map((r: any) => r.shop_id)))
              })
          }}
        />
      )}
      {showPrivacyPage && <PrivacyPolicyPage onBack={() => setShowPrivacyPage(false)} />}
      {showTermsPage && <TermsPage onBack={() => setShowTermsPage(false)} />}
      {showQRScanner && (
        <QRScannerModal
          onClose={() => setShowQRScanner(false)}
          onStampEarned={(shopName, rewardEarned, newCount, required) => {
            setShowQRScanner(false)
            setStampToast({ shopName, rewardEarned, newCount, required })
            supabase
              .from('user_punches')
              .select('shop_id, current_count, total_earned, coffee_shops(id, name, city)')
              .eq('user_id', profile.id)
              .gt('current_count', 0)
              .then(({ data: punchesData }) => {
                if (!punchesData || punchesData.length === 0) return
                const shopIds = punchesData.map((p: any) => p.shop_id)
                supabase
                  .from('punch_cards')
                  .select('id, shop_id, punches_required, reward_description')
                  .in('shop_id', shopIds)
                  .eq('is_active', true)
                  .then(({ data: cards }) => {
                    if (!cards) return
                    const cardMap = Object.fromEntries(cards.map((c: any) => [c.shop_id, c]))
                    setPunchCards(
                      punchesData
                        .map((p: any) => ({ ...p, punch_card: cardMap[p.shop_id] }))
                        .filter((p: any) => p.punch_card)
                    )
                  })
              })
          }}
        />
      )}
      {stampToast && (
        <div
          className="fixed bottom-24 left-4 right-4 z-[90] rounded-2xl p-4 shadow-xl flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #1a0f0a, #2a1a10)', border: '1px solid rgba(212,169,106,0.3)' }}
        >
          <span className="text-2xl">☕</span>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">Stamp earned at {stampToast.shopName}!</p>
            <p className="text-cream-400 text-xs mt-0.5">
              {stampToast.rewardEarned
                ? "🎉 You've earned a reward — tap Redeem!"
                : `${stampToast.newCount} / ${stampToast.required} stamps`}
            </p>
          </div>
          <button onClick={() => setStampToast(null)} className="text-cream-400 p-1">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
