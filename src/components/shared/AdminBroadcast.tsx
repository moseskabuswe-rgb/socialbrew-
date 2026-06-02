// src/components/shared/AdminBroadcast.tsx
// Hidden admin panel — only visible to Moses

import { useState, useEffect } from 'react'
import { Send, X, CreditCard, Search } from 'lucide-react'
import { sendBroadcastNotification, sendPushToUser } from '../../lib/push'
import { supabase } from '../../lib/supabase'

const ADMIN_USER_ID = '47e5480e-e592-44bc-9b34-1111af76ea0e'

interface Props {
  currentUserId: string
  onClose: () => void
}

interface ShopOwner {
  id: string
  profile_id: string
  shop_id: string
  punch_card_quota: number
  punches_issued_total: number
  punches_issued_this_month: number
  founding_partner: boolean
  profiles: { username: string; avatar_url: string | null }
  coffee_shops: { name: string; city: string | null }
}

export default function AdminBroadcast({ currentUserId, onClose }: Props) {
  // Notification state
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetId, setTargetId] = useState('')
  const [notifMode, setNotifMode] = useState<'broadcast' | 'single'>('broadcast')
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifResult, setNotifResult] = useState('')

  // Punch card state
  const [tab, setTab] = useState<'notifications' | 'punchcards'>('notifications')
  const [shopOwners, setShopOwners] = useState<ShopOwner[]>([])
  const [shopSearch, setShopSearch] = useState('')
  const [loadingShops, setLoadingShops] = useState(false)
  const [quotaInputs, setQuotaInputs] = useState<Record<string, string>>({})
  const [quotaSaving, setQuotaSaving] = useState<Record<string, boolean>>({})
  const [quotaResult, setQuotaResult] = useState<Record<string, string>>({})

  if (currentUserId !== ADMIN_USER_ID) return null

  // Load shop owners when punch card tab is opened
  useEffect(() => {
    if (tab !== 'punchcards') return
    loadShopOwners()
  }, [tab])

  async function loadShopOwners() {
    setLoadingShops(true)
    const { data } = await supabase
      .from('shop_owners')
      .select('id, profile_id, shop_id, punch_card_quota, punches_issued_total, punches_issued_this_month, founding_partner, profiles(username, avatar_url), coffee_shops(name, city)')
      .order('created_at', { ascending: false })
    setShopOwners((data || []) as any[])
    setLoadingShops(false)
  }

  async function saveQuota(shopOwnerId: string, shopId: string) {
    const newQuota = parseInt(quotaInputs[shopOwnerId])
    if (isNaN(newQuota) || newQuota < 0) {
      setQuotaResult(prev => ({ ...prev, [shopOwnerId]: '❌ Invalid number' }))
      return
    }
    setQuotaSaving(prev => ({ ...prev, [shopOwnerId]: true }))
    setQuotaResult(prev => ({ ...prev, [shopOwnerId]: '' }))

    const { error } = await supabase
      .from('shop_owners')
      .update({
        punch_card_quota: newQuota,
        punch_card_quota_set_by: currentUserId,
        punch_card_quota_set_at: new Date().toISOString(),
      })
      .eq('id', shopOwnerId)

    if (error) {
      setQuotaResult(prev => ({ ...prev, [shopOwnerId]: '❌ ' + error.message }))
    } else {
      setShopOwners(prev => prev.map(o =>
        o.id === shopOwnerId ? { ...o, punch_card_quota: newQuota } : o
      ))
      setQuotaInputs(prev => ({ ...prev, [shopOwnerId]: '' }))
      setQuotaResult(prev => ({ ...prev, [shopOwnerId]: `✓ Set to ${newQuota}` }))
      setTimeout(() => setQuotaResult(prev => ({ ...prev, [shopOwnerId]: '' })), 3000)
    }

    setQuotaSaving(prev => ({ ...prev, [shopOwnerId]: false }))
  }

  // Notification helpers
  function fillApology() {
    setTitle('A note from Social Brew ☕')
    setMessage("We hit a database issue during a migration that wiped recent posts. Really sorry about that. Your next brew matters — we're back and better than ever.")
    setNotifMode('broadcast')
  }

  function fillWelcomeBack() {
    setTitle('Social Brew is back! ☕')
    setMessage("New shops added, bugs fixed, and the app is running better than ever. Come share your next coffee visit!")
    setNotifMode('broadcast')
  }

  async function handleSend() {
    if (!title.trim() || !message.trim()) return
    setNotifLoading(true)
    setNotifResult('')
    try {
      if (notifMode === 'broadcast') {
        await sendBroadcastNotification(title, message, { type: 'broadcast' })
        setNotifResult('✓ Sent to all users!')
      } else {
        if (!targetId.trim()) { setNotifResult('Enter a user ID'); setNotifLoading(false); return }
        await sendPushToUser(targetId.trim(), title, message, { type: 'direct' })
        setNotifResult('✓ Sent!')
      }
      setTimeout(() => { setTitle(''); setMessage(''); setTargetId(''); setNotifResult('') }, 3000)
    } catch {
      setNotifResult('Error sending — check Edge Function logs')
    } finally {
      setNotifLoading(false)
    }
  }

  const filteredOwners = shopOwners.filter(o => {
    if (!shopSearch.trim()) return true
    const q = shopSearch.toLowerCase()
    return (
      (o.coffee_shops?.name || '').toLowerCase().includes(q) ||
      (o.profiles?.username || '').toLowerCase().includes(q) ||
      (o.coffee_shops?.city || '').toLowerCase().includes(q)
    )
  })

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full rounded-t-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 flex-shrink-0">
          <div>
            <h2 className="font-display text-xl font-bold text-coffee-800">⚙️ Admin Panel</h2>
            <p className="text-coffee-400 text-xs mt-0.5">Moses only</p>
          </div>
          <button onClick={onClose} className="text-coffee-400 p-1"><X size={22} /></button>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-xl bg-cream-100 p-1 mx-6 mb-4 flex-shrink-0">
          <button
            onClick={() => setTab('notifications')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${tab === 'notifications' ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'}`}
          >
            <Send size={13} /> Notifications
          </button>
          <button
            onClick={() => setTab('punchcards')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${tab === 'punchcards' ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'}`}
          >
            <CreditCard size={13} /> Punch Cards
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8">

          {/* ── NOTIFICATIONS TAB ── */}
          {tab === 'notifications' && (
            <>
              {/* Mode toggle */}
              <div className="flex rounded-xl bg-cream-100 p-1 mb-4">
                {(['broadcast', 'single'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setNotifMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${notifMode === m ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'}`}
                  >
                    {m === 'broadcast' ? 'All users' : 'One user'}
                  </button>
                ))}
              </div>

              {notifMode === 'single' && (
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

              {notifResult && (
                <p className={`text-sm font-medium mb-3 text-center ${notifResult.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
                  {notifResult}
                </p>
              )}

              <button
                onClick={handleSend}
                disabled={notifLoading || !title.trim() || !message.trim()}
                className="w-full bg-caramel text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
              >
                {notifLoading ? 'Sending...' : <><Send size={16} /> {notifMode === 'broadcast' ? 'Send to all users' : 'Send to user'}</>}
              </button>
            </>
          )}

          {/* ── PUNCH CARDS TAB ── */}
          {tab === 'punchcards' && (
            <>
              <p className="text-coffee-500 text-sm mb-4">
                Set how many active punch cards each shop owner can have. Default is 50. You can grant any number.
              </p>

              {/* Search */}
              <div className="flex items-center bg-cream-50 rounded-xl px-3 py-2.5 border border-cream-200 gap-2 mb-4">
                <Search size={14} className="text-coffee-400 flex-shrink-0" />
                <input
                  value={shopSearch}
                  onChange={e => setShopSearch(e.target.value)}
                  placeholder="Search shop or owner..."
                  className="flex-1 bg-transparent text-coffee-800 text-sm placeholder-coffee-300 focus:outline-none"
                />
              </div>

              {loadingShops && (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
                </div>
              )}

              {!loadingShops && filteredOwners.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-coffee-400 text-sm">No shop owners found</p>
                  <p className="text-coffee-300 text-xs mt-1">Shops appear here once they claim their listing</p>
                </div>
              )}

              <div className="space-y-3">
                {filteredOwners.map(owner => (
                  <div key={owner.id} className="bg-cream-50 rounded-2xl p-4 border border-cream-200">
                    {/* Shop info */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                        {owner.profiles?.avatar_url
                          ? <img src={owner.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center bg-caramel">
                              <span className="text-white text-xs font-bold">{owner.profiles?.username?.[0]?.toUpperCase()}</span>
                            </div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-coffee-800 font-semibold text-sm truncate">{owner.coffee_shops?.name || 'Unknown Shop'}</p>
                        <p className="text-coffee-400 text-xs">@{owner.profiles?.username} · {owner.coffee_shops?.city || '—'}</p>
                      </div>
                      {owner.founding_partner && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">Founding</span>
                      )}
                    </div>

                    {/* Current stats */}
                    <div className="flex items-center gap-4 mb-3 text-xs text-coffee-500">
                      <span>Quota: <strong className="text-coffee-800">{owner.punch_card_quota ?? 50}</strong></span>
                      <span>Issued this month: <strong className="text-coffee-800">{owner.punches_issued_this_month ?? 0}</strong></span>
                      <span>Total: <strong className="text-coffee-800">{owner.punches_issued_total ?? 0}</strong></span>
                    </div>

                    {/* Grant quota input */}
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={quotaInputs[owner.id] ?? ''}
                        onChange={e => setQuotaInputs(prev => ({ ...prev, [owner.id]: e.target.value }))}
                        placeholder={`New quota (current: ${owner.punch_card_quota ?? 50})`}
                        className="flex-1 border border-cream-200 rounded-xl px-3 py-2 text-sm text-coffee-800 focus:outline-none focus:border-caramel bg-white"
                      />
                      <button
                        onClick={() => saveQuota(owner.id, owner.shop_id)}
                        disabled={!quotaInputs[owner.id] || quotaSaving[owner.id]}
                        className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex-shrink-0 active:scale-95 transition-all"
                        style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
                      >
                        {quotaSaving[owner.id] ? '...' : 'Grant'}
                      </button>
                    </div>

                    {quotaResult[owner.id] && (
                      <p className={`text-xs mt-2 font-medium ${quotaResult[owner.id].startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
                        {quotaResult[owner.id]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
