import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Heart, MessageCircle, Send } from 'lucide-react'

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

interface Comment {
  id: string
  user_id: string
  content: string
  created_at: string
  profiles: { username: string; avatar_url: string | null } | null
}

interface Props {
  post: ShopPost
  likedByMe: boolean
  likeCount: number
  commentCount: number
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
  update:  { bg: '#e8f4fd', text: '#0369a1' },
  event:   { bg: '#f0fdf4', text: '#166534' },
  menu:    { bg: '#fdf0dc', text: '#c8853a' },
  special: { bg: '#fef9c3', text: '#854d0e' },
}

export default function ShopPostCard({ post, likedByMe: initialLiked, likeCount: initialCount, commentCount: initialCommentCount, profileId, onShopClick }: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [likeLoading, setLikeLoading] = useState(false)

  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [commentCount, setCommentCount] = useState(initialCommentCount)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const shop = post.coffee_shops
  const catStyle = CATEGORY_COLORS[post.category] || { bg: '#f5f5f5', text: '#555' }

  async function toggleLike() {
    if (!profileId || likeLoading) return
    setLikeLoading(true)
    if (liked) {
      await supabase.from('shop_post_likes').delete().eq('user_id', profileId).eq('post_id', post.id)
      setLiked(false)
      setCount(c => Math.max(0, c - 1))
    } else {
      await supabase.from('shop_post_likes').upsert({ user_id: profileId, post_id: post.id }, { onConflict: 'user_id,post_id' })
      setLiked(true)
      setCount(c => c + 1)
    }
    setLikeLoading(false)
  }

  async function loadComments() {
    const { data } = await supabase
      .from('shop_post_comments')
      .select('id, user_id, content, created_at, profiles:user_id(username, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true })
      .limit(50)
    setComments((data as any) || [])
    setCommentsLoaded(true)
  }

  async function toggleComments() {
    if (!showComments && !commentsLoaded) await loadComments()
    setShowComments(v => !v)
  }

  async function submitComment() {
    if (!profileId || !commentText.trim() || submitting) return
    setSubmitting(true)
    const { data, error } = await supabase
      .from('shop_post_comments')
      .insert({ post_id: post.id, user_id: profileId, content: commentText.trim() })
      .select('id, user_id, content, created_at, profiles:user_id(username, avatar_url)')
      .single()
    setSubmitting(false)
    if (!error && data) {
      setComments(prev => [...prev, data as any])
      setCommentCount(c => c + 1)
      setCommentText('')
    }
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
      <div className="px-4 pb-3 flex items-center gap-4">
        <button
          onClick={toggleLike}
          disabled={!profileId || likeLoading}
          className="flex items-center gap-1.5 disabled:opacity-40"
        >
          <Heart
            size={18}
            fill={liked ? '#c8853a' : 'none'}
            className={liked ? 'text-caramel' : 'text-coffee-400'}
          />
          {count > 0 && <span className="text-xs text-coffee-500">{count}</span>}
        </button>
        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 hover:text-coffee-600 transition-colors"
        >
          <MessageCircle size={18} className={showComments ? 'text-caramel' : 'text-coffee-400'} />
          {commentCount > 0 && <span className="text-xs text-coffee-500">{commentCount}</span>}
        </button>
        <div className="flex-1" />
        {shop?.city && (
          <p className="text-xs text-coffee-400">{[shop.city, shop.state].filter(Boolean).join(', ')}</p>
        )}
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="border-t border-cream-100 px-4 pt-3 pb-3 space-y-3">
          {!commentsLoaded ? (
            <div className="flex justify-center py-2">
              <div className="w-4 h-4 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-coffee-400 text-center py-1">No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-2.5">
              {comments.map(c => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {c.profiles?.avatar_url
                      ? <img src={c.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs font-semibold text-amber-700">{c.profiles?.username?.[0]?.toUpperCase() ?? '?'}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0 bg-cream-50 rounded-xl px-3 py-2">
                    <span className="text-xs font-semibold text-coffee-700">{c.profiles?.username ?? 'User'} </span>
                    <span className="text-xs text-coffee-600">{c.content}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {profileId && (
            <div className="flex gap-2 items-center">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value.slice(0, 500))}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
                placeholder="Add a comment…"
                className="flex-1 text-sm bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-caramel/30"
              />
              <button
                onClick={submitComment}
                disabled={!commentText.trim() || submitting}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-caramel text-white disabled:opacity-40 flex-shrink-0"
              >
                <Send size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
