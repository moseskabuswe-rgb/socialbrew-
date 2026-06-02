// src/components/shared/AdminBroadcast.tsx
// Hidden admin panel — only visible to Moses

import { useState, useEffect } from 'react'
import { Send, X, CreditCard } from 'lucide-react'
import { sendBroadcastNotification, sendPushToUser } from '../../lib/push'
import { supabase } from '../../lib/supabase'

const ADMIN_USER_ID = '47e5480e-e592-44bc-9b34-1111af76ea0e'

interface Props {
  currentUserId: string
  onClose: () => void
}

interface ShopOwnerRow {
  id: string
  user_id: string
  punch_card_quota: number
  punches_issued_this_month: number
  punches_issued_total: number
  founding_partner: boolean
  profiles: { username: string; avatar_url: string | null }
  coffee_shops: { name: string; city: string | null }
}

export default function AdminBroadcast({ currentUserId, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'notifications' | 'punch-cards'>('notifications')

  // Notifications state
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetId, setTargetId] = useState('')
  const [mode, setMode] = useState<'broadcast' | 'single'>('broadcast')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  // Punch Cards state
  const [shopOwners, setShopOwners] = useState<ShopOwnerRow[]>([])
  const [pcLoading, setPcLoading] = useState(false)
  const [pcSearch, setPcSearch] = useState('')
  const [quotaInputs, setQuotaInputs] = useState<Record<string, number>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveResults, setSaveResults] = useState<Record<string, string>>({})

  useEffect(() => {
    if (currentUserId !== ADMIN_USER_ID || activeTab !== 'punch-cards') return
    setPcLoading(true)
    supabase
      .from('shop_owners')
      .select('id, user_id, punch_card_quota, punches_issued_this_month, punches_issued_total, founding_partner, profiles(username, avatar_url), coffee_shops(name, city)')
      .then(({ data }) => {
        const rows = (data || []) as unknown as ShopOwnerRow[]
        setShopOwners(rows)
        const inputs: Record<string, number> = {}
        rows.forEach(r => { inputs[r.id] = r.punch_card_quota ?? 0 })
        setQuotaInputs(inputs)
        setPcLoading(false)
      })
  }, [activeTab, currentUserId])

  if (currentUserId !== ADMIN_USER_ID) return null

  function fillApology() {
    setTitle('A note from Social Brew ☕')
    setMessage("We hit a database issue during a migration that wiped recent posts. Really sorry about that. Your next brew matters — we're back and better than ever.")
    setMode('broadcast')
  }

  function fillWelcomeBack() {
    setTitle('Social Brew is back! ☕')
    setMessage("New shops added, bugs fixed, and the app is running better than ever. Come share your next coffee visit!")
    setMode('broadcast')
  }

  async function handleSend() {
    if (!title.trim() || !message.trim()) return
    setLoading(true)
    setResult('')
    try {
      if (mode === 'broadcast') {
        await sendBroadcastNotification(title, message, { type: 'broadcast' })
        setResult('✓ Sent to all users!')
      } else {
        if (!targetId.trim()) { setResult('Enter a user ID'); setLoading(false); return }
        await sendPushToUser(targetId.trim(), title, message, { type: 'direct' })
        setResult('✓ Sent!')
      }
      setTimeout(() => { setTitle(''); setMessage(''); setTargetId(''); setResult('') }, 3000)
    } catch (e) {
      setResult('Error sending — check Edge Function logs')
    } finally {
      setLoading(false)
    }
  }

  const filteredOwners = shopOwners.filter(o => {
    if (!pcSearch.trim()) return true
    const q = pcSearch.toLowerCase()
    return (
      o.coffee_shops?.name?.toLowerCase().includes(q) ||
      o.profiles?.username?.toLowerCase().includes(q) ||
      (o.coffee_shops?.city ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full rounded-t-3xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-xl font-bold text-coffee-800">⚙️ Admin Panel</h2>
            <p className="text-coffee-400 text-xs mt-0.5">Admin only</p>
          </div>
          <button onClick={onClose} className="text-coffee-400 p-1"><X size={22} /></button>
        </div>

        {/* Tab bar */}
        <div className="flex rounded-xl bg-cream-100 p-1 mb-5">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'notifications' ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'}`}
          >
            <Send size={13} /> Notifications
          </button>
          <button
            onClick={() => setActiveTab('punch-cards')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'punch-cards' ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'}`}
          >
            <CreditCard size={13} /> Punch Cards
          </button>
        </div>

        {/* Notifications tab */}
        {activeTab === 'notifications' && (
          <>
            {/* Mode toggle */}
            <div className="flex rounded-xl bg-cream-100 p-1 mb-4">
              {(['broadcast', 'single'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === m ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'}`}
                >
                  {m === 'broadcast' ? 'All users' : 'One user'}
                </button>
              ))}
            </div>

            {mode === 'single' && (
              <div className="mb-3">
                <label className="text-coffee-500 text-xs font-medium block mb-1">User UUID</label>
                <input
                  value={targetId}
                  onChange={e => setTargetId(e.target.value)}
                  placeholder="Paste user UUID..."
                  className="w-full border border-cream-200 rounded-xl px-3 py-2.5 text-sm text-coffee-800 focus:outline-none focus:border-caramel"
                />
              </div>
            )}

            <div className="mb-3">
              <label className="text-coffee-500 text-xs font-medium block mb-1">Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Notification title..."
                className="w-full border border-cream-200 rounded-xl px-3 py-2.5 text-sm text-coffee-800 focus:outline-none focus:border-caramel"
              />
            </div>

            <div className="mb-4">
              <label className="text-coffee-500 text-xs font-medium block mb-1">Message</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Notification body..."
                rows={3}
                className="w-full border border-cream-200 rounded-xl px-3 py-2.5 text-sm text-coffee-800 focus:outline-none focus:border-caramel resize-none"
              />
            </div>

            {/* Quick fill buttons */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={fillApology}
                className="flex-1 border border-dashed border-caramel text-caramel rounded-xl py-2 text-xs font-medium"
              >
                ☕ Apology message
              </button>
              <button
                onClick={fillWelcomeBack}
                className="flex-1 border border-dashed border-coffee-400 text-coffee-500 rounded-xl py-2 text-xs font-medium"
              >
                🎉 Welcome back
              </button>
            </div>

            {result && (
              <p className={`text-sm font-medium mb-3 text-center ${result.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
                {result}
              </p>
            )}

            <button
              onClick={handleSend}
              disabled={loading || !title.trim() || !message.trim()}
              className="w-full bg-caramel text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
            >
              {loading ? 'Sending...' : <><Send size={16} /> {mode === 'broadcast' ? `Send to all users` : 'Send to user'}</>}
            </button>
          </>
        )}

        {/* Punch Cards tab */}
        {activeTab === 'punch-cards' && (
          <>
            <input
              value={pcSearch}
              onChange={e => setPcSearch(e.target.value)}
              placeholder="Search by shop, owner, or city..."
              className="w-full border border-cream-200 rounded-xl px-3 py-2.5 text-sm text-coffee-800 focus:outline-none focus:border-caramel mb-4"
            />

            {pcLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
              </div>
            ) : filteredOwners.length === 0 ? (
              <p className="text-coffee-400 text-sm text-center py-8">No shops found</p>
            ) : (
              <div className="space-y-3">
                {filteredOwners.map(o => (
                  <div key={o.id} className="bg-cream-50 border border-cream-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                        {o.profiles?.avatar_url
                          ? <img src={o.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center bg-caramel">
                              <span className="text-white text-xs font-bold">{o.profiles?.username?.[0]?.toUpperCase()}</span>
                            </div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-coffee-700 font-semibold text-sm truncate">{o.coffee_shops?.name}</p>
                        <p className="text-coffee-400 text-xs">@{o.profiles?.username}{o.coffee_shops?.city ? ` · ${o.coffee_shops.city}` : ''}</p>
                      </div>
                      {o.founding_partner && (
                        <span className="bg-caramel/10 text-caramel text-xs font-bold px-2 py-0.5 rounded-full border border-caramel/20 flex-shrink-0">⭐ Founding</span>
                      )}
                    </div>

                    <div className="flex gap-3 text-xs text-coffee-500 mb-3">
                      <span>Quota: <span className="font-semibold text-coffee-700">{o.punch_card_quota}</span></span>
                      <span>This month: <span className="font-semibold text-coffee-700">{o.punches_issued_this_month}</span></span>
                      <span>Total: <span className="font-semibold text-coffee-700">{o.punches_issued_total}</span></span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        value={quotaInputs[o.id] ?? o.punch_card_quota}
                        onChange={e => setQuotaInputs(q => ({ ...q, [o.id]: Number(e.target.value) }))}
                        className="flex-1 border border-cream-200 rounded-xl px-3 py-2 text-sm text-coffee-800 focus:outline-none focus:border-caramel"
                      />
                      <button
                        disabled={savingId === o.id}
                        onClick={async () => {
                          const ownerId = o.id
                          setSavingId(ownerId)
                          const { error } = await supabase
                            .from('shop_owners')
                            .update({
                              punch_card_quota: quotaInputs[ownerId] ?? 0,
                              punch_card_quota_set_by: currentUserId,
                              punch_card_quota_set_at: new Date().toISOString(),
                            })
                            .eq('id', ownerId)
                          setSavingId(null)
                          setSaveResults(r => ({ ...r, [ownerId]: error ? '✗ Error' : '✓ Saved' }))
                          setTimeout(() => setSaveResults(r => { const n = { ...r }; delete n[ownerId]; return n }), 2000)
                          if (!error) {
                            setShopOwners(s => s.map(row => row.id === ownerId ? { ...row, punch_card_quota: quotaInputs[ownerId] ?? 0 } : row))
                          }
                        }}
                        className="px-4 py-2 bg-caramel text-white rounded-xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-transform"
                      >
                        {savingId === o.id ? '...' : saveResults[o.id] || 'Grant'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
