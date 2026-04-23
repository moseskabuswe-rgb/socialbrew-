// src/components/shared/CoffeeDateInbox.tsx
// Shows incoming and outgoing coffee date invites with accept/decline

import { useState, useEffect } from 'react'
import { X, MapPin, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { sendPushToUser } from '../../lib/push'

interface CoffeeDate {
  id: string
  sender_id: string
  recipient_id: string
  shop_id: string
  message: string | null
  status: 'pending' | 'accepted' | 'declined'
  proposed_time: string | null
  created_at: string
  sender?: { username: string; avatar_url: string | null }
  recipient?: { username: string; avatar_url: string | null }
  coffee_shops?: { name: string; city: string; state: string | null; photo_url: string | null }
}

interface Props {
  onClose: () => void
}

export default function CoffeeDateInbox({ onClose }: Props) {
  const { profile } = useAuth()
  const [incoming, setIncoming] = useState<CoffeeDate[]>([])
  const [outgoing, setOutgoing] = useState<CoffeeDate[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming')
  const [responding, setResponding] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    load()

    // Realtime updates for status changes
    const channel = supabase
      .channel('coffee-dates-' + profile.id)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'coffee_dates',
      }, () => load())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'coffee_dates',
      }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  async function load() {
    if (!profile) return

    const [inRes, outRes] = await Promise.all([
      supabase
        .from('coffee_dates')
        .select('*, sender:sender_id(username, avatar_url), coffee_shops(name, city, state, photo_url)')
        .eq('recipient_id', profile.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('coffee_dates')
        .select('*, recipient:recipient_id(username, avatar_url), coffee_shops(name, city, state, photo_url)')
        .eq('sender_id', profile.id)
        .order('created_at', { ascending: false }),
    ])

    setIncoming((inRes.data || []) as CoffeeDate[])
    setOutgoing((outRes.data || []) as CoffeeDate[])
    setLoading(false)
  }

  async function respond(dateId: string, status: 'accepted' | 'declined', date: CoffeeDate) {
    if (!profile) return
    setResponding(dateId)

    const { error } = await supabase
      .from('coffee_dates')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', dateId)
      .eq('recipient_id', profile.id) // Security: only recipient can update

    if (!error) {
      // Notify sender of response
      const shopName = date.coffee_shops?.name || 'the shop'
      const statusText = status === 'accepted' ? 'accepted' : 'declined'
      const emoji = status === 'accepted' ? '✅' : '❌'

      await supabase.from('notifications').insert({
        user_id: date.sender_id,
        actor_id: profile.id,
        type: 'coffee_date',
        content: `${profile.username} ${statusText} your coffee date at ${shopName}`,
      })

      try {
        await sendPushToUser(
          date.sender_id,
          `${emoji} Coffee Date ${status === 'accepted' ? 'Accepted!' : 'Declined'}`,
          `${profile.username} ${statusText} your invite to ${shopName}`,
          { type: 'coffee_date_response', status }
        )
      } catch {}

      await load()
    }

    setResponding(null)
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = (now.getTime() - d.getTime()) / 1000 / 60
    if (diff < 60) return `${Math.floor(diff)}m ago`
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
    return d.toLocaleDateString()
  }

  function StatusBadge({ status }: { status: string }) {
    if (status === 'pending') return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">Pending</span>
    )
    if (status === 'accepted') return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">✅ Accepted</span>
    )
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">❌ Declined</span>
    )
  }

  const pendingCount = incoming.filter(d => d.status === 'pending').length

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.9)' }}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up" style={{ maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <div>
            <h3 className="font-display font-bold text-coffee-800 text-lg">Coffee Dates</h3>
            {pendingCount > 0 && (
              <p className="text-caramel text-xs font-medium">{pendingCount} pending invite{pendingCount !== 1 ? 's' : ''}</p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500">
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-cream-200">
          <button
            onClick={() => setTab('incoming')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${tab === 'incoming' ? 'text-caramel' : 'text-coffee-400'}`}
          >
            Received
            {pendingCount > 0 && (
              <span className="absolute top-2 right-6 w-4 h-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center" style={{ fontSize: 9 }}>
                {pendingCount}
              </span>
            )}
            {tab === 'incoming' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-caramel" />}
          </button>
          <button
            onClick={() => setTab('outgoing')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${tab === 'outgoing' ? 'text-caramel' : 'text-coffee-400'}`}
          >
            Sent
            {tab === 'outgoing' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-caramel" />}
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 130px)' }}>
          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
            </div>
          )}

          {!loading && tab === 'incoming' && incoming.length === 0 && (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">☕</p>
              <p className="text-coffee-500 font-display text-lg">No invites yet</p>
              <p className="text-coffee-400 text-sm mt-1">When someone invites you for coffee, it'll appear here</p>
            </div>
          )}

          {!loading && tab === 'outgoing' && outgoing.length === 0 && (
            <div className="text-center py-16">
              <p className="text-4xl mb-3">📅</p>
              <p className="text-coffee-500 font-display text-lg">No invites sent</p>
              <p className="text-coffee-400 text-sm mt-1">Invite a friend from any shop page</p>
            </div>
          )}

          {/* Incoming invites */}
          {!loading && tab === 'incoming' && incoming.map(date => (
            <div key={date.id} className="px-5 py-4 border-b border-cream-100">
              {/* Shop + sender */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-coffee-100 flex-shrink-0">
                  {date.coffee_shops?.photo_url
                    ? <img src={date.coffee_shops.photo_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xl">☕</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-coffee-800 font-bold text-sm">{date.coffee_shops?.name}</p>
                    <StatusBadge status={date.status} />
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin size={10} className="text-coffee-400" />
                    <p className="text-coffee-400 text-xs">{date.coffee_shops?.city}{date.coffee_shops?.state ? `, ${date.coffee_shops.state}` : ''}</p>
                  </div>
                </div>
              </div>

              {/* Sender info */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                  {(date.sender as any)?.avatar_url
                    ? <img src={(date.sender as any).avatar_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white" style={{ fontSize: 8 }}>{(date.sender as any)?.username?.[0]?.toUpperCase()}</span></div>}
                </div>
                <p className="text-coffee-600 text-xs">
                  <span className="font-semibold">@{(date.sender as any)?.username}</span> invited you · {formatDate(date.created_at)}
                </p>
              </div>

              {/* Proposed time */}
              {date.proposed_time && (
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock size={11} className="text-coffee-400" />
                  <p className="text-coffee-600 text-xs">{date.proposed_time}</p>
                </div>
              )}

              {/* Message */}
              {date.message && (
                <p className="text-coffee-500 text-xs italic mb-3 bg-cream-50 rounded-xl px-3 py-2">"{date.message}"</p>
              )}

              {/* Accept/Decline — only for pending */}
              {date.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(date.id, 'declined', date)}
                    disabled={responding === date.id}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-cream-300 text-coffee-600 active:scale-95 transition-all disabled:opacity-40"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => respond(date.id, 'accepted', date)}
                    disabled={responding === date.id}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white active:scale-95 transition-all disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
                  >
                    {responding === date.id ? '...' : '✅ Accept'}
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Outgoing invites */}
          {!loading && tab === 'outgoing' && outgoing.map(date => (
            <div key={date.id} className="px-5 py-4 border-b border-cream-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-coffee-100 flex-shrink-0">
                  {date.coffee_shops?.photo_url
                    ? <img src={date.coffee_shops.photo_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xl">☕</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-coffee-800 font-bold text-sm">{date.coffee_shops?.name}</p>
                    <StatusBadge status={date.status} />
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin size={10} className="text-coffee-400" />
                    <p className="text-coffee-400 text-xs">{date.coffee_shops?.city}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                  {(date.recipient as any)?.avatar_url
                    ? <img src={(date.recipient as any).avatar_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white" style={{ fontSize: 8 }}>{(date.recipient as any)?.username?.[0]?.toUpperCase()}</span></div>}
                </div>
                <p className="text-coffee-600 text-xs">
                  Invited <span className="font-semibold">@{(date.recipient as any)?.username}</span> · {formatDate(date.created_at)}
                </p>
              </div>

              {date.proposed_time && (
                <div className="flex items-center gap-1.5">
                  <Clock size={11} className="text-coffee-400" />
                  <p className="text-coffee-600 text-xs">{date.proposed_time}</p>
                </div>
              )}

              {date.message && (
                <p className="text-coffee-500 text-xs italic mt-2 bg-cream-50 rounded-xl px-3 py-2">"{date.message}"</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
