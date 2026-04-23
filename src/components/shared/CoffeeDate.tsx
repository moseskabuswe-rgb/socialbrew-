// src/components/shared/CoffeeDate.tsx
// Send coffee date invites — one-on-one or group

import { useState, useEffect } from 'react'
import { X, Search, MapPin, Clock, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { sendPushToUser } from '../../lib/push'

interface Props {
  onClose: () => void
  preselectedShop?: any
}

export default function CoffeeDate({ onClose, preselectedShop }: Props) {
  const { profile } = useAuth()
  const [step, setStep] = useState<'friends' | 'mode' | 'shop' | 'details' | 'sent'>('friends')
  const [friendQuery, setFriendQuery] = useState('')
  const [allFriends, setAllFriends] = useState<any[]>([])
  const [selectedFriends, setSelectedFriends] = useState<any[]>([])
  const [inviteMode, setInviteMode] = useState<'individual' | 'group'>('individual')
  const [shops, setShops] = useState<any[]>([])
  const [shopQuery, setShopQuery] = useState('')
  const [selectedShop, setSelectedShop] = useState<any>(preselectedShop || null)
  const [message, setMessage] = useState('')
  const [proposedTime, setProposedTime] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('follows')
      .select('following_id, profiles!follows_following_id_fkey(id, username, full_name, avatar_url)')
      .eq('follower_id', profile.id)
      .then(({ data }) => setAllFriends((data || []).map((f: any) => f.profiles).filter(Boolean)))
  }, [profile])

  useEffect(() => {
    if (step !== 'shop') return
    supabase.from('coffee_shops').select('id, name, city, state, photo_url')
      .eq('is_active', true).order('total_ratings', { ascending: false }).limit(50)
      .then(({ data }) => setShops(data || []))
  }, [step])

  const filteredFriends = friendQuery.trim().length > 0
    ? allFriends.filter(f => f.username.toLowerCase().includes(friendQuery.toLowerCase()))
    : allFriends

  const filteredShops = shopQuery.trim()
    ? shops.filter(s => s.name.toLowerCase().includes(shopQuery.toLowerCase()) || s.city?.toLowerCase().includes(shopQuery.toLowerCase()))
    : shops

  function toggleFriend(friend: any) {
    setSelectedFriends(prev =>
      prev.some(f => f.id === friend.id)
        ? prev.filter(f => f.id !== friend.id)
        : [...prev, friend]
    )
  }

  function nextFromFriends() {
    if (selectedFriends.length === 0) return
    if (selectedFriends.length === 1) {
      // Only one person — skip mode selection, go straight to shop
      setInviteMode('individual')
      setStep(preselectedShop ? 'details' : 'shop')
    } else {
      // Multiple people — ask individual or group
      setStep('mode')
    }
  }

  async function send() {
    if (!profile || selectedFriends.length === 0 || !selectedShop) return
    setSending(true)

    const shopName = selectedShop.name
    const groupId = inviteMode === 'group' ? crypto.randomUUID() : null

    // Build group member names for group invites
    const otherNames = selectedFriends.map(f => `@${f.username}`)

    for (const friend of selectedFriends) {
      const isGroup = inviteMode === 'group'
      const othersExcluding = otherNames.filter(n => n !== `@${friend.username}`)

      const notifContent = isGroup && othersExcluding.length > 0
        ? `${profile.username} invited you, ${othersExcluding.join(', ')} for coffee at ${shopName}`
        : `${profile.username} invited you for coffee at ${shopName}`

      const pushBody = isGroup && othersExcluding.length > 0
        ? `You + ${othersExcluding.join(', ')} at ${shopName}${proposedTime ? ` — ${proposedTime}` : ''}`
        : `${shopName}${proposedTime ? ` — ${proposedTime}` : ''}`

      // Insert invite row
      await supabase.from('coffee_dates').insert({
        sender_id: profile.id,
        recipient_id: friend.id,
        shop_id: selectedShop.id,
        message: message.trim() || null,
        proposed_time: proposedTime.trim() || null,
        is_group: isGroup,
        group_id: groupId,
      })

      // In-app notification
      await supabase.from('notifications').insert({
        user_id: friend.id,
        actor_id: profile.id,
        type: 'coffee_date',
        content: notifContent,
      })

      // Push
      try {
        await sendPushToUser(
          friend.id,
          `☕ Coffee Date Invite`,
          pushBody,
          { type: 'coffee_date' }
        )
      } catch {}
    }

    setSending(false)
    setStep('sent')
  }

  const stepIndex = { friends: 0, mode: 1, shop: 2, details: 3, sent: 4 }
  const totalSteps = selectedFriends.length > 1 ? 3 : 2

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.9)' }}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <div className="flex items-center gap-2">
            {step !== 'friends' && step !== 'sent' && (
              <button onClick={() => {
                if (step === 'mode') setStep('friends')
                else if (step === 'shop') setStep(selectedFriends.length > 1 ? 'mode' : 'friends')
                else if (step === 'details') setStep(preselectedShop ? (selectedFriends.length > 1 ? 'mode' : 'friends') : 'shop')
              }} className="text-coffee-400 mr-1 text-lg">←</button>
            )}
            <h3 className="font-display font-bold text-coffee-800 text-lg">Coffee Date ☕</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500">
            <X size={15} />
          </button>
        </div>

        {/* Progress */}
        {step !== 'sent' && (
          <div className="flex gap-1 px-5 pt-3 pb-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${
                i <= (step === 'friends' ? 0 : step === 'mode' ? 1 : step === 'shop' ? (selectedFriends.length > 1 ? 2 : 1) : totalSteps) ? 'bg-caramel' : 'bg-cream-200'
              }`} />
            ))}
          </div>
        )}

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(92vh - 110px)' }}>

          {/* Step 1: Pick friends (multi-select) */}
          {step === 'friends' && (
            <div className="px-5 py-4">
              <p className="text-coffee-500 text-sm mb-3">Who do you want to invite?</p>
              <div className="flex items-center bg-cream-50 rounded-xl border border-cream-200 px-3 py-2.5 gap-2 mb-3">
                <Search size={14} className="text-coffee-400" />
                <input value={friendQuery} onChange={e => setFriendQuery(e.target.value)}
                  placeholder="Search by username..."
                  className="flex-1 bg-transparent text-coffee-800 text-sm focus:outline-none placeholder-coffee-300" />
              </div>

              {/* Selected chips */}
              {selectedFriends.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedFriends.map(f => (
                    <button key={f.id} onClick={() => toggleFriend(f)}
                      className="flex items-center gap-1.5 bg-caramel/10 border border-caramel/30 text-caramel rounded-full px-3 py-1 text-xs font-semibold">
                      @{f.username} <X size={10} />
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                {filteredFriends.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-coffee-400 text-sm">No friends found</p>
                    <p className="text-coffee-300 text-xs mt-1">Follow people to invite them</p>
                  </div>
                )}
                {filteredFriends.map(friend => {
                  const selected = selectedFriends.some(f => f.id === friend.id)
                  return (
                    <button key={friend.id} onClick={() => toggleFriend(friend)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left ${selected ? 'bg-caramel/10' : 'hover:bg-cream-50'}`}>
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                        {friend.avatar_url
                          ? <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
                          : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white font-bold text-sm">{friend.username?.[0]?.toUpperCase()}</span></div>}
                      </div>
                      <div className="flex-1">
                        <p className="text-coffee-800 font-semibold text-sm">{friend.username}</p>
                        {friend.full_name && <p className="text-coffee-400 text-xs">{friend.full_name}</p>}
                      </div>
                      {selected && <Check size={16} className="text-caramel flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={nextFromFriends}
                disabled={selectedFriends.length === 0}
                className="w-full mt-4 py-3.5 rounded-2xl text-white font-bold text-sm disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}>
                {selectedFriends.length === 0 ? 'Select at least one friend' :
                  selectedFriends.length === 1 ? `Invite @${selectedFriends[0].username} →` :
                  `Invite ${selectedFriends.length} people →`}
              </button>
            </div>
          )}

          {/* Step 2: Individual or Group (only shown for 2+ people) */}
          {step === 'mode' && (
            <div className="px-5 py-6 space-y-4">
              <p className="text-coffee-500 text-sm text-center mb-2">How do you want to send this?</p>

              <button onClick={() => { setInviteMode('individual'); setStep(preselectedShop ? 'details' : 'shop') }}
                className={`w-full p-5 rounded-2xl text-left border-2 transition-all ${inviteMode === 'individual' ? 'border-caramel bg-caramel/5' : 'border-cream-200 bg-white'}`}>
                <p className="text-coffee-800 font-bold text-sm mb-1">📨 Individual Invites</p>
                <p className="text-coffee-400 text-xs">Each person gets a separate private invite. They won't see who else was invited.</p>
              </button>

              <button onClick={() => { setInviteMode('group'); setStep(preselectedShop ? 'details' : 'shop') }}
                className={`w-full p-5 rounded-2xl text-left border-2 transition-all ${inviteMode === 'group' ? 'border-caramel bg-caramel/5' : 'border-cream-200 bg-white'}`}>
                <p className="text-coffee-800 font-bold text-sm mb-1">👥 Group Invite</p>
                <p className="text-coffee-400 text-xs">Everyone can see who else is invited. Great for a coffee hangout.</p>
              </button>
            </div>
          )}

          {/* Step 3: Pick shop */}
          {step === 'shop' && (
            <div className="px-5 py-4">
              <p className="text-coffee-500 text-sm mb-3">Where do you want to meet?</p>
              <div className="flex items-center bg-cream-50 rounded-xl border border-cream-200 px-3 py-2.5 gap-2 mb-4">
                <Search size={14} className="text-coffee-400" />
                <input value={shopQuery} onChange={e => setShopQuery(e.target.value)}
                  placeholder="Search coffee shops..."
                  className="flex-1 bg-transparent text-coffee-800 text-sm focus:outline-none placeholder-coffee-300" />
              </div>
              <div className="space-y-1">
                {filteredShops.map(shop => (
                  <button key={shop.id} onClick={() => { setSelectedShop(shop); setStep('details') }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-cream-50 transition-colors text-left">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-coffee-100 flex-shrink-0">
                      {shop.photo_url ? <img src={shop.photo_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-xl">☕</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-coffee-800 font-semibold text-sm truncate">{shop.name}</p>
                      <div className="flex items-center gap-1">
                        <MapPin size={10} className="text-coffee-400" />
                        <p className="text-coffee-400 text-xs">{shop.city}{shop.state ? `, ${shop.state}` : ''}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Details */}
          {step === 'details' && selectedShop && (
            <div className="px-5 py-4 space-y-4 pb-8">
              {/* Summary */}
              <div className="bg-cream-50 rounded-2xl p-4 border border-cream-200">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {selectedFriends.map(f => (
                    <span key={f.id} className="text-xs font-semibold text-caramel bg-caramel/10 px-2 py-0.5 rounded-full">@{f.username}</span>
                  ))}
                  {inviteMode === 'group' && selectedFriends.length > 1 && (
                    <span className="text-xs text-coffee-400">· Group invite</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg overflow-hidden bg-coffee-100 flex-shrink-0">
                    {selectedShop.photo_url ? <img src={selectedShop.photo_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-sm">☕</div>}
                  </div>
                  <div>
                    <p className="text-coffee-800 font-semibold text-sm">{selectedShop.name}</p>
                    <p className="text-coffee-400 text-xs">{selectedShop.city}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-coffee-600 text-xs font-semibold block mb-1.5">
                  <Clock size={11} className="inline mr-1" />When?
                </label>
                <input value={proposedTime} onChange={e => setProposedTime(e.target.value)}
                  placeholder="e.g. Saturday morning, tomorrow at 10am..."
                  className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300" />
              </div>

              <div>
                <label className="text-coffee-600 text-xs font-semibold block mb-1.5">Message (optional)</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Add a personal note..."
                  rows={3}
                  className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none resize-none placeholder-coffee-300" />
              </div>

              <button onClick={send} disabled={sending}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm disabled:opacity-40 active:scale-95 transition-all"
                style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)', boxShadow: '0 4px 16px rgba(200,133,58,0.3)' }}>
                {sending ? 'Sending...' : inviteMode === 'group'
                  ? `Send Group Invite to ${selectedFriends.length} people ☕`
                  : selectedFriends.length === 1
                    ? `Invite @${selectedFriends[0].username} ☕`
                    : `Send ${selectedFriends.length} Invites ☕`}
              </button>
            </div>
          )}

          {/* Sent */}
          {step === 'sent' && (
            <div className="px-5 py-12 text-center">
              <div className="text-6xl mb-4">☕</div>
              <h3 className="font-display text-2xl font-bold text-coffee-800 mb-2">
                {inviteMode === 'group' ? 'Group Invite Sent!' : selectedFriends.length > 1 ? 'Invites Sent!' : 'Invite Sent!'}
              </h3>
              <p className="text-coffee-400 text-sm mb-2">
                {inviteMode === 'group'
                  ? `${selectedFriends.map(f => `@${f.username}`).join(', ')} were invited to ${selectedShop?.name}`
                  : selectedFriends.length > 1
                    ? `${selectedFriends.length} people were each sent a personal invite to ${selectedShop?.name}`
                    : `@${selectedFriends[0]?.username} was invited to ${selectedShop?.name}`}
              </p>
              <button onClick={onClose}
                className="mt-4 px-8 py-3 rounded-2xl text-white font-semibold text-sm"
                style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
