// src/components/shared/AdminBroadcast.tsx
// Hidden admin panel — only visible to Moses

import { useState, useEffect, useRef } from 'react'
import { Send, X, CreditCard, Store, BadgeCheck } from 'lucide-react'
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

interface SubData {
  id?: string
  tier: string
  is_founding: boolean
  founding_started_at: string | null
  founding_expires_at: string | null
  punch_card_limit_override: number | null
  addon_punch_cards: number
  billing_cycle: string
}

interface SubShop {
  id: string
  name: string
  city: string | null
  shop_subscriptions: SubData | null
}

interface AddonRequest {
  id: string
  shop_id: string
  request_type: string
  message: string | null
  status: string
  quantity: number | null
  created_at: string
  coffee_shops: { name: string; city: string | null } | null
}

const TIER_PUNCH_DEFAULTS: Record<string, number> = { basic: 5, middle: 25, premium: 50, founding: 25 }

function requestTypeLabel(type: string): string {
  if (type === 'punch_cards') return 'Extra Punch Cards'
  if (type === 'report_weekly') return 'Weekly Report Access'
  if (type === 'report_consistency') return 'Consistency Report Access'
  if (type === 'report_custom') return 'Custom Report Access'
  if (type === 'report_monthly') return 'Monthly Report Access'
  return type
}

interface VerUser { id: string; username: string; avatar_url: string | null; verified: boolean }
interface VerShop { id: string; name: string; city: string | null; verified: boolean }

