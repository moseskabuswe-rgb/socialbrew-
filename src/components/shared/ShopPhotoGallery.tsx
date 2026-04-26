/**
 * ShopPhotoGallery.tsx
 * 
 * Clean photo grid for a coffee shop — shows photos submitted by users
 * during actual rated visits to this shop.
 * 
 * Photos come from the shop_photos table which is populated by the
 * sync_shop_photo database trigger when a rating with a photo is saved.
 * 
 * Only shows photos from ratings where:
 *   - shop_id matches this shop
 *   - photo_url is not null
 *   - fill_level > 0 (actual visit, not a vibe post)
 * 
 * UI is a clean Instagram-style 3-column grid.
 * Tap any photo for fullscreen with photographer attribution.
 */

import { useState, useEffect } from 'react'
import { X, Camera } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Props {
  shopId: string
  shopName: string
}

interface ShopPhoto {
  id: string
  photo_url: string
  created_at: string
  profiles: { username: string; avatar_url: string | null }
}

export default function ShopPhotoGallery({ shopId, shopName }: Props) {
  const [photos, setPhotos] = useState<ShopPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [fullscreen, setFullscreen] = useState<ShopPhoto | null>(null)

  useEffect(() => {
    async function load() {
      /**
       * Query shop_photos joined with profiles.
       * Only show photos from actual rated visits (fill_level > 0).
       * Limit to 30 most recent for performance.
       */
      const { data } = await supabase
        .from('shop_photos')
        .select(`
          id,
          photo_url,
          created_at,
          profiles(username, avatar_url),
          ratings!inner(fill_level)
        `)
        .eq('shop_id', shopId)
        .gt('ratings.fill_level', 0) // Only from actual drink ratings, not vibe posts
        .order('created_at', { ascending: false })
        .limit(30)

      setPhotos((data || []).filter((p: any) => p.photo_url))
      setLoading(false)
    }
    load()
  }, [shopId])

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
      {/* Clean 3-column grid — no text, just photos */}
      <div className="grid grid-cols-3 gap-px bg-cream-200">
        {photos.map(photo => (
          <button
            key={photo.id}
            onClick={() => setFullscreen(photo)}
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
      {fullscreen && (
        <div className="fixed inset-0 z-[90] bg-black flex flex-col">
          {/* Minimal header */}
          <div className="flex items-center justify-between px-4 pt-12 pb-3 flex-shrink-0"
            style={{ background: 'linear-gradient(rgba(0,0,0,0.6), transparent)' }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full overflow-hidden bg-coffee-300 flex-shrink-0">
                {fullscreen.profiles?.avatar_url
                  ? <img src={fullscreen.profiles.avatar_url} alt="" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
                  : <div className="w-full h-full flex items-center justify-center bg-caramel">
                      <span className="text-white text-xs font-bold">{fullscreen.profiles?.username?.[0]?.toUpperCase()}</span>
                    </div>}
              </div>
              <p className="text-white text-sm font-semibold">@{fullscreen.profiles?.username}</p>
            </div>
            <button
              onClick={() => setFullscreen(null)}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <X size={16} className="text-white" />
            </button>
          </div>

          {/* Photo */}
          <div className="flex-1 flex items-center justify-center">
            <img
              src={fullscreen.photo_url}
              alt=""
              className="max-w-full max-h-full object-contain"
              style={{ transform: 'translateZ(0)' }}
            />
          </div>

          {/* Shop name at bottom */}
          <div className="pb-10 pt-3 text-center">
            <p className="text-white/50 text-xs">{shopName}</p>
          </div>
        </div>
      )}
    </>
  )
}
