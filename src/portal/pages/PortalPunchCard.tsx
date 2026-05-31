import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Check, RotateCcw } from 'lucide-react'

interface CustomerPunch {
  user_id: string
  current_count: number
  total_earned: number
  last_earned_at: string
  profiles: { username: string; avatar_url: string | null } | null
}

interface Props {
  shop: { id: string; name: string }
  shopOwner: {
    founding_partner: boolean
    punches_issued_total: number
    punches_issued_this_month: number
    punch_quota_reset_at: string | null
  }
}

interface PunchCardData {
  id: string
  punches_required: number
  reward_description: string
  expiry_days: number | null
  is_active: boolean
  paused: boolean
  approved_by: string | null
  rejection_reason: string | null
}

type CardState = 'loading' | 'empty' | 'pending' | 'rejected' | 'active' | 'paused'

function MugPreview({ required }: { required: number }) {
  const display = Math.min(required, 15)
  return (
    <div className="flex flex-wrap gap-1.5 p-3 bg-amber-50 rounded-xl border border-amber-100">
      {Array.from({ length: display }, (_, i) => (
        <span key={i} className="text-xl">☕</span>
      ))}
      {required > 15 && (
        <span className="text-xs text-amber-500 self-center ml-1 font-medium">+{required - 15} more</span>
      )}
    </div>
  )
}