export default function AdminBroadcast({ currentUserId, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'notifications' | 'punch-cards' | 'subscriptions' | 'verified'>('notifications')

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

  // Subscriptions state
  const [subShops, setSubShops] = useState<SubShop[]>([])
  const [addonRequests, setAddonRequests] = useState<AddonRequest[]>([])
  const [subLoading, setSubLoading] = useState(false)
  const [subSearch, setSubSearch] = useState('')
  const [subEdits, setSubEdits] = useState<Record<string, Partial<SubData>>>({})
  const [subSavingId, setSubSavingId] = useState<string | null>(null)
  const [subSaveResults, setSubSaveResults] = useState<Record<string, string>>({})
  const [reqActionLoading, setReqActionLoading] = useState<string | null>(null)

  // Verified tab state
  const [verTabMode, setVerTabMode] = useState<'users' | 'shops'>('users')
  const [verUserSearch, setVerUserSearch] = useState('')
  const [verUserResults, setVerUserResults] = useState<VerUser[]>([])
  const [verShopSearch, setVerShopSearch] = useState('')
  const [verShopResults, setVerShopResults] = useState<VerShop[]>([])
  const [verLoading, setVerLoading] = useState<string | null>(null)
  const verUserDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const verShopDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  useEffect(() => {
    if (currentUserId !== ADMIN_USER_ID || activeTab !== 'subscriptions') return
    setSubLoading(true)
    Promise.all([
      supabase
        .from('coffee_shops')
        .select('id, name, city, shop_subscriptions(id, tier, is_founding, founding_started_at, founding_expires_at, punch_card_limit_override, addon_punch_cards, billing_cycle)')
        .order('name'),
      supabase
        .from('shop_addon_requests')
        .select('id, shop_id, request_type, message, status, quantity, created_at, coffee_shops(name, city)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]).then(([{ data: shops }, { data: reqs }]) => {
      const mapped = (shops || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        city: s.city,
        shop_subscriptions: Array.isArray(s.shop_subscriptions) ? (s.shop_subscriptions[0] ?? null) : (s.shop_subscriptions ?? null),
      })) as SubShop[]
      setSubShops(mapped)
      setAddonRequests((reqs || []) as unknown as AddonRequest[])
      setSubLoading(false)
    })
  }, [activeTab, currentUserId])

  useEffect(() => {
    if (currentUserId !== ADMIN_USER_ID || activeTab !== 'verified') return
    Promise.all([
      supabase.from('profiles').select('id, username, avatar_url, verified').eq('verified', true).limit(50),
      supabase.from('coffee_shops').select('id, name, city, verified').eq('verified', true).limit(50),
    ]).then(([{ data: u }, { data: s }]) => {
      setVerUserResults((u || []) as VerUser[])
      setVerShopResults((s || []) as VerShop[])
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

  async function saveSubscription(shop: SubShop) {
    const edit = subEdits[shop.id] || {}
    const tier = edit.tier ?? shop.shop_subscriptions?.tier ?? 'basic'
    const isFounding = tier === 'founding'
    const nowIso = new Date().toISOString()
    const sixMonths = new Date(Date.now() + 180 * 86400000).toISOString()

    const payload: Record<string, unknown> = {
      shop_id: shop.id,
      tier,
      is_founding: isFounding,
      founding_started_at: isFounding
        ? (shop.shop_subscriptions?.founding_started_at ?? nowIso)
        : null,
      founding_expires_at: isFounding ? sixMonths : null,
      punch_card_limit_override: edit.punch_card_limit_override !== undefined
        ? edit.punch_card_limit_override
        : shop.shop_subscriptions?.punch_card_limit_override ?? null,
      addon_punch_cards: edit.addon_punch_cards !== undefined
        ? edit.addon_punch_cards
        : (shop.shop_subscriptions?.addon_punch_cards ?? 0),
      billing_cycle: edit.billing_cycle ?? shop.shop_subscriptions?.billing_cycle ?? 'monthly',
      set_by: currentUserId,
    }

    setSubSavingId(shop.id)
    const { error } = await supabase
      .from('shop_subscriptions')
      .upsert(payload, { onConflict: 'shop_id' })
    setSubSavingId(null)
    setSubSaveResults(r => ({ ...r, [shop.id]: error ? '✗ Error' : '✓ Saved' }))
    setTimeout(() => setSubSaveResults(r => { const n = { ...r }; delete n[shop.id]; return n }), 2500)
    if (!error) {
      setSubShops(prev =>
        prev.map(s =>
          s.id === shop.id
            ? { ...s, shop_subscriptions: { ...(s.shop_subscriptions ?? {}), ...payload, id: s.shop_subscriptions?.id } as SubData }
            : s
        )
      )
      setSubEdits(e => { const n = { ...e }; delete n[shop.id]; return n })
    }
  }

  async function handleAddonRequest(req: AddonRequest, action: 'contacted' | 'approved' | 'declined') {
    setReqActionLoading(req.id)
    const update: Record<string, unknown> = {
      status: action,
      reviewed_by: action !== 'contacted' ? currentUserId : undefined,
      reviewed_at: action !== 'contacted' ? new Date().toISOString() : undefined,
    }
    await supabase.from('shop_addon_requests').update(update).eq('id', req.id)

    if (action === 'approved' && req.request_type === 'punch_cards' && req.quantity) {
      const { data: sub } = await supabase
        .from('shop_subscriptions')
        .select('addon_punch_cards')
        .eq('shop_id', req.shop_id)
        .maybeSingle()
      const current = (sub as any)?.addon_punch_cards ?? 0
      await supabase
        .from('shop_subscriptions')
        .upsert({ shop_id: req.shop_id, addon_punch_cards: current + req.quantity }, { onConflict: 'shop_id' })
    }

    setAddonRequests(prev => prev.filter(r => r.id !== req.id))
    setReqActionLoading(null)
  }

  function searchVerUsers(q: string) {
    setVerUserSearch(q)
    if (verUserDebounce.current) clearTimeout(verUserDebounce.current)
    if (!q.trim()) {
      supabase.from('profiles').select('id, username, avatar_url, verified').eq('verified', true).limit(50)
        .then(({ data }) => setVerUserResults((data || []) as VerUser[]))
      return
    }
    if (q.trim().length < 2) { setVerUserResults([]); return }
    verUserDebounce.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles').select('id, username, avatar_url, verified')
        .ilike('username', `%${q.trim()}%`).limit(10)
      setVerUserResults((data || []) as VerUser[])
    }, 300)
  }

  function searchVerShops(q: string) {
    setVerShopSearch(q)
    if (verShopDebounce.current) clearTimeout(verShopDebounce.current)
    if (!q.trim()) {
      supabase.from('coffee_shops').select('id, name, city, verified').eq('verified', true).limit(50)
        .then(({ data }) => setVerShopResults((data || []) as VerShop[]))
      return
    }
    if (q.trim().length < 2) { setVerShopResults([]); return }
    verShopDebounce.current = setTimeout(async () => {
      const { data } = await supabase
        .from('coffee_shops').select('id, name, city, verified')
        .ilike('name', `%${q.trim()}%`).limit(10)
      setVerShopResults((data || []) as VerShop[])
    }, 300)
  }

  async function toggleVerifiedUser(u: VerUser) {
    setVerLoading(u.id)
    const { error } = await supabase.from('profiles').update({ verified: !u.verified }).eq('id', u.id)
    setVerLoading(null)
    if (!error) setVerUserResults(prev => prev.map(r => r.id === u.id ? { ...r, verified: !r.verified } : r))
  }

  async function toggleVerifiedShop(s: VerShop) {
    setVerLoading(s.id)
    const { error } = await supabase.from('coffee_shops').update({ verified: !s.verified }).eq('id', s.id)
    setVerLoading(null)
    if (!error) setVerShopResults(prev => prev.map(r => r.id === s.id ? { ...r, verified: !r.verified } : r))
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

  const filteredSubShops = subShops.filter(s => {
    if (!subSearch.trim()) return true
    const q = subSearch.toLowerCase()
    return s.name.toLowerCase().includes(q) || (s.city ?? '').toLowerCase().includes(q)
  })

  const filteredRequests = addonRequests.filter(r => {
    if (!subSearch.trim()) return true
    const q = subSearch.toLowerCase()
    return (r.coffee_shops?.name ?? '').toLowerCase().includes(q) || (r.coffee_shops?.city ?? '').toLowerCase().includes(q)
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
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-cream-100 p-1 mb-5">
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'notifications' ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'}`}
          >
            <Send size={13} /> Notifications
          </button>
          <button
            onClick={() => setActiveTab('punch-cards')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'punch-cards' ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'}`}
          >
            <CreditCard size={13} /> Punch Cards
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'subscriptions' ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'}`}
          >
            <Store size={13} /> Subscriptions
          </button>
          <button
            onClick={() => setActiveTab('verified')}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'verified' ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'}`}
          >
            <BadgeCheck size={13} /> Verified
          </button>
        </div>

        {/* ── Notifications tab ──────────────────────────────────────── */}
        {activeTab === 'notifications' && (
          <>
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

        {/* ── Punch Cards tab ────────────────────────────────────────── */}
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

        {/* ── Subscriptions tab ──────────────────────────────────────── */}
        {activeTab === 'subscriptions' && (
          <>
            <input
              value={subSearch}
              onChange={e => setSubSearch(e.target.value)}
              placeholder="Search by shop or city..."
              className="w-full border border-cream-200 rounded-xl px-3 py-2.5 text-sm text-coffee-800 focus:outline-none focus:border-caramel mb-5"
            />

            {subLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
              </div>
            ) : (
              <>
                {/* Pending addon requests */}
                {filteredRequests.length > 0 && (
                  <div className="mb-6">
                    <p className="text-coffee-500 text-xs font-semibold mb-3 uppercase tracking-wide">Pending Requests</p>
                    <div className="space-y-3">
                      {filteredRequests.map(req => (
                        <div key={req.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <p className="text-coffee-800 font-semibold text-sm">{req.coffee_shops?.name ?? 'Unknown shop'}</p>
                              {req.coffee_shops?.city && <p className="text-coffee-400 text-xs">{req.coffee_shops.city}</p>}
                            </div>
                            <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                              {requestTypeLabel(req.request_type)}
                            </span>
                          </div>
                          {req.quantity && <p className="text-coffee-500 text-xs mb-1">Quantity: {req.quantity}</p>}
                          {req.message && (
                            <p className="text-coffee-600 text-xs italic bg-white/60 rounded-xl px-3 py-2 mb-3">"{req.message}"</p>
                          )}
                          <p className="text-coffee-400 text-xs mb-3">
                            {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <div className="flex gap-2">
                            <button
                              disabled={reqActionLoading === req.id}
                              onClick={() => handleAddonRequest(req, 'contacted')}
                              className="flex-1 border border-cream-300 bg-white text-coffee-600 rounded-xl py-1.5 text-xs font-medium disabled:opacity-50"
                            >
                              Mark Contacted
                            </button>
                            <button
                              disabled={reqActionLoading === req.id}
                              onClick={() => handleAddonRequest(req, 'approved')}
                              className="flex-1 bg-green-500 text-white rounded-xl py-1.5 text-xs font-medium disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              disabled={reqActionLoading === req.id}
                              onClick={() => handleAddonRequest(req, 'declined')}
                              className="flex-1 bg-red-100 text-red-600 rounded-xl py-1.5 text-xs font-medium disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shop subscription list */}
                <p className="text-coffee-500 text-xs font-semibold mb-3 uppercase tracking-wide">Shop Plans</p>
                <div className="space-y-3">
                  {filteredSubShops.map(shop => {
                    const edit = subEdits[shop.id] || {}
                    const tier = edit.tier ?? shop.shop_subscriptions?.tier ?? 'basic'
                    const punchLimit = edit.punch_card_limit_override !== undefined
                      ? edit.punch_card_limit_override
                      : shop.shop_subscriptions?.punch_card_limit_override ?? null
                    const addonPunches = edit.addon_punch_cards !== undefined
                      ? edit.addon_punch_cards
                      : (shop.shop_subscriptions?.addon_punch_cards ?? 0)
                    const billingCycle = edit.billing_cycle ?? shop.shop_subscriptions?.billing_cycle ?? 'monthly'
                    const effectiveBase = punchLimit ?? TIER_PUNCH_DEFAULTS[tier] ?? 5
                    const effectiveTotal = effectiveBase + addonPunches

                    function setEdit(patch: Partial<SubData>) {
                      setSubEdits(e => ({ ...e, [shop.id]: { ...(e[shop.id] || {}), ...patch } }))
                    }

                    return (
                      <div key={shop.id} className="bg-cream-50 border border-cream-200 rounded-2xl p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <p className="text-coffee-800 font-semibold text-sm">{shop.name}</p>
                            {shop.city && <p className="text-coffee-400 text-xs">{shop.city}</p>}
                          </div>
                          {tier === 'founding' && (
                            <span className="bg-caramel/10 text-caramel text-xs font-bold px-2 py-0.5 rounded-full border border-caramel/20">⭐ Founding</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                            <label className="text-coffee-500 text-xs font-medium block mb-1">Tier</label>
                            <select
                              value={tier}
                              onChange={e => {
                                const t = e.target.value
                                setEdit({ tier: t, is_founding: t === 'founding' })
                              }}
                              className="w-full border border-cream-200 rounded-xl px-3 py-2 text-sm text-coffee-800 focus:outline-none focus:border-caramel bg-white"
                            >
                              <option value="basic">Basic</option>
                              <option value="middle">Middle</option>
                              <option value="premium">Premium</option>
                              <option value="founding">Founding</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-coffee-500 text-xs font-medium block mb-1">Billing</label>
                            <select
                              value={billingCycle}
                              onChange={e => setEdit({ billing_cycle: e.target.value })}
                              className="w-full border border-cream-200 rounded-xl px-3 py-2 text-sm text-coffee-800 focus:outline-none focus:border-caramel bg-white"
                            >
                              <option value="monthly">Monthly</option>
                              <option value="annual">Annual</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div>
                            <label className="text-coffee-500 text-xs font-medium block mb-1">Punch limit override</label>
                            <input
                              type="number"
                              min={0}
                              value={punchLimit ?? ''}
                              placeholder={`Default (${TIER_PUNCH_DEFAULTS[tier] ?? 5})`}
                              onChange={e => setEdit({ punch_card_limit_override: e.target.value === '' ? null : Number(e.target.value) })}
                              className="w-full border border-cream-200 rounded-xl px-3 py-2 text-sm text-coffee-800 focus:outline-none focus:border-caramel"
                            />
                          </div>
                          <div>
                            <label className="text-coffee-500 text-xs font-medium block mb-1">Addon punch cards</label>
                            <input
                              type="number"
                              min={0}
                              value={addonPunches}
                              onChange={e => setEdit({ addon_punch_cards: Number(e.target.value) })}
                              className="w-full border border-cream-200 rounded-xl px-3 py-2 text-sm text-coffee-800 focus:outline-none focus:border-caramel"
                            />
                          </div>
                        </div>

                        <p className="text-coffee-400 text-xs mb-3">Effective limit: <span className="font-semibold text-coffee-600">{effectiveTotal}/month</span></p>

                        <button
                          disabled={subSavingId === shop.id}
                          onClick={() => saveSubscription(shop)}
                          className="w-full bg-caramel text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50 active:scale-95 transition-transform"
                        >
                          {subSavingId === shop.id ? 'Saving...' : subSaveResults[shop.id] || 'Save'}
                        </button>
                      </div>
                    )
                  })}
                  {filteredSubShops.length === 0 && (
                    <p className="text-coffee-400 text-sm text-center py-8">No shops found</p>
                  )}
                </div>
              </>
            )}
          </>
        )}
        {/* ── Verified tab ───────────────────────────────────────────── */}
        {activeTab === 'verified' && (
          <>
            {/* Users / Shops sub-tabs */}
            <div className="flex rounded-xl bg-cream-100 p-1 mb-4">
              {(['users', 'shops'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setVerTabMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${verTabMode === m ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'}`}
                >
                  {m}
                </button>
              ))}
            </div>

            {verTabMode === 'users' && (
              <>
                <input
                  value={verUserSearch}
                  onChange={e => searchVerUsers(e.target.value)}
                  placeholder="Search by username..."
                  className="w-full border border-cream-200 rounded-xl px-3 py-2.5 text-sm text-coffee-800 focus:outline-none focus:border-caramel mb-3"
                />
                {!verUserSearch && verUserResults.length === 0 && (
                  <p className="text-coffee-400 text-sm text-center py-8">No verified users yet</p>
                )}
                <div className="space-y-2">
                  {verUserResults.map(u => (
                    <div key={u.id} className="flex items-center gap-3 bg-cream-50 border border-cream-200 rounded-2xl px-4 py-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                        {u.avatar_url
                          ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center bg-caramel">
                              <span className="text-white text-xs font-bold">{u.username[0].toUpperCase()}</span>
                            </div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-coffee-800 font-semibold text-sm">@{u.username}</p>
                      </div>
                      <button
                        disabled={verLoading === u.id}
                        onClick={() => toggleVerifiedUser(u)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50 transition-all active:scale-95 ${u.verified ? 'bg-caramel/10 text-caramel border border-caramel/30' : 'bg-cream-200 text-coffee-500 border border-cream-300'}`}
                      >
                        {verLoading === u.id ? '...' : u.verified ? '✓ Verified' : 'Verify'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {verTabMode === 'shops' && (
              <>
                <input
                  value={verShopSearch}
                  onChange={e => searchVerShops(e.target.value)}
                  placeholder="Search by shop name..."
                  className="w-full border border-cream-200 rounded-xl px-3 py-2.5 text-sm text-coffee-800 focus:outline-none focus:border-caramel mb-3"
                />
                {!verShopSearch && verShopResults.length === 0 && (
                  <p className="text-coffee-400 text-sm text-center py-8">No verified shops yet</p>
                )}
                <div className="space-y-2">
                  {verShopResults.map(s => (
                    <div key={s.id} className="flex items-center gap-3 bg-cream-50 border border-cream-200 rounded-2xl px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-coffee-800 font-semibold text-sm">{s.name}</p>
                        {s.city && <p className="text-coffee-400 text-xs">{s.city}</p>}
                      </div>
                      <button
                        disabled={verLoading === s.id}
                        onClick={() => toggleVerifiedShop(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-50 transition-all active:scale-95 ${s.verified ? 'bg-caramel/10 text-caramel border border-caramel/30' : 'bg-cream-200 text-coffee-500 border border-cream-300'}`}
                      >
                        {verLoading === s.id ? '...' : s.verified ? '✓ Verified' : 'Verify'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
