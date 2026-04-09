import { useState, useEffect, useCallback } from 'react'
import { Heart, MessageCircle, Gift, Bookmark, MoreHorizontal, X, Trash2, Flag, UserX, Plus, Edit2, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Rating } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { trackEvent } from '../../lib/analytics'
import ShopDetailModal from '../shared/ShopDetailModal'

function getMugColor(fill: number) {
  if (fill <= 20) return '#b0c4d4'
  if (fill <= 40) return '#c8924a'
  if (fill <= 60) return '#a06428'
  if (fill <= 80) return '#7a3e10'
  return '#4e2008'
}

function getFillLabel(fill: number) {
  if (fill <= 15) return 'Just a Sip'
  if (fill <= 30) return 'Getting There'
  if (fill <= 50) return 'Half Cup'
  if (fill <= 70) return 'Good Pour'
  if (fill <= 85) return 'Almost Perfect'
  return 'Perfect Brew ✨'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

type Comment = {
  id: string; user_id: string; content: string; created_at: string; edited: boolean
  profiles: { username: string; avatar_url: string | null }
}

function CommentsSection({ ratingId, onClose }: { ratingId: string; onClose: () => void }) {
  const { profile } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('comments')
        .select('*, profiles(username, avatar_url)')
        .eq('rating_id', ratingId).order('created_at', { ascending: true })
      if (data) setComments(data as any)
      setLoading(false)
    }
    load()
  }, [ratingId])

  async function postComment() {
    if (!newComment.trim() || !profile || posting) return
    setPosting(true)
    const { data } = await supabase.from('comments')
      .insert({ user_id: profile.id, rating_id: ratingId, content: newComment.trim() })
      .select('*, profiles(username, avatar_url)').single()
    if (data) {
      setComments(prev => [...prev, data as any])
      await supabase.from('ratings').update({ comments_count: comments.length + 1 }).eq('id', ratingId)
      trackEvent('comment_posted')
    }
    setNewComment('')
    setPosting(false)
  }

  async function editComment(id: string) {
    if (!editText.trim()) return
    await supabase.from('comments').update({ content: editText.trim(), edited: true }).eq('id', id)
    setComments(prev => prev.map(c => c.id === id ? { ...c, content: editText.trim(), edited: true } : c))
    setEditingId(null)
  }

  async function deleteComment(id: string) {
    await supabase.from('comments').delete().eq('id', id)
    setComments(prev => prev.filter(c => c.id !== id))
    await supabase.from('ratings').update({ comments_count: Math.max(0, comments.length - 1) }).eq('id', ratingId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up flex flex-col" style={{ maxHeight: '75vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <h3 className="font-display font-bold text-coffee-800 text-lg">Comments</h3>
          <button onClick={onClose} className="text-coffee-500 text-sm font-medium">Done</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {loading && <div className="flex justify-center py-6"><div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}
          {!loading && comments.length === 0 && <p className="text-center text-coffee-400 text-sm py-8">No comments yet. Be the first!</p>}
          {comments.map(comment => (
            <div key={comment.id} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-coffee-200 flex-shrink-0 overflow-hidden">
                {comment.profiles?.avatar_url
                  ? <img src={comment.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-caramel">
                      <span className="text-white text-xs font-bold">{comment.profiles?.username?.[0]?.toUpperCase()}</span>
                    </div>}
              </div>
              <div className="flex-1">
                {editingId === comment.id ? (
                  <div className="bg-cream-100 rounded-2xl px-3 py-2">
                    <input value={editText} onChange={e => setEditText(e.target.value)}
                      className="w-full bg-transparent text-coffee-800 text-sm focus:outline-none" />
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => editComment(comment.id)} className="text-caramel text-xs font-semibold">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-coffee-400 text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-cream-100 rounded-2xl px-3 py-2">
                    <p className="text-coffee-800 font-semibold text-xs">{comment.profiles?.username}
                      {comment.edited && <span className="text-coffee-400 font-normal"> · edited</span>}
                    </p>
                    <p className="text-coffee-700 text-sm mt-0.5">{comment.content}</p>
                  </div>
                )}
                {comment.user_id === profile?.id && editingId !== comment.id && (
                  <div className="flex gap-3 mt-1 px-1">
                    <button onClick={() => { setEditingId(comment.id); setEditText(comment.content) }}
                      className="text-coffee-400 text-xs flex items-center gap-1"><Edit2 size={10} /> Edit</button>
                    <button onClick={() => deleteComment(comment.id)}
                      className="text-red-400 text-xs flex items-center gap-1"><Trash2 size={10} /> Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-cream-200 flex gap-2">
          <input value={newComment} onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && postComment()}
            placeholder="Add a comment..."
            className="flex-1 bg-cream-100 rounded-full px-4 py-2 text-sm text-coffee-800 placeholder-coffee-300 focus:outline-none border border-cream-200" />
          <button onClick={postComment} disabled={!newComment.trim() || posting}
            className="bg-caramel text-white rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40">
            {posting ? '...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddToWishlistModal({ rating, onClose }: { rating: any; onClose: () => void }) {
  const { profile } = useAuth()
  const shop = rating.coffee_shops as any
  const [drinkName, setDrinkName] = useState(rating.drink_name || '')
  const [shopName, setShopName] = useState(shop?.name || '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function save() {
    if (!profile || !drinkName.trim()) return
    setSaving(true)
    await supabase.from('wishlist').insert({ user_id: profile.id, drink_name: drinkName.trim(), shop_name: shopName.trim() || null })
    setDone(true)
    setTimeout(onClose, 1500)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-coffee-800 text-lg">Add to Wishlist</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500"><X size={14} /></button>
        </div>
        {done ? (
          <div className="text-center py-8"><p className="text-3xl mb-2">☕</p><p className="text-coffee-700 font-display text-lg">Added to wishlist!</p></div>
        ) : (
          <>
            <div className="space-y-3 mb-5">
              <input value={drinkName} onChange={e => setDrinkName(e.target.value)} placeholder="Drink name"
                className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300" />
              <input value={shopName} onChange={e => setShopName(e.target.value)} placeholder="From which shop?"
                className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300" />
            </div>
            <button onClick={save} disabled={!drinkName.trim() || saving}
              className="w-full py-3 rounded-xl bg-caramel text-white font-semibold text-sm disabled:opacity-40">
              {saving ? 'Saving...' : 'Add to Wishlist ☕'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function PostMenu({ isOwn, onDelete, onEdit, onReport, onBlock, onClose }: {
  isOwn: boolean; rating: any
  onDelete: () => any; onEdit: () => void; onReport: () => any; onBlock: () => any; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-t-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-cream-200 text-center">
          <p className="text-coffee-400 text-xs">Post options</p>
        </div>
        {isOwn ? (
          <>
            <button onClick={onEdit}
              className="w-full flex items-center gap-3 px-5 py-4 text-coffee-700 hover:bg-cream-50 transition-colors border-b border-cream-100">
              <Edit2 size={18} className="text-caramel" /><span className="font-medium">Edit post</span>
            </button>
            <button onClick={onDelete}
              className="w-full flex items-center gap-3 px-5 py-4 text-red-500 hover:bg-red-50 transition-colors border-b border-cream-100">
              <Trash2 size={18} /><span className="font-medium">Delete post</span>
            </button>
          </>
        ) : (
          <>
            <button onClick={onReport}
              className="w-full flex items-center gap-3 px-5 py-4 text-coffee-700 hover:bg-cream-50 transition-colors border-b border-cream-100">
              <Flag size={18} className="text-orange-500" /><span className="font-medium">Report post</span>
            </button>
            <button onClick={onBlock}
              className="w-full flex items-center gap-3 px-5 py-4 text-red-500 hover:bg-red-50 transition-colors border-b border-cream-100">
              <UserX size={18} /><span className="font-medium">Block user</span>
            </button>
          </>
        )}
        <button onClick={onClose} className="w-full py-4 text-coffee-500 font-medium hover:bg-cream-50 transition-colors">Cancel</button>
      </div>
    </div>
  )
}

export default function HomeTab({ refresh }: { refresh: number }) {
  const { profile } = useAuth()
  const [ratings, setRatings] = useState<Rating[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [activeComments, setActiveComments] = useState<string | null>(null)
  const [selectedShop, setSelectedShop] = useState<any>(null)
  const [activeMenu, setActiveMenu] = useState<any>(null)
  const [wishlistRating, setWishlistRating] = useState<any>(null)
  const [editingPost, setEditingPost] = useState<any>(null)
  const [editCaption, setEditCaption] = useState('')

  const loadFeed = useCallback(async () => {
    const { data } = await supabase
      .from('ratings').select('*, profiles(*), coffee_shops(*)')
      .order('created_at', { ascending: false }).limit(30)
    if (data) setRatings(data)
    setLoading(false)
  }, [])

  const loadLikes = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('likes').select('rating_id').eq('user_id', profile.id)
    if (data) setLikedIds(new Set(data.map((l: any) => l.rating_id)))
  }, [profile])

  const loadSaved = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('saved_posts').select('rating_id').eq('user_id', profile.id)
    if (data) setSavedIds(new Set(data.map((s: any) => s.rating_id)))
  }, [profile])

  const loadBlocks = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', profile.id)
    if (data) setBlockedUsers(new Set(data.map((b: any) => b.blocked_id)))
  }, [profile])

  useEffect(() => { loadFeed(); loadLikes(); loadSaved(); loadBlocks() }, [refresh, loadFeed, loadLikes, loadSaved, loadBlocks])

  async function toggleLike(ratingId: string) {
    if (!profile) return
    const isLiked = likedIds.has(ratingId)
    if (isLiked) {
      await supabase.from('likes').delete().eq('user_id', profile.id).eq('rating_id', ratingId)
      setLikedIds(prev => { const n = new Set(prev); n.delete(ratingId); return n })
      setRatings(prev => prev.map(r => r.id === ratingId ? { ...r, likes_count: Math.max(0, r.likes_count - 1) } : r))
    } else {
      await supabase.from('likes').insert({ user_id: profile.id, rating_id: ratingId })
      setLikedIds(prev => new Set([...prev, ratingId]))
      setRatings(prev => prev.map(r => r.id === ratingId ? { ...r, likes_count: r.likes_count + 1 } : r))
      trackEvent('post_liked')
    }
  }

  async function toggleSave(ratingId: string) {
    if (!profile) return
    const isSaved = savedIds.has(ratingId)
    if (isSaved) {
      await supabase.from('saved_posts').delete().eq('user_id', profile.id).eq('rating_id', ratingId)
      setSavedIds(prev => { const n = new Set(prev); n.delete(ratingId); return n })
    } else {
      await supabase.from('saved_posts').insert({ user_id: profile.id, rating_id: ratingId })
      setSavedIds(prev => new Set([...prev, ratingId]))
    }
  }

  async function deletePost(ratingId: string) {
    await supabase.from('ratings').delete().eq('id', ratingId)
    setRatings(prev => prev.filter(r => r.id !== ratingId))
    setActiveMenu(null)
  }

  async function saveEditPost() {
    if (!editingPost) return
    await supabase.from('ratings').update({ caption: editCaption }).eq('id', editingPost.id)
    setRatings(prev => prev.map(r => r.id === editingPost.id ? { ...r, caption: editCaption } : r))
    setEditingPost(null)
  }

  async function reportPost(rating: any) {
    if (!profile) return
    await supabase.from('reports').insert({ reporter_id: profile.id, rating_id: rating.id, reason: 'user_reported' })
    setActiveMenu(null)
    alert('Post reported. Our team will review it.')
  }

  async function blockUser(userId: string) {
    if (!profile) return
    await supabase.from('blocks').insert({ blocker_id: profile.id, blocked_id: userId })
    setBlockedUsers(prev => new Set([...prev, userId]))
    setRatings(prev => prev.filter(r => (r.profiles as any)?.id !== userId))
    setActiveMenu(null)
  }

  const visibleRatings = ratings.filter(r => !blockedUsers.has((r.profiles as any)?.id))

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="sticky top-0 z-10 bg-cream-100/95 backdrop-blur-sm border-b border-cream-200 px-5 py-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-coffee-800">Social Brew</h1>
        <div className="flex items-center gap-2">
          {/* Notifications wired in App.tsx */}
          <button onClick={() => {}} className="text-coffee-500 p-1"><MessageCircle size={22} /></button>
          <button onClick={() => {}} className="text-coffee-500 p-1"><Bookmark size={22} /></button>
        </div>
      </div>

      <div className="pb-24">
        {loading && <div className="flex justify-center py-16"><div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}

        {!loading && visibleRatings.length === 0 && (
          <div className="text-center py-20 px-8">
            <div className="text-6xl mb-4">☕</div>
            <p className="text-coffee-700 font-display text-xl">No brews yet</p>
            <p className="text-coffee-400 text-sm mt-2">Be the first to rate a visit!</p>
          </div>
        )}

        {visibleRatings.map(rating => {
          const shop = rating.coffee_shops as any
          const user = rating.profiles as any
          const isLiked = likedIds.has(rating.id)
          const isSaved = savedIds.has(rating.id)
          const isOwn = user?.id === profile?.id; void isOwn
          const mugColor = getMugColor(rating.fill_level)
          const isQuickSip = (rating as any).is_quick_sip
          const visitTime = (rating as any).visit_time

          // ── COMPACT QUICK SIP CARD ──
          if (isQuickSip) {
            return (
              <div key={rating.id} className="bg-white mx-4 mb-2 rounded-2xl shadow-sm border border-cream-200 overflow-hidden animate-fade-in">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                    {user?.avatar_url
                      ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500">
                          <span className="text-white font-bold text-xs">{user?.username?.[0]?.toUpperCase()}</span>
                        </div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-coffee-700 font-semibold text-sm">{user?.username}</span>
                      <span className="text-coffee-400 text-xs">had a quick sip</span>
                      {shop && (
                        <button onClick={() => setSelectedShop(shop)} className="text-caramel text-xs font-semibold hover:underline truncate max-w-28">
                          @ {shop.name}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-14 h-1.5 bg-cream-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${rating.fill_level}%`, background: mugColor }} />
                      </div>
                      <span className="text-coffee-400 text-xs">{rating.fill_level}%</span>
                      <span className="text-coffee-300 text-xs">·</span>
                      <span className="text-coffee-400 text-xs">{timeAgo(rating.created_at)}</span>
                      <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-400">⚡ Quick Sip</span>
                    </div>
                  </div>
                  <button onClick={() => setActiveMenu(rating)} className="text-coffee-300 p-1 flex-shrink-0"><MoreHorizontal size={15} /></button>
                </div>
                <div className="flex items-center px-4 pb-3 gap-3 border-t border-cream-50">
                  <button onClick={() => toggleLike(rating.id)} className="flex items-center gap-1 mt-2 transition-all active:scale-90" style={{ color: isLiked ? '#e05a5a' : '#9b7a45' }}>
                    <Heart size={16} fill={isLiked ? '#e05a5a' : 'none'} />
                    {rating.likes_count > 0 && <span className="text-xs">{rating.likes_count}</span>}
                  </button>
                  <button onClick={() => setActiveComments(rating.id)} className="flex items-center gap-1 text-coffee-400 mt-2">
                    <MessageCircle size={16} />
                    {rating.comments_count > 0 && <span className="text-xs">{rating.comments_count}</span>}
                  </button>
                  <p className="text-coffee-300 text-xs mt-2 ml-auto">{formatDate(rating.created_at)}</p>
                </div>
              </div>
            )
          }

          // ── FULL RATING CARD ──
          return (
            <div key={rating.id} className="bg-white mx-4 mb-3 rounded-2xl shadow-sm border border-cream-200 overflow-hidden animate-fade-in">
              {/* User row */}
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                    {user?.avatar_url
                      ? <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500">
                          <span className="text-white font-bold text-sm">{user?.username?.[0]?.toUpperCase()}</span>
                        </div>}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-coffee-800 font-semibold text-sm">{user?.username}</p>
                      {visitTime && (
                        <span className="text-coffee-400 text-xs bg-cream-100 px-1.5 py-0.5 rounded-full border border-cream-200">
                          🕐 {visitTime.replace(/\(.*?\)/, '').trim()}
                        </span>
                      )}
                    </div>
                    <p className="text-coffee-400 text-xs">{timeAgo(rating.created_at)}</p>
                  </div>
                </div>
                <button onClick={() => setActiveMenu(rating)} className="text-coffee-400 p-1"><MoreHorizontal size={18} /></button>
              </div>

              {/* Rating content */}
              <div className="px-4 py-2">
                {rating.drink_name && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-coffee-500 text-sm">ordered</span>
                    <span className="bg-cream-100 text-coffee-700 px-2.5 py-0.5 rounded-full text-sm font-medium border border-cream-200">{rating.drink_name}</span>
                  </div>
                )}

                {/* Mug visual */}
                <div className="flex items-center gap-3 my-3">
                  <div className="w-12 h-14 flex-shrink-0">
                    <svg viewBox="0 0 56 68" width="48" height="56">
                      <defs><clipPath id={`clip-${rating.id}`}><rect x="5" y="12" width="38" height="46" rx="5" /></clipPath></defs>
                      <rect x="5" y="12" width="38" height="46" rx="5" fill="#f7f0e4" stroke="#c8b090" strokeWidth="1.5" />
                      <g clipPath={`url(#clip-${rating.id})`}>
                        <rect x="5" y={58-(46*rating.fill_level/100)} width="38" height={46*rating.fill_level/100} fill={mugColor} />
                      </g>
                      <rect x="3" y="8" width="42" height="8" rx="4" fill="#d4b890" />
                      <path d="M43 22 Q56 22 56 33 Q56 44 43 44" stroke="#c8b090" strokeWidth="5" fill="none" strokeLinecap="round" />
                      <ellipse cx="24" cy="58" rx="19" ry="5" fill="#e8ddc8" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-coffee-700 font-bold text-base">{getFillLabel(rating.fill_level)}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="h-1.5 w-20 bg-cream-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${rating.fill_level}%`, background: mugColor }} />
                      </div>
                      <span className="text-coffee-400 text-xs">{rating.fill_level}%</span>
                    </div>
                  </div>
                </div>

                {/* Photo */}
                {rating.photo_url && (
                  <div className="rounded-xl overflow-hidden mb-2 h-52">
                    <img src={rating.photo_url} alt="moment" className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Vibe tags */}
                {(rating.vibe_tags as any)?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(rating.vibe_tags as any).map((tag: string) => (
                      <span key={tag} className="bg-cream-100 text-coffee-500 px-2 py-0.5 rounded-full text-xs border border-cream-200">{tag}</span>
                    ))}
                  </div>
                )}

                {/* Caption - editable */}
                {editingPost?.id === rating.id ? (
                  <div className="mb-2">
                    <textarea value={editCaption} onChange={e => setEditCaption(e.target.value)} rows={2}
                      className="w-full bg-cream-50 text-coffee-800 rounded-xl px-3 py-2 text-sm border border-cream-200 focus:border-caramel focus:outline-none resize-none" />
                    <div className="flex gap-2 mt-1">
                      <button onClick={saveEditPost} className="text-caramel text-xs font-semibold flex items-center gap-1"><Check size={12} /> Save</button>
                      <button onClick={() => setEditingPost(null)} className="text-coffee-400 text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  rating.caption && <p className="text-coffee-700 text-sm mb-2">{rating.caption}</p>
                )}
              </div>

              {/* Shop card */}
              {shop && (
                <button onClick={() => setSelectedShop(shop)}
                  className="mx-4 mb-3 flex items-center gap-3 bg-cream-50 rounded-xl p-2.5 border border-cream-200 w-full text-left hover:bg-cream-100 transition-colors">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-coffee-200 flex-shrink-0">
                    {shop.photo_url && <img src={shop.photo_url} alt={shop.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-coffee-700 font-semibold text-sm truncate">{shop.name}</p>
                    <p className="text-coffee-400 text-xs truncate">{shop.address}{shop.city ? `, ${shop.city}` : ''}</p>
                  </div>
                  <span className="text-caramel text-xs font-medium flex-shrink-0">View →</span>
                </button>
              )}

              {/* Actions */}
              <div className="flex items-center px-4 pb-2 gap-4">
                <button onClick={() => toggleLike(rating.id)} className="flex items-center gap-1.5 transition-all active:scale-90" style={{ color: isLiked ? '#e05a5a' : '#9b7a45' }}>
                  <Heart size={20} fill={isLiked ? '#e05a5a' : 'none'} />
                  {rating.likes_count > 0 && <span className="text-sm font-medium">{rating.likes_count}</span>}
                </button>
                <button onClick={() => setActiveComments(rating.id)} className="flex items-center gap-1.5 text-coffee-500 active:scale-90 transition-all">
                  <MessageCircle size={20} />
                  {rating.comments_count > 0 && <span className="text-sm">{rating.comments_count}</span>}
                </button>
                <button onClick={() => setWishlistRating(rating)} className="flex items-center gap-1.5 text-coffee-400 active:scale-90 transition-all">
                  <Plus size={18} /><span className="text-xs">Wishlist</span>
                </button>
                <button className="flex items-center gap-1.5 text-coffee-200 cursor-default ml-auto">
                  <Gift size={18} /><span className="text-xs">Gift</span>
                </button>
                <button onClick={() => toggleSave(rating.id)} className="transition-all active:scale-90" style={{ color: isSaved ? '#c8853a' : '#9b7a45' }}>
                  <Bookmark size={18} fill={isSaved ? '#c8853a' : 'none'} />
                </button>
              </div>

              {/* Date at bottom */}
              <div className="px-4 pb-3">
                <p className="text-coffee-300 text-xs">{formatDate(rating.created_at)}</p>
              </div>
            </div>
          )
        })}
      </div>

      {selectedShop && <ShopDetailModal shop={selectedShop} onClose={() => setSelectedShop(null)} />}
      {activeComments && <CommentsSection ratingId={activeComments} onClose={() => setActiveComments(null)} />}
      {activeMenu && (
        <PostMenu
          isOwn={(activeMenu.profiles as any)?.id === profile?.id}
          rating={activeMenu}
          onDelete={() => deletePost(activeMenu.id)}
          onEdit={() => { setEditCaption(activeMenu.caption || ''); setEditingPost(activeMenu); setActiveMenu(null) }}
          onReport={() => reportPost(activeMenu)}
          onBlock={() => blockUser((activeMenu.profiles as any)?.id)}
          onClose={() => setActiveMenu(null)}
        />
      )}
      {wishlistRating && <AddToWishlistModal rating={wishlistRating} onClose={() => setWishlistRating(null)} />}
    </div>
  )
}
