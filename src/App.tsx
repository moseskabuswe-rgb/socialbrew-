import { useState } from 'react'
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
import { supabase } from './lib/supabase'

type Tab = 'home' | 'discover' | 'brew' | 'trending' | 'profile'

function AppContent() {
  const { profile, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [feedRefresh, setFeedRefresh] = useState(0)
  const [shopToast, setShopToast] = useState<string | null>(null)
  const [celebrateBadge, setCelebrateBadge] = useState<any>(null)

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

  async function handlePostCreated(shopName?: string) {
    setFeedRefresh(n => n + 1)
    setActiveTab('home')
    if (shopName) setShopToast(shopName)

    // Check if badge upgraded after this post
    if (profile) {
      const { count } = await supabase.from('ratings').select('*', { count: 'exact', head: true }).eq('user_id', profile.id)
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
        {activeTab === 'home' && <HomeTab refresh={feedRefresh} />}
        {activeTab === 'discover' && <DiscoverTab />}
        {activeTab === 'brew' && <BrewTab onPostCreated={handlePostCreated} />}
        {activeTab === 'trending' && <TrendingTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </div>
      <BottomNav active={activeTab} onChange={setActiveTab} />
      <FeedbackWidget />
      {shopToast && <ShopToast shopName={shopToast} onDone={() => setShopToast(null)} />}
      {celebrateBadge && <BadgeCelebration badge={celebrateBadge} onClose={() => setCelebrateBadge(null)} />}
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
