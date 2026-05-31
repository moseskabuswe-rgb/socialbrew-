import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import OverviewTab from './tabs/OverviewTab'
import UsersTab from './tabs/UsersTab'
import ShopsTab from './tabs/ShopsTab'
import ApprovalsTab from './tabs/ApprovalsTab'
import ReportsTab from './tabs/ReportsTab'
import BroadcastTab from './tabs/BroadcastTab'

export type AdminTab = 'overview' | 'users' | 'shops' | 'approvals' | 'reports' | 'broadcast'

interface Props {
  profile: { id: string; username: string; role: string }
  onClose?: () => void
}

interface PendingCounts {
  claims: number
  edits: number
  reports: number
  punchCards: number
}

function Badge({ n }: { n: number }) {
  if (!n) return null
  return (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
      {n > 99 ? '99+' : n}
    </span>
  )
}

function MugLogo() {
  return (
    <svg viewBox="0 0 56 68" width={28} height={34} style={{ flexShrink: 0 }}>
      <defs>
        <clipPath id="admin-mug-clip">
          <rect x="5" y="12" width="38" height="46" rx="5" />
        </clipPath>
      </defs>
      <rect x="5" y="12" width="38" height="46" rx="5" fill="#f7f0e4" stroke="#c8b090" strokeWidth="1.5" />
      <g clipPath="url(#admin-mug-clip)">
        <rect x="5" y="35" width="38" height="23" fill="#c8853a" />
      </g>
      <rect x="3" y="8" width="42" height="8" rx="4" fill="#d4b890" />
      <path d="M43 22 Q56 22 56 33 Q56 44 43 44" stroke="#c8b090" strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="24" cy="58" rx="19" ry="5" fill="#e8ddc8" />
    </svg>
  )
}

const NAV_ITEMS: { id: AdminTab; label: string; icon: string; adminOnly?: boolean }[] = [
  { id: 'overview',  label: 'Overview',   icon: '📊' },
  { id: 'users',     label: 'Users',      icon: '👥' },
  { id: 'shops',     label: 'Shops',      icon: '☕' },
  { id: 'approvals', label: 'Approvals',  icon: '✅' },
  { id: 'reports',   label: 'Reports',    icon: '🚨' },
  { id: 'broadcast', label: 'Broadcast',  icon: '📣', adminOnly: true },
]

export default function AdminLayout({ profile, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [pending, setPending] = useState<PendingCounts>({ claims: 0, edits: 0, reports: 0, punchCards: 0 })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isAdmin = profile.role === 'admin'
  const isViewer = profile.role === 'viewer'

  async function fetchPending() {
    const [claims, edits, userReports, shopReports, punchCardsRes] = await Promise.all([
      supabase.from('shop_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('shop_edit_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false),
      supabase.from('shop_post_reports').select('id', { count: 'exact', head: true }).eq('resolved', false),
      supabase.from('punch_cards').select('id', { count: 'exact', head: true }).eq('is_active', false).is('approved_by', null),
    ])
    setPending({
      claims: claims.count || 0,
      edits: edits.count || 0,
      reports: (userReports.count || 0) + (shopReports.count || 0),
      punchCards: punchCardsRes.count || 0,
    })
  }

  useEffect(() => {
    fetchPending()
    const channel = supabase
      .channel('admin-pending')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_claims' }, fetchPending)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_edit_submissions' }, fetchPending)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, fetchPending)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_post_reports' }, fetchPending)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'punch_cards' }, fetchPending)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const totalPending = pending.claims + pending.edits + pending.reports + pending.punchCards

  function pendingForTab(tab: AdminTab) {
    if (tab === 'approvals') return pending.claims + pending.edits + pending.punchCards
    if (tab === 'reports') return pending.reports
    return 0
  }

  function handleTabChange(tab: AdminTab) {
    setActiveTab(tab)
    setSidebarOpen(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const visibleNav = NAV_ITEMS.filter(item => {
    if (isViewer) return item.id === 'overview'
    if (item.adminOnly) return isAdmin
    return true
  })

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#fdfaf5' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-56 z-30 flex flex-col transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}
        style={{ background: '#fdfaf5', borderRight: '1px solid #e8ddc8' }}
      >
        {/* Logo */}
        <div className="px-4 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #e8ddc8' }}>
          <MugLogo />
          <div>
            <p className="font-display text-sm font-bold text-coffee-900 leading-tight">Social Brew</p>
            <p className="text-[10px] text-coffee-400 mt-0.5">Admin</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {visibleNav.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === item.id
                  ? 'bg-caramel/10 text-caramel'
                  : 'text-coffee-600 hover:bg-cream-100'
                }`}
            >
              <span className="flex items-center gap-2.5">
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </span>
              <Badge n={pendingForTab(item.id)} />
            </button>
          ))}
        </nav>

        <div className="px-3 pb-4 pt-3" style={{ borderTop: '1px solid #e8ddc8' }}>
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-medium text-coffee-700 truncate">{profile.username}</p>
            <p className="text-[10px] text-coffee-400 capitalize">{profile.role}</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-full px-3 py-2 rounded-lg text-sm text-coffee-500 hover:bg-cream-100 hover:text-coffee-700 text-left transition-colors"
            >
              ← Back to app
            </button>
          )}
          <button
            onClick={handleSignOut}
            className="w-full px-3 py-2 rounded-lg text-sm text-coffee-500 hover:bg-cream-100 hover:text-coffee-700 text-left transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <header
          className="lg:hidden flex items-center justify-between px-4 py-3"
          style={{ background: '#fdfaf5', borderBottom: '1px solid #e8ddc8' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 rounded-md text-coffee-500 hover:bg-cream-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-display text-base font-semibold text-coffee-900">
            {NAV_ITEMS.find(n => n.id === activeTab)?.label}
            {totalPending > 0 && <Badge n={totalPending} />}
          </span>
          <div className="w-7" />
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {activeTab === 'overview' && (
            <OverviewTab pending={pending} onNavigate={handleTabChange} isAdmin={isAdmin} isViewer={isViewer} />
          )}
          {activeTab === 'users' && <UsersTab isAdmin={isAdmin} currentUserId={profile.id} />}
          {activeTab === 'shops' && <ShopsTab isAdmin={isAdmin} />}
          {activeTab === 'approvals' && <ApprovalsTab isAdmin={isAdmin} currentUserId={profile.id} onPendingChange={fetchPending} />}
          {activeTab === 'reports' && <ReportsTab currentUserId={profile.id} onPendingChange={fetchPending} />}
          {activeTab === 'broadcast' && isAdmin && <BroadcastTab currentUserId={profile.id} />}
        </main>
      </div>
    </div>
  )
}
