import { useState, useEffect, useRef } from 'react'
import { X, Camera } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Props {
  shopId: string
  shopName: string
  onUserClick?: (userId: string) => void
}

interface ShopPhoto {
  id: string
  photo_url: string
  created_at: string
  profiles: { id: string; username: string; avatar_url: string | null }
}

export default function ShopPhotoGallery({ shopId, shopName, onUserClick }: Props) {
  const [photos, setPhotos] = useState<ShopPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('shop_photos')
        .select('id, photo_url, created_at, profiles(id, username, avatar_url)')
        .eq('shop_id', shopId)
        .not('photo_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30)

      setPhotos((data || []).filter((p: any) => p.photo_url) as any[])
      setLoading(false)
    }
    load()
  }, [shopId])

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null || fullscreenIndex === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null

    if (Math.abs(dy) > Math.abs(dx)) {
      if (dy > 80) setFullscreenIndex(null)
    } else {
      if (dx < -60 && fullscreenIndex < photos.length - 1) setFullscreenIndex(fullscreenIndex + 1)
      if (dx > 60 && fullscreenIndex > 0) setFullscreenIndex(fullscreenIndex - 1)
    }
  }

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
    </div>
  )

  if (photos.length === 0) return (
    <div className="text-center py-10 px-4">
      <Camera size={28} className="text-coffee-200 mx-auto mb-2" />
      <p className="text-coffee-400 text-sm font-medium">No photos yet</p>
      <p className="text-coffee-300 text-xs mt-1">Rate a visit and add a photo to be the first</p>
    </div>
  )

  const current = fullscreenIndex !== null ? photos[fullscreenIndex] : null

  return (
    <>
      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-px bg-cream-200">
        {photos.map((photo, i) => (
          <button
            key={photo.id}
            onClick={() => setFullscreenIndex(i)}
            className="aspect-square overflow-hidden bg-cream-100 relative group"
          >
            <img
              src={photo.photo_url}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover transition-opacity group-active:opacity-80"
              style={{ transform: 'translateZ(0)' }}
            />
          </button>
        ))}
      </div>

      <p className="text-coffee-400 text-xs text-center py-2">
        {photos.length} photo{photos.length !== 1 ? 's' : ''} from visits
      </p>

      {/* Fullscreen viewer */}
      {current !== null && fullscreenIndex !== null && (
        <div
          className="fixed inset-0 z-[90] bg-black flex flex-col"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-safe pb-3 flex-shrink-0"
            style={{ background: 'linear-gradient(rgba(0,0,0,0.6), transparent)' }}>
            <button
              className="flex items-center gap-2"
              onClick={() => {
                if (onUserClick && current.profiles?.id) {
                  onUserClick(current.profiles.id)
                  setFullscreenIndex(null)
                }
              }}
            >
              <div className="w-7 h-7 rounded-full overflow-hidden bg-coffee-300 flex-shrink-0">
                {current.profiles?.avatar_url
                  ? <img src={current.profiles.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
                  : <div className="w-full h-full flex items-center justify-center bg-caramel">
                      <span className="text-white text-xs font-bold">{current.profiles?.username?.[0]?.toUpperCase()}</span>
                    </div>}
              </div>
              <p className="text-white text-sm font-semibold">@{current.profiles?.username}</p>
            </button>
            <button
              onClick={() => setFullscreenIndex(null)}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <X size={16} className="text-white" />
            </button>
          </div>

          {/* Photo */}
          <div className="flex-1 flex items-center justify-center">
            <img
              src={current.photo_url}
              alt=""
              className="max-w-full max-h-full object-contain"
              style={{ transform: 'translateZ(0)' }}
            />
          </div>

          {/* Bottom: dot indicators + shop name */}
          <div className="pb-10 pt-3 flex flex-col items-center gap-2">
            {photos.length > 1 && (
              <div className="flex gap-1.5">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setFullscreenIndex(i)}
                    className={`rounded-full transition-all ${i === fullscreenIndex ? 'bg-white w-2 h-2' : 'bg-white/40 w-1.5 h-1.5'}`}
                  />
                ))}
              </div>
            )}
            <p className="text-white/50 text-xs">{shopName}</p>
          </div>
        </div>
      )}
    </>
  )
}
