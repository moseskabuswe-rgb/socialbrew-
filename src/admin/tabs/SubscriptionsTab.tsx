import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  currentUserId: string
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

const TIER_DEFAULTS: Record<string, number> = { basic: 5, middle: 25, premium: 50, founding: 25 }

function requestTypeLabel(type: string) {
  if (type === 'punch_cards') return 'Extra Punch Cards'
  if (type === 'report_weekly') return 'Weekly Report'
  if (type === 'report_consistency') return 'Consistency Report'
  if (type === 'report_custom') return 'Custom Report'
  if (type === 'report_monthly') return 'Monthly Report'
  return type
}

export default function SubscriptionsTab({ currentUserId }: Props) {
  const [subShops, setSubShops] = useState<SubShop[]>([])
  const [addonRequests, setAddonRequests] = useState<AddonRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [subEdits, setSubEdits] = useState<Record<string, Partial<SubData>>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveResults, setSaveResults] = useState<Record<string, string>>({})
  const [reqLoading, setReqLoading] = useState<string | null>(null)

  async function load() {
    const [{ data: shops }, { data: reqs }] = await Promise.all([
      supabase
        .from('coffee_shops')
        .select('id, name, city, shop_subscriptions(id, tier, is_founding, founding_started_at, founding_expires_at, punch_card_limit_override, addon_punch_cards, billing_cycle)')
        .order('name'),
      supabase
        .from('shop_addon_requests')
        .select('id, shop_id, request_type, message, status, quantity, created_at, coffee_shops(name, city)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])

    const mapped = (shops || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      shop_subscriptions: Array.isArray(s.shop_subscriptions)
        ? (s.shop_subscriptions[0] ?? null)
        : (s.shop_subscriptions ?? null),
    })) as SubShop[]

    setSubShops(mapped)
    setAddonRequests((reqs || []) as unknown as AddonRequest[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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

    setSavingId(shop.id)
    const { error } = await supabase
      .from('shop_subscriptions')
      .upsert(payload, { onConflict: 'shop_id' })
    setSavingId(null)

    const msg = error ? '✗ Error' : '✓ Saved'
    setSaveResults(r => ({ ...r, [shop.id]: msg }))
    setTimeout(() => setSaveResults(r => { const n = { ...r }; delete n[shop.id]; return n }), 2500)

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

  async function handleRequest(req: AddonRequest, action: 'contacted' | 'approved' | 'declined') {
    setReqLoading(req.id)
    await supabase.from('shop_addon_requests').update({
      status: action,
      ...(action !== 'contacted' ? { reviewed_by: currentUserId, reviewed_at: new Date().toISOString() } : {}),
    }).eq('id', req.id)

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
    setReqLoading(null)
  }

  const filteredShops = subShops.filter(s => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || (s.city ?? '').toLowerCase().includes(q)
  })

  const filteredRequests = addonRequests.filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (r.coffee_shops?.name ?? '').toLowerCase().includes(q) || (r.coffee_shops?.city ?? '').toLowerCase().includes(q)
  })

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Subscriptions</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage shop tiers and add-on requests</p>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by shop or city..."
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-caramel/30"
      />

      {/* Pending requests */}
      {filteredRequests.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Pending Requests <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">{filteredRequests.length}</span>
          </h2>
          <div className="space-y-3">
            {filteredRequests.map(req => (
              <div key={req.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{req.coffee_shops?.name ?? 'Unknown'}</p>
                    {req.coffee_shops?.city && <p className="text-gray-400 text-xs">{req.coffee_shops.city}</p>}
                  </div>
                  <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                    {requestTypeLabel(req.request_type)}
                  </span>
                </div>
                {req.quantity != null && <p className="text-gray-500 text-xs mb-1">Qty: {req.quantity}</p>}
                {req.message && (
                  <p className="text-gray-600 text-xs italic bg-white/70 rounded-lg px-3 py-2 mb-3">"{req.message}"</p>
                )}
                <p className="text-gray-400 text-xs mb-3">
                  {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={reqLoading === req.id}
                    onClick={() => handleRequest(req, 'contacted')}
                    className="flex-1 border border-gray-200 bg-white text-gray-600 rounded-lg py-1.5 text-xs font-medium disabled:opacity-50 hover:bg-gray-50"
                  >
                    Mark Contacted
                  </button>
                  <button
                    disabled={reqLoading === req.id}
                    onClick={() => handleRequest(req, 'approved')}
                    className="flex-1 bg-green-500 text-white rounded-lg py-1.5 text-xs font-medium disabled:opacity-50 hover:bg-green-600"
                  >
                    Approve
                  </button>
                  <button
                    disabled={reqLoading === req.id}
                    onClick={() => handleRequest(req, 'declined')}
                    className="flex-1 bg-red-100 text-red-600 rounded-lg py-1.5 text-xs font-medium disabled:opacity-50 hover:bg-red-200"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shop plans */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Shop Plans <span className="text-gray-400 font-normal">({filteredShops.length})</span>
        </h2>
        <div className="space-y-3">
          {filteredShops.map(shop => {
            const edit = subEdits[shop.id] || {}
            const tier = edit.tier ?? shop.shop_subscriptions?.tier ?? 'basic'
            const punchOverride = edit.punch_card_limit_override !== undefined
              ? edit.punch_card_limit_override
              : shop.shop_subscriptions?.punch_card_limit_override ?? null
            const addonPunches = edit.addon_punch_cards !== undefined
              ? edit.addon_punch_cards
              : (shop.shop_subscriptions?.addon_punch_cards ?? 0)
            const billingCycle = edit.billing_cycle ?? shop.shop_subscriptions?.billing_cycle ?? 'monthly'
            const effectiveBase = punchOverride ?? TIER_DEFAULTS[tier] ?? 5
            const effectiveTotal = effectiveBase + addonPunches
            const isDirty = Object.keys(subEdits[shop.id] || {}).length > 0

            function setEdit(patch: Partial<SubData>) {
              setSubEdits(e => ({ ...e, [shop.id]: { ...(e[shop.id] || {}), ...patch } }))
            }

            return (
              <div key={shop.id} className={`bg-white border rounded-xl p-4 ${isDirty ? 'border-caramel/40' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{shop.name}</p>
                    {shop.city && <p className="text-gray-400 text-xs">{shop.city}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {tier === 'founding' && (
                      <span className="bg-caramel/10 text-caramel text-xs font-bold px-2 py-0.5 rounded-full border border-caramel/20">⭐ Founding</span>
                    )}
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      tier === 'premium' ? 'bg-purple-50 text-purple-600'
                      : tier === 'middle' ? 'bg-blue-50 text-blue-600'
                      : tier === 'founding' ? 'bg-caramel/10 text-caramel'
                      : 'bg-gray-100 text-gray-500'
                    }`}>
                      {tier}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-gray-500 text-xs font-medium block mb-1">Tier</label>
                    <select
                      value={tier}
                      onChange={e => setEdit({ tier: e.target.value, is_founding: e.target.value === 'founding' })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-caramel/30 bg-white"
                    >
                      <option value="basic">Basic</option>
                      <option value="middle">Middle ($34.99)</option>
                      <option value="premium">Premium ($74.99)</option>
                      <option value="founding">Founding</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs font-medium block mb-1">Billing</label>
                    <select
                      value={billingCycle}
                      onChange={e => setEdit({ billing_cycle: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-caramel/30 bg-white"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-gray-500 text-xs font-medium block mb-1">Punch limit override</label>
                    <input
                      type="number"
                      min={0}
                      value={punchOverride ?? ''}
                      placeholder={`Default (${TIER_DEFAULTS[tier] ?? 5})`}
                      onChange={e => setEdit({ punch_card_limit_override: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-caramel/30"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 text-xs font-medium block mb-1">Addon punch cards</label>
                    <input
                      type="number"
                      min={0}
                      value={addonPunches}
                      onChange={e => setEdit({ addon_punch_cards: Number(e.target.value) })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-caramel/30"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-gray-400 text-xs">
                    Effective limit: <span className="font-semibold text-gray-600">{effectiveTotal}/month</span>
                  </p>
                  <button
                    disabled={savingId === shop.id}
                    onClick={() => saveSubscription(shop)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                      saveResults[shop.id]?.startsWith('✓')
                        ? 'bg-green-500 text-white'
                        : saveResults[shop.id]?.startsWith('✗')
                        ? 'bg-red-500 text-white'
                        : 'bg-caramel text-white hover:bg-caramel/90'
                    }`}
                  >
                    {savingId === shop.id ? 'Saving...' : saveResults[shop.id] || 'Save'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
