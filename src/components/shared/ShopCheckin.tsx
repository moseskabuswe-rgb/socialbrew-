// src/components/shared/ShopCheckin.tsx
// Live check-in indicator for a shop
// Shows who is currently at the shop and allows checking in/out

import { useState, useEffect } from 'react'
import { MapPin, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  shopId: string
  shopName: string
}

interface Checkin {
  id: string
  user_id: string
  checked_in_at: string
  profiles: { username: string; avatar_url: string | null }
}

export default function ShopCheckin({ shopId, shopName }: Props) {
  const { profile } = useAuth()
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    load()
    // Subscribe to real-time checkin changes
    const sub = supabase
      .channel(`checkins-${shopId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_checkins', filter: `shop_id=eq.${shopId}` },
        () => load()
      )
      .subscribe()
    return () => { supabase.removeChannel(sub) }
  }, [shopId])

  async function load() {
    const now = new Date().toISOString()
    const { data } = await supabase
      .from('shop_checkins')
      .select('*, profiles(username, avatar_url)')
      .eq('shop_id', shopId)
      .gt('expires_at', now)
      .order('checked_in_at', { ascending: false })

    setCheckins(data || [])
    setIsCheckedIn((data || []).some((c: any) => c.user_id === profile?.id))
    setLoading(false)
  }

  async function toggle() {
    if (!profile || toggling) return
    setToggling(true)

    if (isCheckedIn) {
      await supabase.from('shop_checkins').delete()
        .eq('user_id', profile.id).eq('shop_id', shopId)
    } else {
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      await supabase.from('shop_checkins').upsert({
        user_id: profile.id,
        shop_id: shopId,
        checked_in_at: new Date().toISOString(),
        expires_at: expiresAt,
      }, { onConflict: 'user_id,shop_id' })
    }

    await load()
    setToggling(false)
  }

  if (loading) return null

  return (
    <div className="px-4 py-3 border-t border-cream-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {checkins.length > 0 && (
            <div className="flex -space-x-2">
              {checkins.slice(0, 4).map(c => (
                <div key={c.id} className="w-6 h-6 rounded-full overflow-hidden bg-coffee-200 border-2 border-white flex-shrink-0">
                  {c.profiles?.avatar_url
                    ? <img src={c.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white text-xs font-bold">{c.profiles?.username?.[0]?.toUpperCase()}</span></div>}
                </div>
              ))}
            </div>
          )}
          <div>
            {checkins.length > 0 ? (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-coffee-700 text-sm font-semibold">
                    {checkins.length} {checkins.length === 1 ? 'person' : 'people'} here now
                  </p>
                </div>
                {checkins.length <= 3 && (
                  <p className="text-coffee-400 text-xs">
                    {checkins.map(c => `@${c.profiles?.username}`).join(', ')}
                  </p>
                )}
              </>
            ) : (
              <p className="text-coffee-400 text-sm">No one checked in yet</p>
            )}
          </div>
        </div>

        <button
          onClick={toggle}
          disabled={toggling}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-40 ${
            isCheckedIn
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'text-white'
          }`}
          style={!isCheckedIn ? { background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' } : {}}
        >
          <MapPin size={12} />
          {isCheckedIn ? 'Checked In ✓' : "I'm here"}
        </button>
      </div>
    </div>
  )
}
