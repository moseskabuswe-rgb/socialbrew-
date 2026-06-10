import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PortalLogin from './PortalLogin'
import PortalDashboard from './pages/PortalDashboard'
import PortalMentions from './pages/PortalMentions'
import PortalEditShop from './pages/PortalEditShop'
import PortalPosts from './pages/PortalPosts'
import PortalSettings from './pages/PortalSettings'
import PortalMessages from './pages/PortalMessages'
import PortalPunchCard from './pages/PortalPunchCard'
import PortalScanner from './pages/PortalScanner'
import PortalStories from './pages/PortalStories'
import PortalTeam from './pages/PortalTeam'
import PortalReports from './pages/PortalReports'
import PortalRoastProfile from './pages/PortalRoastProfile'

export type PortalTab = 'dashboard' | 'mentions' | 'edit' | 'posts' | 'stories' | 'messages' | 'punchcard' | 'scanner' | 'settings' | 'team' | 'reports' | 'roast'
export type PortalRole = 'owner' | 'manager' | 'barista'

interface ShopOwner {
  id: string
  profile_id: string
  shop_id: string
  notification_prefs: any
  founding_partner: boolean
  punches_issued_total: number
  punches_issued_this_month: number
  punch_quota_reset_at: string | null
  punch_card_quota: number
}

interface Shop {
  id: string
  name: string
  city: string | null
  state: string | null
  photo_url: string | null
  claimed_by: string | null
  avg_fill: number
  total_ratings: number
}

