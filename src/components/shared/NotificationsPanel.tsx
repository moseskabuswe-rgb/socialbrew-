import { useState, useEffect } from 'react'
import { X, Bell } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

type Notification = {
  id: string
  type: 'like' | 'comment' | 'follow' | 'new_post'
  read: boolean
  created_at: string
  actor: { username: string; avatar_url: string | null }
  rating?: { fill_level: number; coffee_shops: { name: string } | null }
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'like') return <span className="text-base">❤️</span>
  if (type === 'comment') return <span className="text-base">💬</span>
  if (type === 'follow') return <span className="text-base">👥</span>
  return <span className="text-base">☕</span>
}

function notifText(n: Notification) {
  if (n.type === 'like') return 'liked your post'
  if (n.type === 'comment') return 'commented on your post'
  if (n.type === 'follow') return 'started following you'
  const shop = (n.rating?.coffee_shops as any)?.name
  return shop ? `posted a brew at ${shop}` : 'posted a new brew'
}

export function NotificationBell() {
  const { profile } = useAuth()
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const [tableExists, setTableExists] = useState(true)

  useEffect(() => {
    if (!profile || !tableExists) return

    async function loadCount() {
      try {
        const { count, error } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile!.id)
          .eq('read', false)
        if (error) {
          // Table doesn't exist yet — silently disable notifications
          setTableExists(false)
          return
        }
        setUnread(count || 0)
      } catch {
        setTableExists(false)
      }
    }
    loadCount()

    // Only set up realtime if table exists
    let channel: any = null
    try {
      channel = supabase
        .channel('notifications-' + profile.id)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
        }, () => { setUnread(prev => prev + 1) })
        .subscribe()
    } catch {
      // silently ignore
    }

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [profile, tableExists])

  async function openPanel() {
    if (!tableExists) return
    setOpen(true)
    setLoading(true)
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*, actor:actor_id(username, avatar_url), rating:rating_id(fill_level, coffee_shops(name))')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(30)
      setNotifications((data || []) as any)
      await supabase.from('notifications').update({ read: true }).eq('user_id', profile!.id).eq('read', false)
      setUnread(0)
    } catch {
      // ignore
    }
    setLoading(false)
  }

  return (
    <>
      <button onClick={openPanel} className="relative w-9 h-9 flex items-center justify-center text-coffee-500 hover:text-caramel transition-colors">
        <Bell size={22} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(8,4,1,0.7)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up flex flex-col" style={{ maxHeight: '80vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
              <h3 className="font-display font-bold text-coffee-800 text-lg">Notifications</h3>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500">
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading && <div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}
              {!loading && notifications.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">🔔</p>
                  <p className="text-coffee-500 font-display">No notifications yet</p>
                  <p className="text-coffee-400 text-sm mt-1">Follow friends to see activity here</p>
                </div>
              )}
              {notifications.map(n => (
                <div key={n.id} className={`flex items-center gap-3 px-5 py-3.5 border-b border-cream-100 ${!n.read ? 'bg-cream-50' : ''}`}>
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-coffee-200">
                      {n.actor?.avatar_url
                        ? <img src={n.actor.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center bg-caramel">
                            <span className="text-white text-sm font-bold">{n.actor?.username?.[0]?.toUpperCase()}</span>
                          </div>}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
                      <NotifIcon type={n.type} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-coffee-800 text-sm">
                      <span className="font-semibold">{n.actor?.username}</span>{' '}
                      <span className="text-coffee-500">{notifText(n)}</span>
                    </p>
                    <p className="text-coffee-400 text-xs mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-caramel flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
