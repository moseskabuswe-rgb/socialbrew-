/**
 * EditPostModal.tsx
 * 
 * Full post editing experience for the user's own posts.
 * Allows editing:
 *   - Caption text
 *   - Vibe tags (up to 3)
 *   - Fill level / drink rating (for rated visits)
 *   - Photo (add or replace)
 * 
 * Does NOT allow editing:
 *   - Shop association (would affect statistics)
 *   - Post type (can't convert a vibe post to a rating)
 *   - Created timestamp
 * 
 * On save, updates the ratings row and refreshes the feed in place.
 */

import { useState, useRef } from 'react'
import { X, Camera, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  rating: any
  onClose: () => void
  onSaved: (updated: any) => void
}

const VIBE_OPTIONS = ['☕ Cozy', '⚡ Energizing', '❤️ Loved', '📚 Quiet', '🎉 Social', '🌙 Date Night', '💻 Work-friendly', '✨ Aesthetic']

function getFillLabel(fill: number) {
  if (fill === 0)  return ''
  if (fill <= 59)  return 'Not My Cup'
  if (fill <= 69)  return 'Just a Sip'
  if (fill <= 79)  return 'Decent Pour'
  if (fill <= 89)  return 'Good Brew'
  if (fill <= 99)  return 'Loved It'
  return 'Perfect Brew ✨'
}

export default function EditPostModal({ rating, onClose, onSaved }: Props) {
  const { profile } = useAuth()

  // Pre-fill from existing post
  const [caption, setCaption] = useState(rating.caption || '')
  const [fillLevel, setFillLevel] = useState(rating.fill_level || 0)
  const [vibes, setVibes] = useState<string[]>(rating.vibe_tags || [])
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(rating.photo_url || null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Is this an actual drink rating (fill_level > 0) or a vibe post?
  const isRating = rating.fill_level > 0

  function toggleVibe(vibe: string) {
    setVibes(prev =>
      prev.includes(vibe) ? prev.filter(v => v !== vibe) : prev.length < 3 ? [...prev, vibe] : prev
    )
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please select an image'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10MB'); return }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setRemovePhoto(false)
    setError('')
  }

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    setError('')

    try {
      let photoUrl = rating.photo_url
      let photoUrls: string[] | null = rating.photo_urls ?? null

      // Handle photo changes
      if (removePhoto) {
        photoUrl = null
        photoUrls = null
      } else if (photo) {
        // Upload new photo
        const ext = photo.name.split('.').pop() || 'jpg'
        const path = `moments/${profile.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, photo, { upsert: true })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        photoUrl = publicUrl
        // Replace the old primary photo in the array; preserve any extras
        const existing: string[] = rating.photo_urls || (rating.photo_url ? [rating.photo_url] : [])
        photoUrls = [publicUrl, ...existing.filter((u: string) => u !== rating.photo_url)]
      }

      // Update the rating row — DB trigger handles shop_photos sync automatically
      const { data, error: updateErr } = await supabase
        .from('ratings')
        .update({
          caption: caption.trim() || null,
          fill_level: fillLevel,
          vibe_tags: vibes,
          photo_url: photoUrl,
          photo_urls: photoUrls,
        })
        .eq('id', rating.id)
        .eq('user_id', profile.id)
        .select()
        .single()

      if (updateErr) throw updateErr

      onSaved({ ...rating, ...data })
      onClose()
    } catch (err: any) {
      setError(`Save failed: ${err.message}`)
    }

    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.92)' }}>
      <div className="w-full max-w-sm rounded-t-3xl animate-slide-up overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #fdfaf5, #f5ead8)', maxHeight: '90vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <h2 className="text-coffee-800 font-display text-xl font-bold">Edit Post</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5 pb-8">

          {/* Fill level — only for actual ratings */}
          {isRating && (
            <div>
              <p className="text-coffee-600 text-xs font-semibold mb-2">How was the drink?</p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={fillLevel}
                  onChange={e => setFillLevel(Number(e.target.value))}
                  className="flex-1 accent-caramel"
                />
                <span className="text-coffee-800 font-bold text-sm w-10 text-right">{fillLevel}%</span>
              </div>
              {/* Visual fill indicator */}
              <div className="mt-2 h-2 bg-cream-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${fillLevel}%`,
                    background: fillLevel <= 59 ? '#d4b896' : fillLevel <= 69 ? '#c49a6c' : fillLevel <= 79 ? '#b87333' : fillLevel <= 89 ? '#9b5e1a' : fillLevel <= 99 ? '#6b3410' : '#3d1a06'
                  }}
                />
              </div>
              <p className="text-xs font-semibold mt-1" style={{ color: '#c8853a' }}>{getFillLabel(fillLevel)}</p>
            </div>
          )}

          {/* Photo */}
          <div>
            <p className="text-coffee-600 text-xs font-semibold mb-2">Photo</p>
            {photoPreview && !removePhoto ? (
              <div className="relative rounded-2xl overflow-hidden h-40">
                <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 flex gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                    <Camera size={12} className="text-white" />
                  </button>
                  <button
                    onClick={() => { setRemovePhoto(true); setPhotoPreview(null); setPhoto(null) }}
                    className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                    <X size={12} className="text-white" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-28 rounded-2xl border-2 border-dashed border-cream-300 flex flex-col items-center justify-center gap-1 bg-cream-50 hover:bg-cream-100 transition-colors">
                <Camera size={18} className="text-coffee-400" />
                <p className="text-coffee-400 text-xs">{rating.photo_url && removePhoto ? 'Photo removed — tap to add new' : 'Add a photo'}</p>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
          </div>

          {/* Caption */}
          <div>
            <p className="text-coffee-600 text-xs font-semibold mb-2">Caption</p>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="What's on your mind?"
              rows={3}
              className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300 resize-none"
            />
          </div>

          {/* Vibe tags */}
          <div>
            <p className="text-coffee-600 text-xs font-semibold mb-2">Vibes (up to 3)</p>
            <div className="flex flex-wrap gap-2">
              {VIBE_OPTIONS.map(vibe => (
                <button
                  key={vibe}
                  onClick={() => toggleVibe(vibe)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                    vibes.includes(vibe)
                      ? 'text-white border-transparent'
                      : 'bg-cream-50 text-coffee-500 border-cream-200'
                  }`}
                  style={vibes.includes(vibe) ? { background: '#c8853a' } : {}}
                >
                  {vibe}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}>
            {saving ? 'Saving...' : <><Check size={16} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  )
}
