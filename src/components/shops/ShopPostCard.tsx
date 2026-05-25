import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Heart } from 'lucide-react'

interface ShopPost {
  id: string
  shop_id: string
  title: string
  body: string
  photo_url: string | null
  category: string
  created_at: string
  approved_at: string | null
  coffee_shops: {
    id: string
    name: string
    city: string | null
    state: string | null
    photo_url: string | null
  } | null
}

interface Props {
  post: ShopPost
  likedByMe: boolean
  likeCount: number
  profileId: string | null
  onShopClick?: (shop: any) => void
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  'Update': { bg: '#e8f4fd', text: '#0369a1' },
  'Promotion': { bg: '#fef9c3', text: '#854d0e' },
  'Event': { bg: '#f0fdf4', text: '#166534' },
  'New menu item': { bg: '#fdf0dc', text: '#c8853a' },
  'Community': { bg: '#faf5ff', text: '#7e22ce' },
}

export default function ShopPostCard({ post, likedByMe: initialLiked, likeCount: initialCount, profileId, onShopClick }: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  const shop = post.coffee_shops
  const catStyle = CATEGORY_COLORS[post.category] || { bg: '#f5f5f5', text: '#555' }

  async function toggleLike() {
    if (!profileId || loading) return
    setLoading(true)
    if (liked) {
      await supabase.from('shop_post_likes').delete().eq('user_id', profileId).eq('post_id', post.id)
      setLiked(false)
      setCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('shop_post_likes').upsert({ user_id: profileId, post_id: post.id }, { onConflict: 'user_id,post_id' })
      setLiked(true)
      setCount(c => c + 1)
    }
    setLoading(false)
  }

  return (
    <div className="bg-white mx-4 mb-3 rounded-2xl shadow-sm border border-cream-200 overflow-hidden animate-fade-in">
      {/* Shop header */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2">
        <button
          onClick={() => shop && onShopClick && onShopClick(shop)}
          className="w-9 h-9 rounded-full overflow-hidden bg-amber-100 flex-shrink-0 flex items-center justify-center"
        >
          {shop?.photo_url
            ? <img src={shop.photo_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-lg">☕</span>
          }
        </button>
        <div className="flex-1 min-w-0">
          <button
            onClick={() => shop && onShopClick && onShopClick(shop)}
            className="text-coffee-700 font-semibold text-sm hover:text-caramel transition-colors truncate block text-left"
          >
            {shop?.name || 'Unknown shop'}
          </button>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: catStyle.bg, color: catStyle.text }}
            >
              {post.category}
            </span>
            <span className="text-coffee-300 text-xs">·</span>
            <span className="text-coffee-400 text-xs">{timeAgo(post.approved_at || post.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Post image */}
      {post.photo_url && (
        <div className="mx-4 mb-2 rounded-xl overflow-hidden" style={{ maxHeight: 220 }}>
          <img src={post.photo_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Post content */}
      <div className="px-4 pb-2">
        <p className="text-coffee-800 font-semibold text-sm leading-tight mb-1">{post.title}</p>
        <p className="text-coffee-600 text-sm leading-relaxed">{post.body}</p>
      </div>

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <button
          onClick={toggleLike}
          disabled={!profileId || loading}
          className="flex items-center gap-1.5 disabled:opacity-40"
        >
          <Heart
            size={18}
            fill={liked ? '#c8853a' : 'none'}
            className={liked ? 'text-caramel' : 'text-coffee-400'}
          />
          {count > 0 && <span className="text-xs text-coffee-500">{count}</span>}
        </button>
        {shop?.city && (
          <p className="text-xs text-coffee-400">{[shop.city, shop.state].filter(Boolean).join(', ')}</p>
        )}
      </div>
    </div>
  )
}
