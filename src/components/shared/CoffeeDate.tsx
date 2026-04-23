// src/components/shared/CoffeeDate.tsx
// Send and manage coffee date invitations

import { useState, useEffect } from 'react'
import { X, Search, MapPin, Clock } from 'lucide-react'
import { sendPushToUser } from '../../lib/push'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { sendPushToUser } from '../../lib/push'

interface Props {
  onClose: () => void
  preselectedShop?: any
}

export default function CoffeeDate({ onClose, preselectedShop }: Props) {
  const { profile } = useAuth()
  const [step, setStep] = useState<'friend' | 'shop' | 'details' | 'sent'>(preselectedShop ? 'friend' : 'friend')
  const [friendQuery, setFriendQuery] = useState('')
  const [friendResults, setFriendResults] = useState<any[]>([])
  const [selectedFriend, setSelectedFriend] = useState<any>(null)
  const [shops, setShops] = useState<any[]>([])
  const [shopQuery, setShopQuery] = useState('')
  const [selectedShop, setSelectedShop] = useState<any>(preselectedShop || null)
  const [message, setMessage] = useState('')
  const [proposedTime, setProposedTime] = useState('')
  const [sending, setSending] = useState(false)

  // Load following list for friend picker
  useEffect(() => {
    if (!profile) return
    async function loadFollowing() {
      const { data } = await supabase
        .from('follows')
        .select('following_id, profiles!follows_following_id_fkey(id, username, full_name, avatar_url)')
        .eq('follower_id', profile!.id)
      setFriendResults((data || []).map((f: any) => f.profiles).filter(Boolean))
    }
    loadFollowing()
  }, [profile])

  // Filter friends by query
  const filteredFriends = friendQuery.trim().length > 0
    ? friendResults.filter(f => f.username.toLowerCase().includes(friendQuery.toLowerCase()))
    : friendResults

  // Load shops for shop picker
  useEffect(() => {
    if (step !== 'shop') return
    supabase.from('coffee_shops').select('*').eq('is_active', true)
      .order('total_ratings', { ascending: false }).limit(30)
      .then(({ data }) => setShops(data || []))
  }, [step])

  const filteredShops = shopQuery.trim()
    ? shops.filter(s => s.name.toLowerCase().includes(shopQuery.toLowerCase()) || s.city?.toLowerCase().includes(shopQuery.toLowerCase()))
    : shops

  async function send() {
    if (!profile || !selectedFriend || !selectedShop) return
    setSending(true)

    await supabase.from('coffee_dates').insert({
      sender_id: profile.id,
      recipient_id: selectedFriend.id,
      shop_id: selectedShop.id,
      message: message.trim() || null,
      proposed_time: proposedTime.trim() || null,
    })

    // Send notification
    await supabase.from('notifications').insert({
      user_id: selectedFriend.id,
      actor_id: profile.id,
      type: 'coffee_date',
      content: `${profile.username || 'Someone'} invited you for coffee at ${selectedShop.name}`,
    })

    // Push notification
    try {
      await sendPushToUser(
        selectedFriend.id,
        '☕ Coffee Date Invite',
        `${profile.username || 'Someone'} wants to meet at ${selectedShop.name}${proposedTime ? ` — ${proposedTime}` : ''}`,
        { type: 'coffee_date' }
      )
    } catch {}

    setSending(false)
    setStep('sent')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.9)' }}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <div className="flex items-center gap-2">
            {step !== 'friend' && step !== 'sent' && (
              <button onClick={() => setStep(step === 'shop' ? 'friend' : 'shop')} className="text-coffee-400 mr-1">
                ←
              </button>
            )}
            <h3 className="font-display font-bold text-coffee-800 text-lg">Coffee Date ☕</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500">
            <X size={15} />
          </button>
        </div>

        {/* Step indicator */}
        {step !== 'sent' && (
          <div className="flex gap-1 px-5 pt-3">
            {['friend', 'shop', 'details'].map((s, i) => (
              <div key={s} className={`flex-1 h-1 rounded-full ${['friend', 'shop', 'details'].indexOf(step) >= i ? 'bg-caramel' : 'bg-cream-200'}`} />
            ))}
          </div>
        )}

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 100px)' }}>

          {/* Step 1: Pick a friend */}
          {step === 'friend' && (
            <div className="px-5 py-4">
              <p className="text-coffee-500 text-sm mb-3">Who do you want to invite?</p>
              <div className="flex items-center bg-cream-50 rounded-xl border border-cream-200 px-3 py-2.5 gap-2 mb-4">
                <Search size={14} className="text-coffee-400" />
                <input value={friendQuery} onChange={e => setFriendQuery(e.target.value)}
                  placeholder="Search by username..."
                  className="flex-1 bg-transparent text-coffee-800 text-sm focus:outline-none placeholder-coffee-300" />
              </div>
              {filteredFriends.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-coffee-400 text-sm">No friends found</p>
                  <p className="text-coffee-300 text-xs mt-1">Follow people to invite them for coffee</p>
                </div>
              )}
              <div className="space-y-1">
                {filteredFriends.map(friend => (
                  <button key={friend.id} onClick={() => { setSelectedFriend(friend); setStep(preselectedShop ? 'details' : 'shop') }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-cream-50 transition-colors text-left">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                      {friend.avatar_url
                        ? <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white font-bold text-sm">{friend.username?.[0]?.toUpperCase()}</span></div>}
                    </div>
                    <div>
                      <p className="text-coffee-800 font-semibold text-sm">{friend.username}</p>
                      {friend.full_name && <p className="text-coffee-400 text-xs">{friend.full_name}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Pick a shop */}
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

          {/* Step 3: Details */}
          {step === 'details' && selectedFriend && selectedShop && (
            <div className="px-5 py-4 space-y-4 pb-8">
              {/* Summary */}
              <div className="bg-cream-50 rounded-2xl p-4 border border-cream-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                    {selectedFriend.avatar_url
                      ? <img src={selectedFriend.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white font-bold text-sm">{selectedFriend.username?.[0]?.toUpperCase()}</span></div>}
                  </div>
                  <div>
                    <p className="text-coffee-700 text-xs text-coffee-400">Inviting</p>
                    <p className="text-coffee-800 font-semibold text-sm">@{selectedFriend.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl overflow-hidden bg-coffee-100 flex-shrink-0">
                    {selectedShop.photo_url ? <img src={selectedShop.photo_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-lg">☕</div>}
                  </div>
                  <div>
                    <p className="text-coffee-400 text-xs">At</p>
                    <p className="text-coffee-800 font-semibold text-sm">{selectedShop.name}</p>
                  </div>
                </div>
              </div>

              {/* Proposed time */}
              <div>
                <label className="text-coffee-600 text-xs font-semibold block mb-1.5">
                  <Clock size={11} className="inline mr-1" />When?
                </label>
                <input value={proposedTime} onChange={e => setProposedTime(e.target.value)}
                  placeholder="e.g. Saturday morning, tomorrow at 10am..."
                  className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300" />
              </div>

              {/* Message */}
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
                {sending ? 'Sending...' : `Invite @${selectedFriend.username} ☕`}
              </button>
            </div>
          )}

          {/* Sent */}
          {step === 'sent' && (
            <div className="px-5 py-12 text-center">
              <div className="text-6xl mb-4">☕</div>
              <h3 className="font-display text-2xl font-bold text-coffee-800 mb-2">Invite Sent!</h3>
              <p className="text-coffee-400 text-sm mb-6">
                @{selectedFriend?.username} will be notified about your coffee date at {selectedShop?.name}
              </p>
              <button onClick={onClose}
                className="px-8 py-3 rounded-2xl text-white font-semibold text-sm"
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
