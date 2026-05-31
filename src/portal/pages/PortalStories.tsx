import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import CreateStory from '../../components/shared/CreateStory'
import { Plus, Eye } from 'lucide-react'

interface Props {
  shop: { id: string; name: string }
  userId: string
}

interface ShopStory {
  id: string
  photo_url: string | null
  caption: string | null
  created_at: string
  expires_at: string
  view_count: number
}

function hoursLeft(expiresAt: string) {
  const h = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 3600000)
  return h < 1 ? 'Expires soon' : `${h}h left`
}

export default function PortalStories({ shop }: Props) {
  const [stories, setStories] = useState<ShopStory[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { load() }, [shop.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('stories')
      .select('id, photo_url, caption, created_at, expires_at, view_count')
      .eq('shop_id', shop.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    setStories(data || [])
    setLoading(false)
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Stories</h1>
          <p className="text-sm text-gray-500 mt-0.5">Stories expire after 24 hours</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: '#c8853a' }}
        >
          <Plus size={16} />
          New Story
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
        </div>
      ) : stories.length === 0 ? (
        <div className="bg-white rounded-xl border border-cream-200 p-8 text-center">
          <p className="text-3xl mb-2">📸</p>
          <p className="text-sm text-coffee-600 font-medium">No active stories</p>
          <p className="text-xs text-coffee-400 mt-1">Share a moment with your followers — stories last 24 hours</p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 px-5 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: '#c8853a' }}
          >
            Post your first story
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {stories.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-cream-200 overflow-hidden">
              {s.photo_url ? (
                <img src={s.photo_url} alt="" className="w-full h-36 object-cover" />
              ) : (
                <div className="w-full h-36 flex items-center justify-center px-3"
                  style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}>
                  <p className="text-white text-xs font-medium text-center line-clamp-5">{s.caption}</p>
                </div>
              )}
              <div className="p-2.5">
                {s.photo_url && s.caption && (
                  <p className="text-xs text-coffee-600 line-clamp-2 mb-1.5">{s.caption}</p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-coffee-400">
                    <Eye size={12} />
                    <span className="text-xs">{s.view_count || 0}</span>
                  </div>
                  <span className="text-[10px] text-coffee-300">{hoursLeft(s.expires_at)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateStory
          prefillShopId={shop.id}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      )}
    </div>
  )
}
