/**
 * ShopPhotoGallery.tsx
 *
 * Clean photo grid for a coffee shop — shows photos submitted by users
 * during actual rated visits to this shop.
 *
 * Photos come from the shop_photos table which is populated by the
 * sync_shop_photo database trigger when a rating with a photo is saved.
 *
 * UI: Instagram-style 3-column grid.
 * Tap any photo → fullscreen viewer with:
 *   - Swipe left/right to navigate between photos
 *   - Swipe down to dismiss
 *   - Tappable username/avatar → navigates to that user's profile
 */

import { useState, useEffect, useRef } from 'react'
import { X, Camera, ChevronLeft, ChevronRight } from 'lucide-react'
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
  user_id: string
  profiles: { id: string; username: string; avatar_url: string | null }
}

export default function ShopPhotoGallery({ shopId, shopName, onUserClick }: Props) {
  const [photos, setPhotos] = useState<ShopPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [fullscreenIndex, setFullscreenIndex] = useState<number | null>(null)

  // Swipe state
  const startX = useRef(0)
  const startY = useRef(0)
  const startTime = useRef(0)
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('shop_photos')
        .select('id, photo_url, created_at, user_id, profiles(id, username, avatar_url)')
        .eq('shop_id', shopId)
        .not('photo_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30)

      setPhotos((data || []).filter((p: any) => p.photo_url) as any[])
      setLoading(false)
    }
    load()
  }, [shopId])

  const currentPhoto = fullscreenIndex !== null ? photos[fullscreenIndex] : null

  function openPhoto(index: number) {
    setFullscreenIndex(index)
    setDragX(0)
    setDragY(0)
  }

  function closeFullscreen() {
    setFullscreenIndex(null)
    setDragX(0)
    setDragY(0)
  }

  function goNext() {
    if (fullscreenIndex !== null && fullscreenIndex < photos.length - 1) {
      setFullscreenIndex(i => (i ?? 0) + 1)
      setDragX(0)
    }
  }

  function goPrev() {
    if (fullscreenIndex !== null && fullscreenIndex > 0) {
      setFullscreenIndex(i => (i ?? 0) - 1)
      setDragX(0)
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    startTime.current = Date.now()
    setIsDragging(true)
    setDragX(0)
    setDragY(0)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!isDragging) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    setDragX(dx)
    setDragY(dy)
  }

  function onTouchEnd() {
    if (!isDragging) return
    setIsDragging(false)
    const duration = Date.now() - startTime.current
    const isSwipe = duration < 350

    // Swipe down to dismiss
    if (dragY > 80 && Math.abs(dragY) > Math.abs(dragX)) {
      closeFullscreen()
      return
    }

    // Swipe left/right to navigate
    if (Math.abs(dragX) > 50 && isSwipe && fullscreenIndex !== null) {
      if (dragX < -50 && fullscreenIndex < photos.length - 1) {
        setFullscreenIndex(i => (i ?? 0) + 1)
      } else if (dragX > 50 && fullscreenIndex > 0) {
        setFullscreenIndex(i => (i ?? 0) - 1)
      }
    }

    setDragX(0)
    setDragY(0)
  }

  // Background fades as user drags down
  const bgOpacity = Math.max(0.2, 1 - Math.abs(dragY) / 280)
  const imgTranslateY = dragY > 0 ? dragY : dragY * 0.3

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

  return (
    <>
      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-px bg-cream-200">
        {photos.map((photo, index) => (
          <button
            key={photo.id}
            onClick={() => openPhoto(index)}
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

      {/* Photo count */}
      <p className="text-coffee-400 text-xs text-center py-2">
        {photos.length} photo{photos.length !== 1 ? 's' : ''} from visits
      </p>

      {/* Fullscreen viewer */}
      {currentPhoto && fullscreenIndex !== null && (
        <div
          className="fixed inset-0 z-[90] flex flex-col"
          style={{ background: `rgba(0,0,0,${bgOpacity})` }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Header — tappable user profile */}
          <div
            className="flex items-center justify-between px-4 pt-12 pb-3 flex-shrink-0"
            style={{ background: 'linear-gradient(rgba(0,0,0,0.6), transparent)' }}
          >
            <button
              className="flex items-center gap-2 active:opacity-70 transition-opacity"
              onClick={() => {
                if (currentPhoto.profiles?.id && onUserClick) {
                  closeFullscreen()
                  onUserClick(currentPhoto.profiles.id)
                }
              }}
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-coffee-300 flex-shrink-0 border border-white/30">
                {currentPhoto.profiles?.avatar_url
                  ? <img
                      src={currentPhoto.profiles.avatar_url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                      style={{ transform: 'translateZ(0)' }}
                    />
                  : <div className="w-full h-full flex items-center justify-center bg-caramel">
                      <span className="text-white text-xs font-bold">
                        {currentPhoto.profiles?.username?.[0]?.toUpperCase()}
                      </span>
                    </div>}
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-semibold leading-tight">
                  @{currentPhoto.profiles?.username}
                </p>
                <p className="text-white/50 text-xs">{shopName}</p>
              </div>
            </button>

            <button
              onClick={closeFullscreen}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
            >
              <X size={16} className="text-white" />
            </button>
          </div>

          {/* Photo with drag transform */}
          <div className="flex-1 flex items-center justify-center relative">
            <img
              src={currentPhoto.photo_url}
              alt=""
              className="max-w-full max-h-full object-contain select-none"
              style={{
                transform: `translate(${dragX * 0.15}px, ${imgTranslateY}px)`,
                transition: isDragging ? 'none' : 'transform 0.25s ease',
                userSelect: 'none',
                WebkitUserSelect: 'none',
              }}
              draggable={false}
            />

            {/* Prev/Next arrows — only on non-touch (tablet/desktop) */}
            {fullscreenIndex > 0 && (
              <button
                onClick={goPrev}
                className="absolute left-3 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center hidden md:flex"
              >
                <ChevronLeft size={20} className="text-white" />
              </button>
            )}
            {fullscreenIndex < photos.length - 1 && (
              <button
                onClick={goNext}
                className="absolute right-3 w-9 h-9 rounded-full bg-black/40 flex items-center justify-center hidden md:flex"
              >
                <ChevronRight size={20} className="text-white" />
              </button>
            )}
          </div>

          {/* Dot indicators + count */}
          <div className="pb-10 pt-3 flex flex-col items-center gap-2 flex-shrink-0">
            {photos.length > 1 && (
              <div className="flex items-center gap-1.5">
                {photos.map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all"
                    style={{
                      width: i === fullscreenIndex ? 6 : 4,
                      height: i === fullscreenIndex ? 6 : 4,
                      background: i === fullscreenIndex ? 'white' : 'rgba(255,255,255,0.35)',
                    }}
                  />
                ))}
              </div>
            )}
            <p className="text-white/40 text-xs">
              {fullscreenIndex + 1} of {photos.length}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