// Nav items per role — baristas only get Scanner + Settings
const NAV_OWNER: { id: PortalTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'mentions', label: 'Reviews', icon: '⭐' },
  { id: 'reports', label: 'Reports', icon: '📈' },
  { id: 'posts', label: 'Posts', icon: '📢' },
  { id: 'stories', label: 'Stories', icon: '📸' },
  { id: 'messages', label: 'Messages', icon: '💬' },
  { id: 'edit', label: 'Edit Shop', icon: '✏️' },
  { id: 'punchcard', label: 'Punch Card', icon: '🎫' },
  { id: 'scanner', label: 'Stamp QR', icon: '📷' },
  { id: 'roast', label: 'Roast Profile', icon: '☕' },
  { id: 'team', label: 'Team', icon: '👥' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

const NAV_MANAGER: { id: PortalTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'mentions', label: 'Reviews', icon: '⭐' },
  { id: 'reports', label: 'Reports', icon: '📈' },
  { id: 'posts', label: 'Posts', icon: '📢' },
  { id: 'punchcard', label: 'Punch Card', icon: '🎫' },
  { id: 'scanner', label: 'Stamp QR', icon: '📷' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

const NAV_BARISTA: { id: PortalTab; label: string; icon: string }[] = [
  { id: 'scanner', label: 'Stamp QR', icon: '📷' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

function navForRole(role: PortalRole) {
  if (role === 'owner') return NAV_OWNER
  if (role === 'manager') return NAV_MANAGER
  return NAV_BARISTA
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50">
      <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
    </div>
  )
}

export default function PortalApp() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [portalRole, setPortalRole] = useState<PortalRole>('owner')
  const [shopOwner, setShopOwner] = useState<ShopOwner | null>(null)
  const [shop, setShop] = useState<Shop | null>(null)
  const [activeTab, setActiveTab] = useState<PortalTab | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      // Load profile to get portal_role and team_shop_id
      const { data: profileData } = await supabase
        .from('profiles')
        .select('portal_role, shop_id, team_shop_id')
        .eq('id', user.id)
        .single()

      const role: PortalRole = (profileData?.portal_role as PortalRole) || 'owner'
      setPortalRole(role)

      // Default landing tab
      setActiveTab(role === 'barista' ? 'scanner' : 'dashboard')

      // Owner path: load via shop_owners
      const { data: owner } = await supabase
        .from('shop_owners')
        .select('id,profile_id,shop_id,notification_prefs,founding_partner,punches_issued_total,punches_issued_this_month,punch_quota_reset_at,punch_card_quota')
        .eq('profile_id', user.id)
        .maybeSingle()

      if (owner) {
        setShopOwner(owner)
        const { data: shopData } = await supabase
          .from('coffee_shops')
          .select('id,name,city,state,photo_url,claimed_by,avg_fill,total_ratings')
          .eq('id', owner.shop_id)
          .single()
        if (shopData) setShop(shopData)
        setLoading(false)
        return
      }

      // Team member path: load via team_shop_id on profile
      const teamShopId = profileData?.team_shop_id
      if (teamShopId) {
        const { data: shopData } = await supabase
          .from('coffee_shops')
          .select('id,name,city,state,photo_url,claimed_by,avg_fill,total_ratings')
          .eq('id', teamShopId)
          .single()
        if (shopData) setShop(shopData)
        setLoading(false)
        return
      }

      setLoading(false)
    }
    init()
  }, [])

  if (loading) return <Spinner />
  if (!userId) return <PortalLogin onSuccess={() => window.location.reload()} />

  if (!shop || activeTab === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-cream-50 gap-3 px-6 text-center">
        <p className="text-4xl">☕</p>
        <p className="text-coffee-800 font-display font-bold text-lg">No shop linked</p>
        <p className="text-coffee-400 text-sm leading-relaxed">
          Your account isn't linked to a shop yet. If you accepted an invite, please try signing in again.
        </p>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}
          className="mt-2 text-xs text-caramel underline"
        >
          Sign out
        </button>
      </div>
    )
  }

  function handleTabChange(tab: PortalTab) {
    // Gate access: non-owners cannot access owner-only tabs
    const nav = navForRole(portalRole)
    if (!nav.find(n => n.id === tab)) return
    setActiveTab(tab)
    setSidebarOpen(false)
  }

  const nav = navForRole(portalRole)
  const roleLabel = portalRole === 'owner' ? 'Owner Portal' : portalRole === 'manager' ? 'Manager' : 'Barista'

  return (
    <div className="h-screen bg-cream-50 flex overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-56 bg-cream-50 border-r border-cream-200 z-30 flex flex-col transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}
      >
        <div className="px-5 py-4 border-b border-cream-200">
          <p className="font-display text-base font-bold text-coffee-900 truncate">{shop.name}</p>
          <p className="text-xs text-coffee-400 mt-0.5">{roleLabel}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {nav.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === item.id ? 'bg-caramel/10 text-caramel' : 'text-coffee-600 hover:bg-cream-200'}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-cream-200 pt-3">
          <button
            onClick={() => { window.location.href = '/' }}
            className="w-full px-3 py-2 rounded-lg text-sm text-coffee-500 hover:bg-cream-200 hover:text-coffee-700 text-left transition-colors"
          >
            ← Back to app
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}
            className="w-full px-3 py-2 rounded-lg text-sm text-coffee-500 hover:bg-cream-200 hover:text-coffee-700 text-left transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-cream-50 border-b border-cream-200">
          <button onClick={() => setSidebarOpen(true)} className="p-1 rounded-md text-coffee-500 hover:bg-cream-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-display text-base font-semibold text-coffee-900 truncate">
            {nav.find(n => n.id === activeTab)?.label}
          </span>
          <div className="w-7" />
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {activeTab === 'dashboard' && <PortalDashboard shop={shop} onNavigate={handleTabChange} />}
          {activeTab === 'mentions' && <PortalMentions shop={shop} />}
          {activeTab === 'edit' && portalRole === 'owner' && <PortalEditShop shop={shop} onShopUpdate={s => setShop(s)} />}
          {activeTab === 'posts' && <PortalPosts shop={shop} userId={userId} />}
          {activeTab === 'stories' && portalRole === 'owner' && <PortalStories shop={shop} userId={userId} />}
          {activeTab === 'messages' && portalRole === 'owner' && <PortalMessages shop={shop} userId={userId} />}
          {activeTab === 'punchcard' && shopOwner && <PortalPunchCard shop={shop} shopOwner={shopOwner} />}
          {activeTab === 'punchcard' && !shopOwner && (
            <div className="max-w-sm mx-auto py-12 text-center text-coffee-400 text-sm">Punch card stats are available to shop owners.</div>
          )}
          {activeTab === 'scanner' && <PortalScanner shop={shop} userId={userId} />}
          {activeTab === 'reports' && <PortalReports shop={shop} userId={userId!} />}
          {activeTab === 'roast' && portalRole === 'owner' && <PortalRoastProfile shop={shop} />}
          {activeTab === 'team' && portalRole === 'owner' && <PortalTeam shop={shop} userId={userId} />}
          {activeTab === 'settings' && (
            <PortalSettings
              shopOwner={shopOwner}
              userId={userId}
              portalRole={portalRole}
              onUpdate={o => setShopOwner(o as any)}
            />
          )}
        </main>
      </div>
    </div>
  )
}
