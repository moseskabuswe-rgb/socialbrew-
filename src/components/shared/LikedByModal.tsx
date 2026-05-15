// src/components/shared/LikedByModal.tsx
// Shows who liked a post/rating — tap username to view profile

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Props {
  ratingId: string
  onClose: () => void
  onViewProfile: (userId: string) => void
}

interface Liker {
  id: string
  username: string
  avatar_url: string | null
  badge: string | null
}

export default function LikedByModal({ ratingId, onClose, onViewProfile }: Props) {
  const [likers, setLikers] = useState<Liker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('likes')
        .select('user_id, profiles!likes_user_id_fkey(id, username, avatar_url, badge)')
        .eq('rating_id', ratingId)
        .order('created_at', { ascending: false })
        .limit(100)

      setLikers(
        (data || [])
          .map((d: any) => d.profiles)
          .filter(Boolean)
      )
      setLoading(false)
    }
    load()
  }, [ratingId])

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.85)' }}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up"
        style={{ maxHeight: '70vh' }}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <h3 className="font-display font-bold text-coffee-800 text-lg">
            {loading ? 'Likes' : `${likers.length} Like${likers.length !== 1 ? 's' : ''}`}
          </h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 65px)' }}>
          {loading && (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
            </div>
          )}
          {!loading && likers.length === 0 && (
            <div className="text-center py-10">
              <p className="text-3xl mb-2">❤️</p>
              <p className="text-coffee-400 text-sm">No likes yet</p>
            </div>
          )}
          {likers.map(user => (
            <button
              key={user.id}
              onClick={() => { onClose(); onViewProfile(user.id) }}
              className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-cream-100 hover:bg-cream-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
                  : <div className="w-full h-full flex items-center justify-center bg-caramel">
                      <span className="text-white font-bold text-sm">{user.username?.[0]?.toUpperCase()}</span>
                    </div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-coffee-800 font-semibold text-sm">{user.username}</p>
                {user.badge && <p className="text-coffee-400 text-xs">{user.badge}</p>}
              </div>
              <span className="text-red-400 text-lg">❤️</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
