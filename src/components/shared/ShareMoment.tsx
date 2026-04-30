/**
 * ShareMoment.tsx (renamed to "Share a Vibe" in the UI)
 * 
 * Allows users to share a photo or text post without rating a coffee shop.
 * This is purely social — no fill level, no shop association, no rating.
 * 
 * Stored in the ratings table with:
 *   - fill_level: 0 (distinguishes it from actual ratings which are 1-100)
 *   - shop_id: null (no shop associated)
 *   - vibe_tags: [] (optional vibe tags)
 * 
 * Does NOT trigger the shop photo sync since shop_id is null.
 * Does NOT count toward streak calculations (no shop visit).
 * DOES appear in the social feed alongside rated visits.
 */

import { useState, useRef } from 'react'
import { X, Camera, Smile } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

type Props = { onClose: () => void; onComplete: (shopName?: string) => void }

// Vibe options for mood tagging without a rating
const VIBE_OPTIONS = ['☕ Cozy', '⚡ Energizing', '❤️ Loved', '📚 Quiet', '🎉 Social', '🌙 Date Night', '💻 Work-friendly', '✨ Aesthetic']

export default function ShareMoment({ onClose, onComplete }: Props) {
  const { profile } = useAuth()
  const [caption, setCaption] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [selectedVibes, setSelectedVibes] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please select an image'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10MB'); return }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setError('')
  }

  function toggleVibe(vibe: string) {
    setSelectedVibes(prev =>
      prev.includes(vibe) ? prev.filter(v => v !== vibe) : prev.length < 3 ? [...prev, vibe] : prev
    )
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
          .from('avatars')
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

    /**
     * Insert as a social post — fill_level: 0 marks it as a "vibe post"
     * not an actual drink rating. This distinguishes it in the feed
     * and prevents it from affecting shop statistics or streak counts.
     */
    const { error: postErr } = await supabase.from('ratings').insert({
      user_id: profile.id,
      shop_id: null,
      fill_level: 0,        // Vibe posts always 0 — no drink rating
      caption: caption.trim() || null,
      photo_url: photoUrl,
      vibe_tags: selectedVibes,
      is_quick_sip: false,  // Explicitly not a quick sip
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
      style={{ background: 'rgba(8,4,1,0.92)' }}>
      <div className="w-full max-w-sm rounded-t-3xl animate-slide-up overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #f5ead8, #efe0c4)' }}>

        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="text-coffee-800 font-display text-xl font-bold">Share a Vibe</h2>
            <p className="text-coffee-400 text-xs mt-0.5">Share a coffee moment without rating</p>
          </div>
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
              className="w-full h-36 rounded-2xl border-2 border-dashed border-coffee-200 flex flex-col items-center justify-center gap-2 bg-white/50 hover:bg-white/70 transition-colors">
              <Camera size={22} className="text-caramel" />
              <p className="text-coffee-500 text-sm font-medium">Add a photo <span className="text-coffee-400 font-normal">(optional)</span></p>
            </button>
          )}

          <input ref={fileRef} type="file" accept="image/*"
            onChange={handlePhotoSelect} className="hidden" />

          {/* Caption */}
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="What's your coffee vibe right now?"
            rows={2}
            className="w-full bg-white/70 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-300 focus:border-caramel focus:outline-none placeholder-coffee-300 resize-none"
          />

          {/* Vibe tags */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Smile size={13} className="text-coffee-400" />
              <p className="text-coffee-500 text-xs font-medium">Tag your vibe (up to 3)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {VIBE_OPTIONS.map(vibe => (
                <button
                  key={vibe}
                  onClick={() => toggleVibe(vibe)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    selectedVibes.includes(vibe)
                      ? 'text-white border-transparent'
                      : 'bg-cream-50 text-coffee-500 border-cream-200'
                  }`}
                  style={selectedVibes.includes(vibe) ? { background: '#c8853a' } : {}}
                >
                  {vibe}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading || (!caption.trim() && !photo)}
            className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all duration-300 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #c8853a, #a06428)', boxShadow: '0 8px 24px rgba(200,133,58,0.35)' }}>
            {loading ? 'Sharing...' : 'Share Vibe ✨'}
          </button>
        </div>
      </div>
    </div>
  )
}
