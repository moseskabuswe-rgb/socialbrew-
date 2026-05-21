import { useState, useEffect } from 'react'
import { useWishlistProximity } from './lib/useWishlistProximity'
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
import AdminApp from './admin/AdminApp'
import { supabase } from './lib/supabase'
import { getBadge } from './lib/badges'
import { notifyLike, notifyComment, notifyFollow, notifyMention } from './lib/push'

// Re-export notification helpers so other components can import from App
export { notifyLike, notifyComment, notifyFollow, notifyMention }

type Tab = 'home' | 'discover' | 'brew' | 'trending' | 'profile'

const PUSH_PROMPT_KEY = 'sb_push_prompted'
const ADMIN_USER_ID = '47e5480e-e592-44bc-9b34-1111af76ea0e'

function AppContent() {
  const { profile, loading } = useAuth()
  useWishlistProximity(profile?.id || null) // Proximity check for visit wishlist on app open
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [deepLink, setDeepLink] = useState<{ open: string; id?: string } | null>(null)
  const [feedRefresh, setFeedRefresh] = useState(0)
  const [shopToast, setShopToast] = useState<string | null>(null)
  const [celebrateBadge, setCelebrateBadge] = useState<any>(null)
  const [firstRatingShop, setFirstRatingShop] = useState<string | null>(null)
  const [showPushPrompt, setShowPushPrompt] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  // Secret tap counter on logo — 5 taps opens admin panel
  const [_logoTaps, setLogoTaps] = useState(0)

  // Show push prompt once, 3 seconds after login
  useEffect(() => {
    if (!profile) return
    const already = localStorage.getItem(PUSH_PROMPT_KEY)
    if (already) return
    // Don't prompt if already granted
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') return
    const timer = setTimeout(() => setShowPushPrompt(true), 3000)
    return () => clearTimeout(timer)
  }, [profile])

  function dismissPushPrompt() {
    setShowPushPrompt(false)
    localStorage.setItem(PUSH_PROMPT_KEY, '1')
  }

  // Deep link handler — reads URL params (app was closed) or SW messages (app was open)
  useEffect(() => {
    if (!profile) return

    function handleUrlParams() {
      const params = new URLSearchParams(window.location.search)
      const open = params.get('open')
      const id = params.get('id') || undefined
      if (!open) return
      if (open === 'follow_requests') {
        setActiveTab('profile')
      } else {
        setDeepLink({ open, id })
        setActiveTab('home')
      }
      window.history.replaceState({}, '', '/')
    }

    function handleSWMessage(event: MessageEvent) {
      if (event.data?.type !== 'NOTIFICATION_CLICK') return
      const data = event.data.data
      if (!data) return
      if ((data.type === 'like' || data.type === 'comment' || data.type === 'mention' || data.type === 'new_post') && data.rating_id) {
        setDeepLink({ open: 'post', id: data.rating_id })
        setActiveTab('home')
      } else if (data.type === 'follow' && data.actor_id) {
        setDeepLink({ open: 'profile', id: data.actor_id })
        setActiveTab('home')
      } else if (data.type === 'follow_request') {
        setActiveTab('profile')
      } else if (data.type === 'dm' && data.actor_id) {
        setDeepLink({ open: 'messages', id: data.actor_id })
        setActiveTab('home')
      }
    }

    handleUrlParams()
    navigator.serviceWorker?.addEventListener('message', handleSWMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
  }, [profile])

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
    setFeedRefresh(n => n + 1)
    setActiveTab('home')
    if (shopName) setShopToast(shopName)

    // Check if badge upgraded after this post
    if (profile) {
      const { count } = await supabase
        .from('ratings')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
      const newCount = count || 0
      const newBadge = getBadge(newCount).current
      if (profile.badge !== newBadge.label) {
        await supabase.from('profiles').update({ badge: newBadge.label }).eq('id', profile.id)
        // Delay badge celebration until ShopToast finishes (~2s) so they don't overlap
        setTimeout(() => setCelebrateBadge(newBadge), 2500)
      }
    }
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto relative bg-cream-100">
      {profile && !profile.email_verified && <EmailVerificationBanner />}

      <div className="pb-20">
        {activeTab === 'home' && (
          <>
            {/* Push prompt shows at top of home feed */}
            {showPushPrompt && (
              <PushPrompt
                userId={profile.id}
                onDismiss={dismissPushPrompt}
                onSuccess={dismissPushPrompt}
              />
            )}
            <HomeTab refresh={feedRefresh} onLogoTap={handleLogoTap} deepLink={deepLink} onDeepLinkHandled={() => setDeepLink(null)} />
          </>
        )}
        {activeTab === 'discover' && <DiscoverTab />}
        {activeTab === 'brew' && <BrewTab onPostCreated={handlePostCreated} />}
        {activeTab === 'trending' && <TrendingTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />
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
    </div>
  )
}

export default function App() {
  if (window.location.pathname.startsWith('/admin')) {
    return <AuthProvider><AdminApp /></AuthProvider>
  }
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
