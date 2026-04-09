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

type Tab = 'home' | 'discover' | 'brew' | 'trending' | 'profile'

function AppContent() {
  const { profile, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [feedRefresh, setFeedRefresh] = useState(0)

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

  function handlePostCreated() {
    setFeedRefresh(n => n + 1)
    setActiveTab('home')
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