export default function PortalPunchCard({ shop, shopOwner }: Props) {
  const [cardState, setCardState] = useState<CardState>('loading')
  const [card, setCard] = useState<PunchCardData | null>(null)
  const [editing, setEditing] = useState(false)
  const [customers, setCustomers] = useState<CustomerPunch[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)

  const [punches, setPunches] = useState(10)
  const [reward, setReward] = useState('')
  const [expiryDays, setExpiryDays] = useState('')
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState('')

  const isFoundingPartner = shopOwner.founding_partner
  const quotaUsed = isFoundingPartner ? shopOwner.punches_issued_total : shopOwner.punches_issued_this_month
  const quotaMax = isFoundingPartner ? 50 : 10
  const quotaRemaining = Math.max(0, quotaMax - quotaUsed)

  const resetDate = shopOwner.punch_quota_reset_at
    ? new Date(shopOwner.punch_quota_reset_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  useEffect(() => { loadCard() }, [])

  async function loadCustomers() {
    setLoadingCustomers(true)
    const { data } = await supabase
      .from('user_punches')
      .select('user_id, current_count, total_earned, last_earned_at, profiles:user_id(username, avatar_url)')
      .eq('shop_id', shop.id)
      .gt('current_count', 0)
      .order('last_earned_at', { ascending: false })
    setCustomers((data as any) || [])
    setLoadingCustomers(false)
  }

  async function loadCard() {
    setCardState('loading')
    const { data } = await supabase
      .from('punch_cards')
      .select('id,punches_required,reward_description,expiry_days,is_active,paused,approved_by,rejection_reason')
      .eq('shop_id', shop.id)
      .maybeSingle()
    if (!data) {
      setCardState('empty')
      return
    }
    setCard(data)
    setPunches(data.punches_required)
    setReward(data.reward_description)
    setExpiryDays(data.expiry_days ? String(data.expiry_days) : '')
    const state = data.is_active
      ? data.paused ? 'paused' : 'active'
      : !data.approved_by ? 'pending' : 'rejected'
    setCardState(state)
    if (state === 'active') loadCustomers()
  }

  async function togglePause() {
    if (!card) return
    setToggling(true)
    const newPaused = !card.paused
    await supabase.from('punch_cards').update({ paused: newPaused }).eq('id', card.id)
    setToggling(false)
    loadCard()
  }

  function openEdit() {
    if (card) {
      setPunches(card.punches_required)
      setReward(card.reward_description)
      setExpiryDays(card.expiry_days ? String(card.expiry_days) : '')
    }
    setEditing(true)
    setError('')
  }

  function cancelEdit() {
    setEditing(false)
    setError('')
  }

  async function handleSubmit() {
    if (!reward.trim()) { setError('Please describe the reward'); return }
    setSaving(true)
    setError('')
    const payload = {
      shop_id: shop.id,
      punches_required: punches,
      reward_description: reward.trim(),
      expiry_days: expiryDays ? parseInt(expiryDays) : null,
      is_active: false,
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
    }
    const { error: err } = card
      ? await supabase.from('punch_cards').update(payload).eq('id', card.id)
      : await supabase.from('punch_cards').insert(payload)
    setSaving(false)
    if (err) { setError(err.message); return }
    setEditing(false)
    loadCard()
    supabase.functions.invoke('notify-admin', {
      body: {
        type: 'punch_card',
        data: {
          shop_name: shop.name,
          punches_required: punches,
          reward_description: reward.trim(),
          expiry_days: expiryDays ? parseInt(expiryDays) : null,
          is_update: !!card,
        },
      },
    })
  }

  async function deleteCard() {
    if (!card) return
    await supabase.from('punch_cards').delete().eq('id', card.id)
    setCard(null)
    setCardState('empty')
    setEditing(false)
  }

  const showForm = cardState === 'empty' || editing || cardState === 'rejected'
  const showPauseToggle = (cardState === 'active' || cardState === 'paused') && !editing

  if (cardState === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Punch Card</h1>
        <p className="text-sm text-gray-500 mt-0.5">Set up a loyalty stamp program for your regulars</p>
      </div>

      {/* Quota banner */}
      <div className={`rounded-xl p-4 border ${isFoundingPartner ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-700">
              {isFoundingPartner ? '⭐ Founding Partner' : 'Monthly Punch Quota'}
            </p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">
              {quotaUsed} / {quotaMax} {isFoundingPartner ? 'lifetime punches used' : 'punches this month'}
            </p>
          </div>
          <div className="text-right">
            <p
              className="text-2xl font-bold"
              style={{ color: quotaRemaining > 5 ? '#22c55e' : quotaRemaining > 0 ? '#f59e0b' : '#ef4444' }}
            >
              {quotaRemaining}
            </p>
            <p className="text-xs text-gray-400">
              {isFoundingPartner ? 'remaining total' : `resets ${resetDate || 'next month'}`}
            </p>
          </div>
        </div>
        {!isFoundingPartner && (
          <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all"
              style={{ width: `${Math.min(100, (quotaUsed / quotaMax) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Pending state */}
      {cardState === 'pending' && !editing && (
        <div className="bg-white rounded-xl border border-amber-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <p className="text-sm font-semibold text-amber-700">Awaiting admin approval</p>
          </div>
          <p className="text-xs text-gray-500">
            Your punch card config is being reviewed. We'll notify you once it's live.
          </p>
          {card && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
              <p className="text-xs text-gray-600">
                <span className="font-medium text-gray-700">Punches required: </span>{card.punches_required}
              </p>
              <p className="text-xs text-gray-600">
                <span className="font-medium text-gray-700">Reward: </span>{card.reward_description}
              </p>
              {card.expiry_days && (
                <p className="text-xs text-gray-600">
                  <span className="font-medium text-gray-700">Expires: </span>{card.expiry_days} days after last punch
                </p>
              )}
              <MugPreview required={card.punches_required} />
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={openEdit}
              className="flex-1 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Edit & Resubmit
            </button>
            <button
              onClick={deleteCard}
              className="px-3 py-2 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active state */}
      {cardState === 'active' && !editing && (
        <div className="bg-white rounded-xl border border-green-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <p className="text-sm font-semibold text-green-700">Live</p>
            </div>
          </div>
          {card && (
            <>
              <p className="text-base font-semibold text-gray-900">{card.reward_description}</p>
              <p className="text-xs text-gray-500">
                Customers earn a stamp for each qualifying visit — {card.punches_required} stamps = reward
              </p>
              {card.expiry_days && (
                <p className="text-xs text-gray-400">Card expires {card.expiry_days} days after last stamp</p>
              )}
              <MugPreview required={card.punches_required} />
            </>
          )}
          <button
            onClick={openEdit}
            className="w-full py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Edit punch card
          </button>
        </div>
      )}

      {/* Paused state */}
      {cardState === 'paused' && !editing && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-400" />
            <p className="text-sm font-semibold text-gray-500">Paused</p>
          </div>
          {card && (
            <>
              <p className="text-base font-semibold text-gray-400">{card.reward_description}</p>
              <p className="text-xs text-gray-400">
                Customers cannot see or earn stamps while paused. Resume to make it live again instantly.
              </p>
              <MugPreview required={card.punches_required} />
            </>
          )}
        </div>
      )}

      {/* Rejected notice */}
      {cardState === 'rejected' && (
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <p className="text-sm font-semibold text-red-600">Punch card rejected</p>
          {card?.rejection_reason && (
            <p className="text-xs text-gray-600 mt-1 italic">"{card.rejection_reason}"</p>
          )}
          <p className="text-xs text-gray-400 mt-1">Update the form below and resubmit for review.</p>
        </div>
      )}

      {/* Pause / Resume toggle */}
      {showPauseToggle && (
        <button
          onClick={togglePause}
          disabled={toggling}
          className={`w-full py-2.5 rounded-xl text-sm font-medium border transition-colors disabled:opacity-40 ${
            cardState === 'paused'
              ? 'text-green-700 border-green-200 hover:bg-green-50'
              : 'text-gray-500 border-gray-200 hover:bg-gray-50'
          }`}
        >
          {toggling ? 'Saving…' : cardState === 'paused' ? '▶ Resume punch card' : '⏸ Pause punch card'}
        </button>
      )}

      {/* Create / Edit form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">
              {cardState === 'empty' ? 'Create punch card' : 'Edit punch card'}
            </p>
            {editing && cardState !== 'rejected' && (
              <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-gray-600">
                Cancel
              </button>
            )}
          </div>

          {/* Punches slider */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600">Punches to earn reward</label>
              <span className="text-sm font-bold text-coffee-800">{punches}</span>
            </div>
            <input
              type="range"
              min={5}
              max={20}
              value={punches}
              onChange={e => setPunches(Number(e.target.value))}
              className="w-full accent-caramel"
            />
            <div className="flex justify-between text-[10px] text-gray-300 mt-0.5">
              <span>5</span><span>20</span>
            </div>
          </div>

          {/* Live mug preview */}
          <MugPreview required={punches} />

          {/* Reward description */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Reward description <span className="text-red-400">*</span>
            </label>
            <input
              value={reward}
              onChange={e => setReward(e.target.value.slice(0, 100))}
              placeholder="e.g. Free medium coffee of your choice"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-caramel/30"
            />
            <p className="text-right text-[10px] text-gray-300 mt-0.5">{reward.length}/100</p>
          </div>

          {/* Expiry */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Card expiry <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={expiryDays}
                onChange={e => setExpiryDays(e.target.value)}
                placeholder="90"
                className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-caramel/30"
              />
              <span className="text-xs text-gray-400">days after last punch earned</span>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving || !reward.trim()}
            className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
          >
            {saving
              ? <RotateCcw size={14} className="animate-spin" />
              : <Check size={14} />
            }
            {saving
              ? 'Submitting…'
              : cardState === 'active'
                ? 'Update & Resubmit for Approval'
                : 'Submit for Approval'
            }
          </button>
          <p className="text-center text-xs text-gray-400">All punch cards are reviewed before going live</p>
        </div>
      )}

      {/* Customer tracker */}
      {cardState === 'active' && !editing && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Punch card holders</h2>
            <button onClick={loadCustomers} className="text-xs text-caramel hover:underline">Refresh</button>
          </div>
          {loadingCustomers ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
            </div>
          ) : customers.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
              <p className="text-2xl mb-1">☕</p>
              <p className="text-sm text-gray-400">No customers have stamps yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customers.map(c => (
                <div key={c.user_id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                  {c.profiles?.avatar_url ? (
                    <img src={c.profiles.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-sm">
                      {c.profiles?.username?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{c.profiles?.username ?? 'Unknown'}</p>
                    <p className="text-xs text-gray-400">
                      Last stamped {new Date(c.last_earned_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-coffee-800">
                      {c.current_count}
                      {card && <span className="text-xs font-normal text-gray-400">/{card.punches_required}</span>}
                    </p>
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: card ? `${Math.min(100, (c.current_count / card.punches_required) * 100)}%` : '0%',
                          background: 'linear-gradient(90deg, #c8853a, #9b5e1a)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
