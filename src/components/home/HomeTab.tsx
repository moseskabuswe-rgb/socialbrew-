import { useState, useEffect, useCallback } from 'react'
import { Heart, MessageCircle, Gift, Bookmark, X, Send, MoreHorizontal, Trash2, Flag, UserX, Star } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Rating } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

function getMugColor(fill: number) {
  if (fill <= 25) return '#8ca8c5'
  if (fill <= 50) return '#c4956a'
  if (fill <= 75) return '#9b5e25'
  return '#5c2a0a'
}

function getFillLabel(fill: number) {
  if (fill <= 15) return 'Just a Sip'
  if (fill <= 30) return 'Getting There'
  if (fill <= 50) return 'Half Cup'
  if (fill <= 70) return 'Good Pour'
  if (fill <= 85) return 'Almost Perfect'
  return 'Perfect Brew ✨'
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

type Comment = { id: string; content: string; created_at: string; profiles: { username: string; avatar_url: string | null } }

function CommentSheet({ ratingId, onClose }: { ratingId: string; onClose: () => void }) {
  const { profile } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)

  useEffect(() => { loadComments() }, [ratingId])

  async function loadComments() {
    const { data } = await supabase
      .from('comments').select('*, profiles(username, avatar_url)')
      .eq('rating_id', ratingId).order('created_at', { ascending: true })
    if (data) setComments(data as Comment[])
    setLoading(false)
  }

  async function postComment() {
    if (!text.trim() || !profile || posting) return
    setPosting(true)
    const { data } = await supabase
      .from('comments')
      .insert({ rating_id: ratingId, user_id: profile.id, content: text.trim() })
      .select('*, profiles(username, avatar_url)').single()
    if (data) {
      setComments(prev => [...prev, data as Comment])
      supabase.from('ratings').update({ comments_count: comments.length + 1 }).eq('id', ratingId)
    }
    setText('')
    setPosting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="flex-1" onClick={onClose} />
      <div className="bg-white rounded-t-3xl flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <h3 className="font-display font-bold text-coffee-800 text-lg">Comments</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-cream-100 flex items-center justify-center">
            <X size={14} className="text-coffee-600" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {loading && <div className="flex justify-center py-6"><div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}
          {!loading && comments.length === 0 && <div className="text-center py-8 text-coffee-400 text-sm">No comments yet. Be the first!</div>}
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-coffee-200 flex items-center justify-center text-coffee-600 font-bold text-xs flex-shrink-0 overflow-hidden">
                {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} alt="" className="w-full h-full object-cover" /> : c.profiles?.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 bg-cream-50 rounded-2xl px-3 py-2">
                <p className="text-coffee-800 font-semibold text-xs mb-0.5">{c.profiles?.username}</p>
                <p className="text-coffee-700 text-sm">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-cream-200 flex gap-3 items-center">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && postComment()}
            placeholder="Add a comment..." className="flex-1 bg-cream-50 rounded-full px-4 py-2.5 text-sm text-coffee-800 border border-cream-200 focus:outline-none focus:border-caramel" />
          <button onClick={postComment} disabled={!text.trim() || posting} className="w-9 h-9 rounded-full bg-caramel flex items-center justify-center disabled:opacity-40 flex-shrink-0">
            <Send size={15} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}

function WishlistSheet({ rating, shop, onClose }: { rating: Rating; shop: any; onClose: () => void }) {
  const { profile } = useAuth()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const drinkName = rating.drink_name || 'This drink'

  async function saveToWishlist() {
    if (!profile || saving) return
    setSaving(true)
    await supabase.from('wishlist').insert({
      user_id: profile.id,
      drink_name: drinkName,
      shop_id: rating.shop_id,
      shop_name: shop?.name || null,
      notes: `From ${(rating.profiles as any)?.username || 'someone'}'s post`,
    })
    setSaved(true)
    setSaving(false)
    setTimeout(onClose, 1000)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="flex-1" onClick={onClose} />
      <div className="bg-white rounded-t-3xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-coffee-800 text-lg">Add to Wishlist</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-cream-100 flex items-center justify-center"><X size={14} className="text-coffee-600" /></button>
        </div>
        <div className="bg-cream-50 rounded-2xl p-4 mb-5 border border-cream-200">
          <p className="text-coffee-800 font-semibold text-base">{drinkName}</p>
          {shop?.name && <p className="text-coffee-400 text-sm mt-1">at {shop.name}</p>}
        </div>
        {saved ? (
          <div className="flex items-center justify-center gap-2 py-3">
            <span className="text-2xl">☕</span>
            <p className="text-coffee-700 font-semibold">Added to your wishlist!</p>
          </div>
        ) : (
          <button onClick={saveToWishlist} disabled={saving} className="w-full py-3.5 rounded-2xl bg-caramel text-white font-bold text-base disabled:opacity-60">
            {saving ? 'Saving...' : '+ Add to My Wishlist'}
          </button>
        )}
        <button onClick={onClose} className="w-full mt-3 py-2.5 text-coffee-400 text-sm">Cancel</button>
      </div>
    </div>
  )
}

function PostMenu({ rating, onDelete, onReport, onBlock, onClose }: {
  rating: Rating; onDelete: () => void; onReport: () => void; onBlock: () => void; onClose: () => void
}) {
  const { profile } = useAuth()
  const isOwn = profile?.id === rating.user_id

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="flex-1" onClick={onClose} />
      <div className="bg-white rounded-t-3xl pb-8">
        <div className="w-10 h-1 bg-cream-200 rounded-full mx-auto mt-3 mb-4" />
        {isOwn ? (
          <button onClick={onDelete} className="w-full flex items-center gap-4 px-6 py-4 text-left active:bg-cream-50">
            <Trash2 size={20} className="text-red-500" />
            <span className="text-red-500 font-semibold text-base">Delete post</span>
          </button>
        ) : (
          <>
            <button onClick={onReport} className="w-full flex items-center gap-4 px-6 py-4 text-left active:bg-cream-50 border-b border-cream-100">
              <Flag size={20} className="text-coffee-500" />
              <span className="text-coffee-700 font-semibold text-base">Report post</span>
            </button>
            <button onClick={onBlock} className="w-full flex items-center gap-4 px-6 py-4 text-left active:bg-cream-50">
              <UserX size={20} className="text-coffee-500" />
              <span className="text-coffee-700 font-semibold text-base">Block user</span>
            </button>
          </>
        )}
        <button onClick={onClose} className="w-full flex items-center justify-center py-4 mt-2">
          <span className="text-coffee-400 text-sm">Cancel</span>
        </button>
      </div>
    </div>
  )
}

