import { useState, useEffect, useRef } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthForm from './components/auth/AuthForm'
import HomeTab from './components/home/HomeTab'
import DiscoverTab from './components/discover/DiscoverTab'
import BrewTab from './components/brew/BrewTab'
import TrendingTab from './components/trending/TrendingTab'
import ProfileTab from './components/profile/ProfileTab'
import BottomNav from './components/shared/BottomNav'
import EmailVerificationBanner from './components/shared/EmailVerificationBanner'
import FeedbackWidget from './components/shared/FeedbackWidget'
import ShopToast from './components/shared/ShopToast'
import BadgeCelebration from './components/shared/BadgeCelebration'
import PushPrompt from './components/shared/PushPrompt'
import AdminBroadcast from './components/shared/AdminBroadcast'
import WelcomeModal from './components/shared/WelcomeModal'
import { supabase } from './lib/supabase'
import { notifyLike, notifyComment, notifyFollow, notifyMention, sendPushToUser } from './lib/push'

export { notifyLike, notifyComment, notifyFollow, notifyMention, sendPushToUser }

type Tab = 'home' | 'discover' | 'brew' | 'trending' | 'profile'

const ADMIN_USER_ID = '47e5480e-e592-44bc-9b34-1111af76ea0e'

function AppContent() {
  const { profile, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [feedRefresh, setFeedRefresh] = useState(0)
  const [brewShop, setBrewShop] = useState<any>(null)

  function navigateToBrew(shop?: any) {
    setBrewShop(shop || null)
    setActiveTab('brew')
  }
  const [shopToast, setShopToast] = useState<string | null>(null)
  const [celebrateBadge, setCelebrateBadge] = useState<any>(null)
  const [firstRatingShop, setFirstRatingShop] = useState<string | null>(null)
  const [showPushPrompt, setShowPushPrompt] = useState(false)
  const promptShown = useRef(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const welcomeShown = useRef(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [_logoTaps, setLogoTaps] = useState(0)

  // ── Unread DM state — lives here so it survives tab switches ──
  const [unreadPerSender, setUnreadPerSender] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!profile) return
    // Load initial unread counts from DB
    supabase
      .from('direct_messages')
      .select('from_id')
      .eq('to_id', profile.id)
      .eq('read', false)
      .then(({ data }) => {
        if (data) {
          const perSender: Record<string, number> = {}
          data.forEach((m: any) => { perSender[m.from_id] = (perSender[m.from_id] || 0) + 1 })
          setUnreadPerSender(perSender)
        }
      })
    // Subscribe to new incoming messages
    const channel = supabase
      .channel('app-dm-unread-' + profile.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
        filter: `to_id=eq.${profile.id}`
      }, (payload) => {
        setUnreadPerSender(prev => ({
          ...prev,
          [payload.new.from_id]: (prev[payload.new.from_id] || 0) + 1
        }))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile])

  // Smart push prompt — shows after user receives first notification
  // so they understand exactly what they're enabling.
  // Re-asks after 7 days if dismissed.
  useEffect(() => {
    if (!profile) return
    if (promptShown.current) return
    const hasToken = !!(profile as any).push_token
    if (hasToken) return

    const dismissed = localStorage.getItem('sb_push_dismissed')
    if (dismissed) {
      const daysSince = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24)
      if (daysSince < 7) return
    }

    promptShown.current = true

    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('read', false)
      .then(({ count }) => {
        if (count && count > 0) {
          setTimeout(() => setShowPushPrompt(true), 1000)
        } else {
          const interval = setInterval(async () => {
            const { count: newCount } = await supabase
              .from('notifications')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', profile.id)
              .eq('read', false)
            if (newCount && newCount > 0) {
              clearInterval(interval)
              setTimeout(() => setShowPushPrompt(true), 800)
            }
          }, 15000)
          setTimeout(() => clearInterval(interval), 10 * 60 * 1000)
        }
      })
  }, [profile])

  // Show welcome modal for new signups only — never for returning users
  useEffect(() => {
    if (!profile) return
    if (welcomeShown.current) return
    if (localStorage.getItem('sb_welcomed')) return
    // Only show if account was created within the last 5 minutes
    const ageMs = Date.now() - new Date(profile.created_at).getTime()
    if (ageMs > 5 * 60 * 1000) return
    welcomeShown.current = true
    // Small delay so the feed loads first
    const timer = setTimeout(() => setShowWelcome(true), 800)
    return () => clearTimeout(timer)
  }, [profile])

  function dismissPushPrompt() {
    setShowPushPrompt(false)
    localStorage.setItem('sb_push_dismissed', Date.now().toString())
  }

  // Secret logo tap handler — 5 taps within ~3s opens admin panel
  function handleLogoTap() {
    if (profile?.id !== ADMIN_USER_ID) return
    setLogoTaps(n => {
      const next = n + 1
      if (next >= 5) {
        setShowAdminPanel(true)
        return 0
      }
      // Reset after 3s of inactivity
      setTimeout(() => setLogoTaps(0), 3000)
      return next
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(160deg, #fdfaf5 0%, #f5ead8 50%, #efe0c4 100%)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
          <p className="text-coffee-400 text-sm">Brewing...</p>
        </div>
      </div>
    )
  }

  if (!profile) return <AuthForm />

  async function handlePostCreated(shopName?: string, wasFirst?: boolean) {
    if (wasFirst && shopName) setFirstRatingShop(shopName)
    setBrewShop(null)
    setFeedRefresh(n => n + 1)
    setActiveTab('home')
    if (shopName) setShopToast(shopName)

    // Notify followers of new post
    if (profile) {
      try {
        const { data: followers } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', profile.id)
        if (followers && followers.length > 0) {
          const username = (profile as any).username || 'Someone'
          const postText = shopName
            ? `${username} just rated ${shopName} ☕`
            : `${username} shared a new brew ☕`
          followers.forEach(({ follower_id }) => {
            sendPushToUser(follower_id, 'New brew from someone you follow', postText, { type: 'new_post' })
          })
        }
      } catch (err) {
        console.error('Failed to notify followers:', err)
      }
    }

    // Check if badge upgraded after this post
    if (profile) {
      const { count } = await supabase
        .from('ratings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
      const newCount = count || 0
      const tiers = [
        { label: 'Coffee Curious', emoji: '🌱', color: '#7aaa6a', min: 0 },
        { label: 'Coffee Lover', emoji: '☕', color: '#c8853a', min: 3 },
        { label: 'Regular', emoji: '⭐', color: '#d4a017', min: 10 },
        { label: 'Enthusiast', emoji: '🔥', color: '#e06030', min: 25 },
        { label: 'Connoisseur', emoji: '🏆', color: '#9b59b6', min: 50 },
        { label: 'Brew Master', emoji: '👑', color: '#c0392b', min: 100 },
      ]
      let newBadge = tiers[0]
      for (let i = tiers.length - 1; i >= 0; i--) {
        if (newCount >= tiers[i].min) { newBadge = tiers[i]; break }
      }
      if (profile.badge !== newBadge.label) {
        setCelebrateBadge(newBadge)
        await supabase.from('profiles').update({ badge: newBadge.label }).eq('id', profile.id)
      }
    }
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto relative bg-cream-100">
      {profile && !profile.email_verified && <EmailVerificationBanner />}

      <div className="pb-20">
        {/* Always mounted tabs — hidden with CSS to preserve state */}
        <div style={{ display: activeTab === 'home' ? 'block' : 'none' }}>
          {showPushPrompt && (
            <PushPrompt
              userId={profile.id}
              onDismiss={dismissPushPrompt}
              onSuccess={() => setShowPushPrompt(false)}
            />
          )}
          <HomeTab
            refresh={feedRefresh}
            onLogoTap={handleLogoTap}
            unreadPerSender={unreadPerSender}
            onNavigateToBrew={navigateToBrew}
            onMarkRead={(senderId) => {
              if (senderId === '__all__') {
                setUnreadPerSender({})
              } else {
                setUnreadPerSender(prev => { const n = {...prev}; delete n[senderId]; return n })
              }
            }}
          />
        </div>
        {activeTab === 'discover' && <DiscoverTab onNavigateToBrew={navigateToBrew} />}
        {activeTab === 'brew' && <BrewTab onPostCreated={handlePostCreated} initialShop={brewShop} />}
        {activeTab === 'trending' && <TrendingTab />}
        {activeTab === 'profile' && <ProfileTab onNavigateToBrew={navigateToBrew} />}
      </div>

      <BottomNav active={activeTab} onChange={(tab) => {
        if (tab === 'brew') setBrewShop(null)
        setActiveTab(tab)
      }} />
      <FeedbackWidget />

      {shopToast && <ShopToast shopName={shopToast} onDone={() => setShopToast(null)} />}

      {/* First Brew celebration overlay */}
      {firstRatingShop && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(8,4,1,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setFirstRatingShop(null)}
        >
          <div className="mx-6 bg-white rounded-3xl p-8 text-center shadow-2xl">
            <div className="text-6xl mb-4">⭐</div>
            <h2 className="font-display text-2xl font-bold mb-2" style={{ color: '#3d1a06' }}>First Brew!</h2>
            <p className="text-sm mb-1" style={{ color: '#6b4c2a' }}>You're the first person to rate</p>
            <p className="font-bold text-lg mb-4" style={{ color: '#c8853a' }}>{firstRatingShop}</p>
            <p className="text-xs mb-6" style={{ color: '#9b7a45' }}>on Social Brew — you'll always be the pioneer ⭐</p>
            <button
              onClick={() => setFirstRatingShop(null)}
              className="w-full py-3.5 rounded-2xl text-white font-semibold text-base"
              style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
            >
              Let's go! ☕
            </button>
          </div>
        </div>
      )}

      {celebrateBadge && (
        <BadgeCelebration badge={celebrateBadge} onClose={() => setCelebrateBadge(null)} />
      )}

      {/* Admin broadcast panel — triggered by 5 taps on logo, only for Moses */}
      {showAdminPanel && (
        <AdminBroadcast
          currentUserId={profile.id}
          onClose={() => setShowAdminPanel(false)}
        />
      )}

      {showWelcome && (
        <WelcomeModal
          username={profile.username}
          onClose={() => {
            setShowWelcome(false)
            localStorage.setItem('sb_welcomed', '1')
          }}
          onBrew={() => {
            setShowWelcome(false)
            localStorage.setItem('sb_welcomed', '1')
            navigateToBrew()
          }}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
