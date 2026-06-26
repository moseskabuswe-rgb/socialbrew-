import { useState, useEffect, useCallback, lazy, Suspense, Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { usePullToRefresh } from './lib/usePullToRefresh'
import { useWishlistProximity } from './lib/useWishlistProximity'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthForm from './components/auth/AuthForm'
import HomeTab from './components/home/HomeTab'
import BottomNav from './components/shared/BottomNav'
import EmailVerificationBanner from './components/shared/EmailVerificationBanner'
import ShopToast from './components/shared/ShopToast'
import BadgeCelebration from './components/shared/BadgeCelebration'
import PushPrompt from './components/shared/PushPrompt'
import AdminBroadcast from './components/shared/AdminBroadcast'

const DiscoverTab = lazy(() => import('./components/discover/DiscoverTab'))
const BrewTab = lazy(() => import('./components/brew/BrewTab'))
const TrendingTab = lazy(() => import('./components/trending/TrendingTab'))
const ProfileTab = lazy(() => import('./components/profile/ProfileTab'))
const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const PortalApp = lazy(() => import('./portal/PortalApp'))
const PortalInviteAccept = lazy(() => import('./portal/PortalInviteAccept'))
import { supabase } from './lib/supabase'
import { getBadge } from './lib/badges'
import { notifyLike, notifyComment, notifyFollow, notifyMention } from './lib/push'
import PrivacyAcceptanceModal, { CURRENT_POLICY_VERSION } from './components/shared/PrivacyAcceptanceModal'

// Re-export notification helpers so other components can import from App
export { notifyLike, notifyComment, notifyFollow, notifyMention }

class TabErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(_: Error) { return { hasError: true } }
  componentDidCatch(_: Error, __: ErrorInfo) {}
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6"
          style={{ background: 'linear-gradient(160deg, #fdfaf5 0%, #f5ead8 50%, #efe0c4 100%)' }}>
          <p className="text-coffee-600 font-medium text-center">Something went wrong loading this tab.</p>
          <button
            className="px-6 py-2.5 rounded-2xl text-white font-semibold text-sm"
            style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
            onClick={() => window.location.reload()}
          >Refresh App</button>
        </div>
      )
    }
    return this.props.children
  }
}

type Tab = 'home' | 'discover' | 'brew' | 'trending' | 'profile'

const PUSH_PROMPT_KEY = 'sb_push_prompted'

function TabSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(160deg, #fdfaf5 0%, #f5ead8 50%, #efe0c4 100%)' }}>
      <div className="w-10 h-10 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
    </div>
  )
}

function GuestAuthGate({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8"
      style={{ background: 'linear-gradient(160deg, #fdfaf5 0%, #f5ead8 50%, #efe0c4 100%)' }}>
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">☕</div>
        <h2 className="font-display text-2xl font-bold text-coffee-800 mb-2">Sign in to continue</h2>
        <p className="text-coffee-500 text-sm leading-relaxed">
          Create a free account to post ratings,<br />follow friends, and build your coffee journey.
        </p>
      </div>
      <button
        onClick={onSignIn}
        className="w-full max-w-xs py-3.5 rounded-2xl text-white font-semibold text-base"
        style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
      >
        Sign in / Create account ☕
      </button>
    </div>
  )
}

