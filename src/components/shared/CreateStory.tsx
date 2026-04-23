// src/components/shared/CreateStory.tsx
// Create a standalone story (text or photo) not tied to a rating

import { useState, useRef } from 'react'
import { X, Camera, Type } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { sendPushToUser } from '../../lib/push'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  onClose: () => void
  onCreated: () => void
  // Optional: pre-fill from a rating post
  prefillPhoto?: string | null
  prefillCaption?: string
  prefillShopId?: string | null
  prefillRatingId?: string | null
}

export default function CreateStory({ onClose, onCreated, prefillPhoto, prefillCaption, prefillShopId, prefillRatingId }: Props) {
  const { profile } = useAuth()
  const [mode, setMode] = useState<'choose' | 'photo' | 'text'>(
    prefillPhoto ? 'photo' : 'choose'
  )
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(prefillPhoto || null)
  const [caption, setCaption] = useState(prefillCaption || '')
  const [posting, setPosting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setMode('photo')
  }

  async function handlePost() {
    if (!profile) return
    setPosting(true)

    let photoUrl: string | null = prefillPhoto || null

    // Upload new photo if selected
    if (photo) {
      const ext = photo.name.split('.').pop() || 'jpg'
      const path = `stories/${profile.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, photo, { upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        photoUrl = publicUrl
      }
    }

    const storyType = prefillRatingId ? 'rating' : photoUrl ? 'moment' : 'text'

    await supabase.from('stories').insert({
      user_id: profile.id,
      shop_id: prefillShopId || null,
      rating_id: prefillRatingId || null,
      photo_url: photoUrl,
      caption: caption.trim() || null,
      story_type: storyType,
    })

    // Notify followers about new story
    try {
      const { data: followers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', profile.id)
      if (followers && followers.length > 0) {
        const storyLabel = storyType === 'rating' ? 'rated a coffee visit' : 'posted a new story'
        await Promise.all(
          followers.map((f: any) =>
            sendPushToUser(
              f.follower_id,
              `${profile.username || 'Someone'} ${storyLabel}`,
              caption.trim() || (photoUrl ? '📷 Photo' : '☕'),
              { type: 'story', actorId: profile.id }
            )
          )
        )
      }
    } catch {}

    setPosting(false)
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[85] flex flex-col" style={{ background: 'rgba(8,4,1,0.97)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4 flex-shrink-0">
        <h2 className="text-white font-display text-xl font-bold">New Story</h2>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
          <X size={16} className="text-white" />
        </button>
      </div>

      {/* Mode chooser */}
      {mode === 'choose' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-5 rounded-2xl flex items-center gap-4 px-6"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div className="w-12 h-12 rounded-xl bg-caramel/20 flex items-center justify-center">
              <Camera size={22} className="text-caramel" />
            </div>
            <div className="text-left">
              <p className="text-white font-semibold">Photo Story</p>
              <p className="text-white/40 text-sm">Share a moment from your visit</p>
            </div>
          </button>
          <button
            onClick={() => setMode('text')}
            className="w-full py-5 rounded-2xl flex items-center gap-4 px-6"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div className="w-12 h-12 rounded-xl bg-blue-400/20 flex items-center justify-center">
              <Type size={22} className="text-blue-300" />
            </div>
            <div className="text-left">
              <p className="text-white font-semibold">Text Story</p>
              <p className="text-white/40 text-sm">Share a thought or coffee moment</p>
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
        </div>
      )}

      {/* Photo preview */}
      {mode === 'photo' && (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 relative mx-4 rounded-2xl overflow-hidden bg-coffee-900">
            {photoPreview && <img src={photoPreview} alt="" className="w-full h-full object-cover" />}
            {!prefillPhoto && (
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
              >
                <Camera size={18} className="text-white" />
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
          <div className="px-5 py-4">
            <input
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Add a caption..."
              className="w-full bg-white/10 text-white rounded-xl px-4 py-3 text-sm border border-white/10 focus:border-caramel focus:outline-none placeholder-white/30 mb-4"
            />
            <button
              onClick={handlePost}
              disabled={posting}
              className="w-full py-3.5 rounded-2xl text-white font-bold text-sm disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
            >
              {posting ? 'Posting...' : 'Share Story'}
            </button>
          </div>
        </div>
      )}

      {/* Text story */}
      {mode === 'text' && (
        <div className="flex-1 flex flex-col px-5">
          <div
            className="flex-1 rounded-2xl flex items-center justify-center p-8 mb-4"
            style={{ background: 'linear-gradient(160deg, #1a0a02, #3d1a06, #6b3410)' }}
          >
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="What's your coffee thought?"
              autoFocus
              className="w-full bg-transparent text-white text-2xl font-display font-bold text-center placeholder-white/30 focus:outline-none resize-none"
              rows={4}
            />
          </div>
          <button
            onClick={handlePost}
            disabled={!caption.trim() || posting}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm disabled:opacity-40 mb-8"
            style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
          >
            {posting ? 'Posting...' : 'Share Story'}
          </button>
        </div>
      )}
    </div>
  )
}