export default function HomeTab({ refresh }: { refresh: number }) {
  const { profile } = useAuth()
  const [ratings, setRatings] = useState<Rating[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [commentRatingId, setCommentRatingId] = useState<string | null>(null)
  const [menuRating, setMenuRating] = useState<Rating | null>(null)
  const [wishlistRating, setWishlistRating] = useState<Rating | null>(null)

  const loadFeed = useCallback(async () => {
    const { data } = await supabase
      .from('ratings').select('*, profiles(*), coffee_shops(*)')
      .not('shop_id', 'is', null)
      .order('created_at', { ascending: false }).limit(30)
    if (data) setRatings(data)
    setLoading(false)
  }, [])

  const loadLikes = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('likes').select('rating_id').eq('user_id', profile.id)
    if (data) setLikedIds(new Set(data.map((l: any) => l.rating_id)))
  }, [profile])

  const loadBlocked = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', profile.id)
    if (data) setBlockedIds(new Set(data.map((b: any) => b.blocked_id)))
  }, [profile])

  useEffect(() => {
    loadFeed(); loadLikes(); loadBlocked()
  }, [refresh, loadFeed, loadLikes, loadBlocked])

  async function toggleLike(ratingId: string) {
    if (!profile) return
    const isLiked = likedIds.has(ratingId)
    if (isLiked) {
      await supabase.from('likes').delete().eq('user_id', profile.id).eq('rating_id', ratingId)
      setLikedIds(prev => { const n = new Set(prev); n.delete(ratingId); return n })
      setRatings(prev => prev.map(r => r.id === ratingId ? { ...r, likes_count: r.likes_count - 1 } : r))
    } else {
      await supabase.from('likes').insert({ user_id: profile.id, rating_id: ratingId })
      setLikedIds(prev => new Set([...prev, ratingId]))
      setRatings(prev => prev.map(r => r.id === ratingId ? { ...r, likes_count: r.likes_count + 1 } : r))
    }
  }

  async function deletePost(ratingId: string) {
    setMenuRating(null)
    await supabase.from('ratings').delete().eq('id', ratingId)
    setRatings(prev => prev.filter(r => r.id !== ratingId))
  }

  async function reportPost(rating: Rating) {
    setMenuRating(null)
    if (!profile) return
    await supabase.from('reports').insert({ reporter_id: profile.id, rating_id: rating.id, reported_user_id: rating.user_id })
    alert('Post reported. Thank you.')
  }

  async function blockUser(rating: Rating) {
    setMenuRating(null)
    if (!profile) return
    await supabase.from('blocks').insert({ blocker_id: profile.id, blocked_id: rating.user_id })
    setBlockedIds(prev => new Set([...prev, rating.user_id]))
  }

  function openShopInMaps(shop: any) {
    if (!shop) return
    const query = shop.lat && shop.lng ? `${shop.lat},${shop.lng}` : encodeURIComponent(`${shop.name} ${shop.address || ''} ${shop.city || ''}`)
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank')
  }

  const visibleRatings = ratings.filter(r => !blockedIds.has(r.user_id))

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="sticky top-0 z-10 bg-cream-100/95 backdrop-blur-sm border-b border-cream-200 px-5 py-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-coffee-800">Social Brew</h1>
        <div className="flex items-center gap-3">
          <button className="text-coffee-600"><MessageCircle size={22} /></button>
          <button className="text-coffee-600"><Bookmark size={22} /></button>
        </div>
      </div>

      <div className="pb-24">
        {loading && <div className="flex justify-center py-12"><div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}

        {!loading && visibleRatings.length === 0 && (
          <div className="text-center py-16 px-8">
            <div className="text-5xl mb-4">☕</div>
            <p className="text-coffee-700 font-display text-xl">No brews yet</p>
            <p className="text-coffee-400 text-sm mt-2">Be the first to rate a visit!</p>
          </div>
        )}

        {visibleRatings.map(rating => {
          const shop = rating.coffee_shops as any
          const user = rating.profiles as any
          const isLiked = likedIds.has(rating.id)
          const isOwn = profile?.id === rating.user_id
          const mugColor = getMugColor(rating.fill_level)

          return (
            <div key={rating.id} className="bg-white mx-4 mb-3 rounded-2xl shadow-sm border border-cream-200 overflow-hidden animate-fade-in">
              {/* User row */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-coffee-200">
                    {user?.avatar_url
                      ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-coffee-600 font-bold text-sm">{user?.username?.[0]?.toUpperCase()}</div>}
                  </div>
                  <div>
                    <p className="text-coffee-800 font-semibold text-sm">{user?.username}</p>
                    <p className="text-coffee-400 text-xs">{timeAgo(rating.created_at)}</p>
                  </div>
                </div>
                <button onClick={() => setMenuRating(rating)} className="w-8 h-8 flex items-center justify-center text-coffee-400 rounded-full active:bg-cream-100">
                  <MoreHorizontal size={18} />
                </button>
              </div>

              {/* Rating content */}
              <div className="px-4 py-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-coffee-600 text-sm">rated</span>
                  {rating.drink_name && <span className="bg-cream-100 text-coffee-700 px-2 py-0.5 rounded-full text-sm font-medium">{rating.drink_name}</span>}
                </div>

                <div className="flex items-center gap-3 my-3">
                  <div className="relative w-12 h-14 flex-shrink-0">
                    <svg viewBox="0 0 60 72" width="48" height="56">
                      <defs><clipPath id={`clip-${rating.id}`}><path d="M8 15 Q8 11 12 11 L48 11 Q52 11 52 15 L52 63 Q52 68 47 68 L13 68 Q8 68 8 63 Z" /></clipPath></defs>
                      <path d="M8 15 Q8 11 12 11 L48 11 Q52 11 52 15 L52 63 Q52 68 47 68 L13 68 Q8 68 8 63 Z" fill="#f7f0e4" stroke="#b8935a" strokeWidth="1.5" />
                      <g clipPath={`url(#clip-${rating.id})`}>
                        <rect x="8" y={68 - (57 * rating.fill_level / 100)} width="44" height={57 * rating.fill_level / 100} fill={mugColor} />
                      </g>
                      <path d="M52 25 Q64 25 64 40 Q64 55 52 55" stroke="#b8935a" strokeWidth="5" fill="none" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-coffee-800 font-bold text-base">{getFillLabel(rating.fill_level)}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="h-1.5 w-20 bg-cream-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${rating.fill_level}%`, background: mugColor }} />
                      </div>
                      <span className="text-coffee-400 text-xs">{rating.fill_level}%</span>
                    </div>
                  </div>
                </div>

                {rating.vibe_tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {rating.vibe_tags.map(tag => <span key={tag} className="bg-cream-100 text-coffee-600 px-2 py-0.5 rounded-full text-xs border border-cream-200">{tag}</span>)}
                  </div>
                )}
                {rating.caption && <p className="text-coffee-700 text-sm mb-2">{rating.caption}</p>}
                {rating.photo_url && <div className="rounded-xl overflow-hidden mb-3 h-48"><img src={rating.photo_url} alt="moment" className="w-full h-full object-cover" /></div>}
              </div>

              {/* Shop */}
              {shop && (
                <button onClick={() => openShopInMaps(shop)} className="mx-4 mb-3 flex items-center gap-3 bg-cream-50 rounded-xl p-2.5 border border-cream-200 w-[calc(100%-2rem)] text-left active:bg-cream-100 transition-colors">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-coffee-200 flex-shrink-0">
                    {shop.photo_url && <img src={shop.photo_url} alt={shop.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-coffee-800 font-semibold text-sm truncate">{shop.name}</p>
                    <p className="text-coffee-400 text-xs truncate">{shop.address}{shop.city ? `, ${shop.city}` : ''}</p>
                  </div>
                  <span className="text-caramel text-xs font-medium flex-shrink-0">View →</span>
                </button>
              )}

              {/* Actions */}
              <div className="flex items-center px-4 pb-4 gap-1">
                <button onClick={() => toggleLike(rating.id)} className="flex items-center gap-1.5 transition-all active:scale-90 px-2 py-1.5" style={{ color: isLiked ? '#e05a5a' : '#9b7a45' }}>
                  <Heart size={20} fill={isLiked ? '#e05a5a' : 'none'} />
                  {rating.likes_count > 0 && <span className="text-sm">{rating.likes_count}</span>}
                </button>
                <button onClick={() => setCommentRatingId(rating.id)} className="flex items-center gap-1.5 text-coffee-400 active:scale-90 transition-transform px-2 py-1.5">
                  <MessageCircle size={20} />
                  {rating.comments_count > 0 && <span className="text-sm">{rating.comments_count}</span>}
                </button>
                {!isOwn && rating.drink_name && (
                  <button onClick={() => setWishlistRating(rating)} className="flex items-center gap-1 text-coffee-400 active:scale-90 transition-transform px-2 py-1.5">
                    <Star size={17} />
                    <span className="text-xs">Wishlist</span>
                  </button>
                )}
                <button className="flex items-center gap-1.5 px-2 py-1.5 ml-auto text-coffee-400">
                  <Gift size={18} />
                  <span className="text-xs">Gift</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {commentRatingId && <CommentSheet ratingId={commentRatingId} onClose={() => { setCommentRatingId(null); loadFeed() }} />}

      {menuRating && (
        <PostMenu
          rating={menuRating}
          onDelete={() => deletePost(menuRating.id)}
          onReport={() => reportPost(menuRating)}
          onBlock={() => blockUser(menuRating)}
          onClose={() => setMenuRating(null)}
        />
      )}

      {wishlistRating && (
        <WishlistSheet
          rating={wishlistRating}
          shop={wishlistRating.coffee_shops}
          onClose={() => setWishlistRating(null)}
        />
      )}
    </div>
  )
}
