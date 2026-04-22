// src/components/shared/ShopPhotoGallery.tsx
// Scrollable grid of user-submitted photos for a shop

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
      const { data } = await supabase
        .from('shop_photos')
        .select('*, profiles(username, avatar_url)')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(30)
      setPhotos(data || [])
      setLoading(false)
    }
    load()
  }, [shopId])

  if (loading) return (
    <div className="flex justify-center py-6">
      <div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
    </div>
  )

  if (photos.length === 0) return (
    <div className="text-center py-8">
      <Camera size={28} className="text-coffee-300 mx-auto mb-2" />
      <p className="text-coffee-400 text-sm">No photos yet</p>
      <p className="text-coffee-300 text-xs mt-1">Photos from visits will appear here</p>
    </div>
  )

  return (
    <>
      <div className="grid grid-cols-3 gap-0.5">
        {photos.map(photo => (
          <button
            key={photo.id}
            onClick={() => setFullscreen(photo)}
            className="aspect-square overflow-hidden bg-cream-100 relative"
          >
            <img
              src={photo.photo_url}
              alt=""
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* Fullscreen view */}
      {fullscreen && (
        <div className="fixed inset-0 z-[90] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 pt-12 pb-3 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full overflow-hidden bg-coffee-300">
                {fullscreen.profiles?.avatar_url
                  ? <img src={fullscreen.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white text-xs font-bold">{fullscreen.profiles?.username?.[0]?.toUpperCase()}</span></div>}
              </div>
              <div>
                <p className="text-white text-sm font-semibold">@{fullscreen.profiles?.username}</p>
                <p className="text-white/40 text-xs">{shopName}</p>
              </div>
            </div>
            <button onClick={() => setFullscreen(null)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <X size={16} className="text-white" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <img src={fullscreen.photo_url} alt="" className="max-w-full max-h-full object-contain" />
          </div>
        </div>
      )}
    </>
  )
}
