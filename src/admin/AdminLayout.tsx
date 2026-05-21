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
}

interface PendingCounts {
  claims: number
  edits: number
  shopPosts: number
  reports: number
}

function Badge({ n }: { n: number }) {
  if (!n) return null
  return (
    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
      {n > 99 ? '99+' : n}
    </span>
  )
}

const NAV_ITEMS: { id: AdminTab; label: string; adminOnly?: boolean }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'shops', label: 'Shops' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'reports', label: 'Reports' },
  { id: 'broadcast', label: 'Broadcast', adminOnly: true },
]

export default function AdminLayout({ profile }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [pending, setPending] = useState<PendingCounts>({ claims: 0, edits: 0, shopPosts: 0, reports: 0 })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isAdmin = profile.role === 'admin'

  async function fetchPending() {
    const [claims, edits, shopPosts, userReports, shopReports] = await Promise.all([
      supabase.from('shop_claims').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('shop_edit_submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('shop_posts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false),
      supabase.from('shop_post_reports').select('id', { count: 'exact', head: true }).eq('resolved', false),
    ])
    setPending({
      claims: claims.count || 0,
      edits: edits.count || 0,
      shopPosts: shopPosts.count || 0,
      reports: (userReports.count || 0) + (shopReports.count || 0),
    })
  }

  useEffect(() => {
    fetchPending()
    const channel = supabase
      .channel('admin-pending')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_claims' }, fetchPending)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_edit_submissions' }, fetchPending)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_posts' }, fetchPending)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, fetchPending)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_post_reports' }, fetchPending)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const totalPending = pending.claims + pending.edits + pending.shopPosts + pending.reports

  function pendingForTab(tab: AdminTab) {
    if (tab === 'approvals') return pending.claims + pending.edits + pending.shopPosts
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

  const visibleNav = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin)

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-56 bg-white border-r border-gray-200 z-30 flex flex-col transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}
      >
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="font-display text-lg font-bold text-coffee-900">Social Brew</p>
          <p className="text-xs text-coffee-400 mt-0.5">Admin Dashboard</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {visibleNav.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${activeTab === item.id
                  ? 'bg-caramel/10 text-caramel'
                  : 'text-gray-600 hover:bg-gray-100'
                }`}
            >
              <span>{item.label}</span>
              <Badge n={pendingForTab(item.id)} />
            </button>
          ))}
        </nav>

        <div className="px-3 pb-4 border-t border-gray-100 pt-3">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-medium text-gray-700 truncate">{profile.username}</p>
            <p className="text-[10px] text-gray-400 capitalize">{profile.role}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-left transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100"
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
            <OverviewTab pending={pending} onNavigate={handleTabChange} isAdmin={isAdmin} />
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