function AppContent() {
  const { profile, loading } = useAuth()
  useWishlistProximity(profile?.id || null) // Proximity check for visit wishlist on app open
  const [isGuest, setIsGuest] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [deepLink, setDeepLink] = useState<{ open: string; id?: string } | null>(null)
  const [feedRefresh, setFeedRefresh] = useState(0)
  const [shopToast, setShopToast] = useState<string | null>(null)
  const [celebrateBadge, setCelebrateBadge] = useState<any>(null)
  const [firstRatingShop, setFirstRatingShop] = useState<string | null>(null)
  const [showPushPrompt, setShowPushPrompt] = useState(false)
  const [tabRefresh, setTabRefresh] = useState(0)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  // Secret tap counter on logo — 5 taps opens admin panel
  const [_logoTaps, setLogoTaps] = useState(0)

  const handlePullRefresh = useCallback(() => {
    setFeedRefresh(n => n + 1)
    setTabRefresh(n => n + 1)
  }, [])
  const { pullProgress, refreshing: pullRefreshing } = usePullToRefresh(handlePullRefresh)

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

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    function handleUrlParams() {
      const params = new URLSearchParams(window.location.search)
      const open = params.get('open')
      const rawId = params.get('id')
      const id = rawId && UUID_RE.test(rawId) ? rawId : undefined
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
      const isUUID = (v: any) => typeof v === 'string' && UUID_RE.test(v)
      if ((data.type === 'like' || data.type === 'comment' || data.type === 'mention' || data.type === 'new_post') && isUUID(data.rating_id)) {
        setDeepLink({ open: 'post', id: data.rating_id })
        setActiveTab('home')
      } else if (data.type === 'follow' && isUUID(data.actor_id)) {
        setDeepLink({ open: 'profile', id: data.actor_id })
        setActiveTab('home')
      } else if (data.type === 'follow_request') {
        setActiveTab('profile')
      } else if (data.type === 'dm' && isUUID(data.actor_id)) {
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
    if (!profile || !['admin', 'moderator', 'viewer'].includes(profile.role as string)) return
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

  // Portal routing — standalone pages, not part of main app auth flow
  const pathname = window.location.pathname.replace(/\/$/, '') || '/'
  if (pathname === '/portal/invite') return <Suspense fallback={null}><PortalInviteAccept /></Suspense>
  if (pathname === '/portal') return <Suspense fallback={null}><PortalApp /></Suspense>

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

  if (!profile && !isGuest) return <AuthForm onGuest={() => { setIsGuest(true); setActiveTab('discover') }} />

  // Guest mode — Discover and Trending only, everything else shows auth gate
  if (!profile && isGuest) {
    return (
      <div className="min-h-screen max-w-lg mx-auto relative bg-cream-100">
        <div className="bg-coffee-800 text-white text-xs text-center py-2.5 px-4 flex items-center justify-center gap-2">
          <span className="text-white/70">Browsing as guest</span>
          <button
            onClick={() => { setIsGuest(false); setActiveTab('home') }}
            className="text-caramel font-semibold underline"
          >
            Sign in
          </button>
        </div>
        <div className="pb-20">
          <TabErrorBoundary>
            {(activeTab === 'home' || activeTab === 'brew' || activeTab === 'profile') && (
              <GuestAuthGate onSignIn={() => { setIsGuest(false); setActiveTab(activeTab) }} />
            )}
          </TabErrorBoundary>
          <TabErrorBoundary>
            <Suspense fallback={<TabSpinner />}>
              {activeTab === 'discover' && <DiscoverTab key={tabRefresh} />}
              {activeTab === 'trending' && <TrendingTab key={tabRefresh} />}
            </Suspense>
          </TabErrorBoundary>
        </div>
        <BottomNav active={activeTab} onChange={setActiveTab} />
      </div>
    )
  }

  // Show privacy acceptance for users who haven't accepted current policy version
  const needsPrivacyAccept = (profile as any).privacy_policy_version !== CURRENT_POLICY_VERSION

  // Admin panel — query param ?panel=ops, admin/moderator only
  if (
    new URLSearchParams(window.location.search).get('panel') === 'ops' &&
    ['admin', 'moderator'].includes(profile.role as string)
  ) {
    return <Suspense fallback={null}><AdminLayout profile={profile} /></Suspense>
  }

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

      {/* Pull-to-refresh indicator — uses transform (not marginTop) to avoid layout reflow */}
      {(pullProgress > 0.15 || pullRefreshing) && (
        <div
          className="fixed top-0 left-1/2 z-50 flex items-center justify-center pointer-events-none"
          style={{ transform: `translateX(-50%) translateY(${Math.round((pullRefreshing ? 1 : pullProgress) * 48)}px)` }}
        >
          <div
            className={`w-8 h-8 rounded-full border-2 border-caramel border-t-transparent bg-white shadow-md ${pullRefreshing || pullProgress >= 1 ? 'animate-spin' : ''}`}
            style={{ opacity: pullRefreshing ? 1 : pullProgress }}
          />
        </div>
      )}

      <div className="pb-20">
        <TabErrorBoundary>
          {activeTab === 'home' && (
            <>
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
        </TabErrorBoundary>
        <TabErrorBoundary>
          <Suspense fallback={<TabSpinner />}>
            {activeTab === 'discover' && <DiscoverTab key={tabRefresh} />}
            {activeTab === 'brew' && <BrewTab onPostCreated={handlePostCreated} />}
            {activeTab === 'trending' && <TrendingTab key={tabRefresh} />}
            {activeTab === 'profile' && <ProfileTab key={tabRefresh} />}
          </Suspense>
        </TabErrorBoundary>
      </div>

      <BottomNav active={activeTab} onChange={setActiveTab} />

      {shopToast && <ShopToast shopName={shopToast} onDone={() => setShopToast(null)} />}

      {/* First Brew celebration overlay */}
      {firstRatingShop && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(8,4,1,0.92)' }}
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

      {needsPrivacyAccept && (
        <PrivacyAcceptanceModal
          userId={profile.id}
          onAccepted={() => window.location.reload()}
        />
      )}

      {/* Admin dashboard — triggered by 5 taps on logo, admin/moderator only */}
      {showAdminPanel && ['admin', 'moderator', 'viewer'].includes(profile.role as string) && (
        <div className="fixed inset-0 z-50">
          <Suspense fallback={null}>
            <AdminLayout profile={profile} onClose={() => setShowAdminPanel(false)} />
          </Suspense>
        </div>
      )}

      {/* Fallback broadcast panel for non-admin roles with the UUID */}
      {showAdminPanel && !['admin', 'moderator'].includes(profile.role as string) && (
        <AdminBroadcast
          currentUserId={profile.id}
          onClose={() => setShowAdminPanel(false)}
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
