import { useState } from 'react'
import { X, Camera } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

type Props = { onClose: () => void; onComplete: () => void }

export default function ShareMoment({ onClose, onComplete }: Props) {
  const { profile } = useAuth()
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!profile || !caption.trim()) return
    setLoading(true)
    // For MVP, share moment creates a rating with no shop and fill_level 50 as placeholder
    // In future this will have photo upload
    const { error } = await supabase.from('ratings').insert({
      user_id: profile.id,
      shop_id: null,
      fill_level: 50,
      caption,
      vibe_tags: [],
    })
    setLoading(false)
    if (!error) { onComplete(); onClose() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(13,9,4,0.92)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm bg-coffee-700 rounded-t-3xl animate-slide-up p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-display text-xl font-bold">Share a Moment</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-coffee-600 flex items-center justify-center text-coffee-300">
            <X size={16} />
          </button>
        </div>

        <div className="bg-coffee-800 rounded-2xl p-8 mb-4 flex flex-col items-center justify-center border-2 border-dashed border-coffee-600 cursor-pointer hover:border-caramel transition-colors">
          <Camera size={28} className="text-coffee-400 mb-2" />
          <p className="text-coffee-400 text-sm">Photo upload coming soon</p>
          <p className="text-coffee-500 text-xs mt-1">Add a caption below to share</p>
        </div>

        <textarea value={caption} onChange={e => setCaption(e.target.value)}
          placeholder="What's your coffee moment?"
          rows={3}
          className="w-full bg-coffee-800 text-white rounded-xl px-4 py-3 text-sm border border-coffee-600 focus:border-caramel focus:outline-none placeholder-coffee-400 resize-none mb-4" />

        <button onClick={handleSubmit} disabled={!caption.trim() || loading}
          className="w-full py-3.5 rounded-2xl font-semibold text-white bg-caramel disabled:opacity-40 transition-all"
          style={{ boxShadow: caption.trim() ? '0 8px 30px rgba(200,133,58,0.4)' : 'none' }}>
          {loading ? 'Sharing...' : 'Share to Feed'}
        </button>
      </div>
    </div>
  )
}
