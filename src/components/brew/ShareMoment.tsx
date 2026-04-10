import { useState, useRef } from 'react'
import { X, Camera } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

type Props = { onClose: () => void; onComplete: (shopName?: string) => void }

export default function ShareMoment({ onClose, onComplete }: Props) {
  const { profile } = useAuth()
  const [caption, setCaption] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please select an image'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10MB'); return }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setError('')
  }

  async function handleSubmit() {
    if (!profile) return
    if (!caption.trim() && !photo) { setError('Add a photo or caption'); return }
    setLoading(true)
    setError('')

    let photoUrl: string | null = null

    // Upload photo if selected
    if (photo) {
      try {
        const ext = photo.name.split('.').pop() || 'jpg'
        const path = `moments/${profile.id}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('avatars') // reuse avatars bucket for now
          .upload(path, photo, { upsert: true })

        if (uploadErr) throw uploadErr
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        photoUrl = publicUrl
      } catch (err: any) {
        setError(`Photo upload failed: ${err.message}`)
        setLoading(false)
        return
      }
    }

    const { error: postErr } = await supabase.from('ratings').insert({
      user_id: profile.id,
      shop_id: null,
      fill_level: 50,
      caption: caption.trim() || null,
      photo_url: photoUrl,
      vibe_tags: [],
    })

    if (postErr) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    setLoading(false)
    onComplete()
    onClose()

  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.92)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-sm rounded-t-3xl animate-slide-up overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #f5ead8, #efe0c4)' }}>

        <div className="flex items-center justify-between p-5 pb-4">
          <h2 className="text-coffee-800 font-display text-xl font-bold">Share a Moment</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cream-200 flex items-center justify-center text-coffee-500">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pb-6 space-y-4">
          {/* Photo picker */}
          {photoPreview ? (
            <div className="relative rounded-2xl overflow-hidden h-48">
              <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
              <button onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                <X size={14} className="text-white" />
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              className="w-full h-40 rounded-2xl border-2 border-dashed border-coffee-200 flex flex-col items-center justify-center gap-2 bg-white/50 hover:bg-white/70 transition-colors">
              <div className="w-12 h-12 rounded-full bg-latte flex items-center justify-center">
                <Camera size={22} className="text-caramel" />
              </div>
              <p className="text-coffee-500 text-sm font-medium">Add a photo</p>
              <p className="text-coffee-400 text-xs">Tap to choose from your library</p>
            </button>
          )}

          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            onChange={handlePhotoSelect} className="hidden" />

          <textarea value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="What's your coffee moment?"
            rows={3}
            className="w-full bg-white/70 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-300 focus:border-caramel focus:outline-none placeholder-coffee-300 resize-none" />

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button onClick={handleSubmit}
            disabled={loading || (!caption.trim() && !photo)}
            className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all duration-300 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #c8853a, #a06428)', boxShadow: '0 8px 24px rgba(200,133,58,0.35)' }}>
            {loading ? 'Sharing...' : 'Share to Feed ☕'}
          </button>
        </div>
      </div>
    </div>
  )
}
