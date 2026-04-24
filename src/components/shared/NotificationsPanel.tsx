import { useState, useEffect, useRef } from 'react'
import { X, Bell } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import CoffeeDateInbox from './CoffeeDateInbox'
import { useAuth } from '../../contexts/AuthContext'
import { registerPushNotifications } from '../../lib/push'

type Notification = {
  id: string
  type: 'like' | 'comment' | 'follow' | 'new_post' | 'mention' | 'coffee_date' | 'story'
  content?: string
  read: boolean
  created_at: string
  actor_id: string
  rating_id?: string
  actor: { username: string; avatar_url: string | null }
  rating?: { fill_level: number; coffee_shops: { name: string } | null }
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m/60)}h`
  return `${Math.floor(m/1440)}d`
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'like') return <span className="text-base">❤️</span>
  if (type === 'comment') return <span className="text-base">💬</span>
  if (type === 'follow') return <span className="text-base">👥</span>
  if (type === 'mention') return <span className="text-base">@</span>
  if (type === 'new_post') return <span className="text-base">☕</span>
  if (type === 'coffee_date') return <span className="text-base">📅</span>
  if (type === 'story') return <span className="text-base">🟡</span>
  return <span className="text-base">🔔</span>
}

function notifText(n: Notification) {
  if (n.type === 'like') return 'liked your post'
  if (n.type === 'comment') return 'commented on your post'
  if (n.type === 'follow') return 'started following you'
  if (n.type === 'mention') return 'mentioned you in a comment'
  if (n.type === 'coffee_date') return n.content || 'invited you for a coffee date'
  if (n.type === 'story') return 'posted a new story'
  if (n.type === 'new_post') {
    const shop = (n.rating?.coffee_shops as any)?.name
    return shop ? `posted a brew at ${shop}` : 'posted a new brew'
  }
  const shop = (n.rating?.coffee_shops as any)?.name
  return shop ? `posted at ${shop}` : 'posted a new brew'
}

export function NotificationBell({ onNavigate, onOpen }: { onNavigate?: (type: string, id: string) => void; onOpen?: () => void }) {
  const { profile } = useAuth()
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [showDateInbox, setShowDateInbox] = useState(false)
  const [pendingDates, setPendingDates] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [tableExists, setTableExists] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profile || !tableExists) return
    async function loadCount() {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile!.id)
          .eq('read', false)
        if (error) { setTableExists(false); return }
        setUnread(count || 0)
      } catch { setTableExists(false) }
      // Also load pending coffee dates
      try {
        const { count: dateCount } = await supabase
          .from('coffee_dates')
          .select('*', { count: 'exact', head: true })
          .eq('recipient_id', profile!.id)
          .eq('status', 'pending')
        setPendingDates(dateCount || 0)
      } catch {}
    }
    loadCount()
    let channel: any = null
    try {
      channel = supabase
        .channel('notifs-' + profile.id)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
          () => { setUnread(prev => prev + 1) })
        .subscribe()
    } catch { /* silent fail */ }
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [profile, tableExists])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  async function openPanel() {
    setOpen(true)
    onOpen?.()
    if (!profile || !tableExists) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*, actor:actor_id(username, avatar_url), rating:rating_id(fill_level, coffee_shops(name))')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(30)
      if (data) setNotifications(data as any)
      // Mark all as read
      await supabase.from('notifications').update({ read: true }).eq('user_id', profile.id).eq('read', false)
      setUnread(0)
    } catch { /* silent */ }
    setLoading(false)
  }

  if (!tableExists) return null

  return (
    <>
    {showDateInbox && <CoffeeDateInbox onClose={() => { setShowDateInbox(false); setPendingDates(0) }} />}
    <div className="relative flex items-center gap-1" ref={panelRef}>
      {/* Coffee date inbox button */}
      <button
        onClick={() => setShowDateInbox(true)}
        className="relative w-9 h-9 flex items-center justify-center text-coffee-500 hover:text-caramel transition-colors"
      >
        <span className="text-lg">📅</span>
        {pendingDates > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <span className="text-white font-bold" style={{ fontSize: 9 }}>{pendingDates}</span>
          </span>
        )}
      </button>
      <button onClick={() => open ? setOpen(false) : openPanel()}
        className="relative w-9 h-9 flex items-center justify-center text-coffee-500 hover:text-caramel transition-colors">
        <Bell size={22} />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold" style={{ fontSize: 9 }}>{unread > 9 ? '9+' : unread}</span>
          </span>
        )}
      </button>

      {/* Dropdown panel — fixed to viewport, safe area aware */}
      {open && (
        <div className="fixed bg-white rounded-2xl shadow-2xl border border-cream-200 overflow-hidden"
          style={{ 
            maxHeight: 'calc(70vh - env(safe-area-inset-bottom, 0px))',
            width: 'min(320px, calc(100vw - 24px))',
            top: 'calc(60px + env(safe-area-inset-top, 0px))',
            right: 'max(12px, env(safe-area-inset-right, 12px))',
            zIndex: 9999,
          }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-cream-200 bg-cream-50">
            <h3 className="font-display font-bold text-coffee-800 text-base">Notifications</h3>
            <button onClick={() => setOpen(false)} className="w-6 h-6 rounded-full bg-cream-200 flex items-center justify-center text-coffee-500">
              <X size={12} />
            </button>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 52px)' }}>
            {/* FOMO nudge — shown when user has notifications but no push token */}
            {!loading && !(profile as any)?.push_token && notifications.length > 0 && (
              <div className="mx-3 mt-3 mb-1 rounded-xl p-3 flex items-center gap-3"
                style={{ background: 'rgba(200,133,58,0.08)', border: '1px solid rgba(200,133,58,0.2)' }}>
                <span className="text-lg flex-shrink-0">🔔</span>
                <div className="flex-1 min-w-0">
                  <p className="text-coffee-800 font-semibold text-xs">Get these on your lock screen</p>
                  <p className="text-coffee-500 text-xs leading-snug">You're missing notifications when the app is closed.</p>
                </div>
                <button
                  onClick={() => { if (profile) registerPushNotifications(profile.id) }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-white text-xs font-semibold"
                  style={{ background: '#c8853a' }}>
                  Enable
                </button>
              </div>
            )}
            {loading && (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
              </div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="text-center py-10 px-4">
                <p className="text-3xl mb-2">🔔</p>
                <p className="text-coffee-500 font-medium text-sm">No notifications yet</p>
                <p className="text-coffee-400 text-xs mt-1">Activity from friends will appear here</p>
                {'Notification' in window && Notification.permission === 'default' && (
                  <button onClick={async () => { if (profile) await registerPushNotifications(profile.id) }}
                    className="mt-4 px-4 py-2 bg-caramel text-white rounded-full text-xs font-semibold">
                    Enable push notifications 🔔
                  </button>
                )}
              </div>
            )}
            {notifications.map(n => (
              <button key={n.id}
                onClick={() => {
                  setOpen(false)
                  if (!onNavigate) return
                  if (n.type === 'follow') onNavigate('profile', n.actor_id)
                  if (n.type === 'coffee_date') onNavigate?.('profile', n.actor_id)
                  if (n.type === 'story') onNavigate?.('profile', n.actor_id)
                  else if (n.rating_id) onNavigate('post', n.rating_id)
                }}
                className={`w-full flex items-start gap-3 px-4 py-3 border-b border-cream-100 transition-colors text-left ${!n.read ? 'bg-amber-50' : 'bg-white'} hover:bg-cream-50`}>
                <div className="relative flex-shrink-0" style={{ minWidth: 36 }}>
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-coffee-200">
                    {n.actor?.avatar_url
                      ? <img src={n.actor.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center bg-caramel">
                          <span className="text-white text-sm font-bold">{n.actor?.username?.[0]?.toUpperCase()}</span>
                        </div>}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white flex items-center justify-center" style={{ fontSize: 10 }}>
                    <NotifIcon type={n.type} />
                  </div>
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-coffee-700 text-sm leading-snug">
                    <span className="font-semibold">{n.actor?.username}</span>{' '}
                    <span className="text-coffee-500">{notifText(n)}</span>
                  </p>
                  <p className="text-coffee-400 text-xs mt-0.5">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && <div className="w-2 h-2 rounded-full bg-caramel mt-1.5 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
    </>
  )
}
