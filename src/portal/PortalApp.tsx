import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PortalLogin from './PortalLogin'
import PortalDashboard from './pages/PortalDashboard'
import PortalMentions from './pages/PortalMentions'
import PortalEditShop from './pages/PortalEditShop'
import PortalPosts from './pages/PortalPosts'
import PortalSettings from './pages/PortalSettings'
import PortalMessages from './pages/PortalMessages'

export type PortalTab = 'dashboard' | 'mentions' | 'edit' | 'posts' | 'messages' | 'settings'

interface ShopOwner {
  id: string
  profile_id: string
  shop_id: string
  notification_prefs: any
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

const NAV: { id: PortalTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'mentions', label: 'Reviews', icon: '⭐' },
  { id: 'posts', label: 'Posts', icon: '📢' },
  { id: 'messages', label: 'Messages', icon: '💬' },
  { id: 'edit', label: 'Edit Shop', icon: '✏️' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

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
  const [shopOwner, setShopOwner] = useState<ShopOwner | null>(null)
  const [shop, setShop] = useState<Shop | null>(null)
  const [activeTab, setActiveTab] = useState<PortalTab>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const { data: owner } = await supabase
        .from('shop_owners')
        .select('id,profile_id,shop_id,notification_prefs')
        .eq('profile_id', user.id)
        .maybeSingle()
      if (!owner) { setLoading(false); return }
      setShopOwner(owner)
      const { data: shopData } = await supabase
        .from('coffee_shops')
        .select('id,name,city,state,photo_url,claimed_by,avg_fill,total_ratings')
        .eq('id', owner.shop_id)
        .single()
      if (shopData) setShop(shopData)
      setLoading(false)
    }
    init()
  }, [])

  if (loading) return <Spinner />

  if (!userId) return <PortalLogin onSuccess={() => window.location.reload()} />

  if (!shopOwner || !shop) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-cream-50 gap-3 px-6 text-center">
        <p className="text-4xl">☕</p>
        <p className="text-coffee-800 font-display font-bold text-lg">No shop linked</p>
        <p className="text-coffee-400 text-sm leading-relaxed">
          Your account isn't linked to a shop yet. If you claimed a shop, we'll set you up once verified.
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
    setActiveTab(tab)
    setSidebarOpen(false)
  }

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-56 bg-white border-r border-gray-200 z-30 flex flex-col transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="font-display text-base font-bold text-coffee-900 truncate">{shop.name}</p>
          <p className="text-xs text-coffee-400 mt-0.5">Owner Portal</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === item.id ? 'bg-caramel/10 text-caramel' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-gray-100 pt-3">
          <button
            onClick={() => { window.location.href = '/' }}
            className="w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-left transition-colors"
          >
            ← Back to app
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}
            className="w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-left transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="p-1 rounded-md text-gray-500 hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-display text-base font-semibold text-coffee-900">
            {NAV.find(n => n.id === activeTab)?.label}
          </span>
          <div className="w-7" />
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {activeTab === 'dashboard' && <PortalDashboard shop={shop} />}
          {activeTab === 'mentions' && <PortalMentions shop={shop} />}
          {activeTab === 'edit' && <PortalEditShop shop={shop} onShopUpdate={s => setShop(s)} />}
          {activeTab === 'posts' && <PortalPosts shop={shop} userId={userId} />}
          {activeTab === 'messages' && <PortalMessages shop={shop} userId={userId} />}
          {activeTab === 'settings' && (
            <PortalSettings
              shopOwner={shopOwner}
              onUpdate={o => setShopOwner(o)}
            />
          )}
        </main>
      </div>
    </div>
  )
}
