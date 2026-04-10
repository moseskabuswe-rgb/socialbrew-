import { useState, useEffect } from 'react'
import { X, Heart, MessageCircle, Bookmark, ArrowLeft, Send, Trash2, Edit2 } from 'lucide-react'
import { sendNotification, notifyMentions } from '../../lib/push'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

function getMugColor(fill: number) {
  if (fill <= 20) return '#b0c4d4'
  if (fill <= 40) return '#c8924a'
  if (fill <= 60) return '#a06428'
  if (fill <= 80) return '#7a3e10'
  return '#4e2008'
}
function getFillLabel(fill: number) {
  if (fill <= 20) return 'Just a Sip'
  if (fill <= 40) return 'Getting There'
  if (fill <= 60) return 'Half Cup'
  if (fill <= 80) return 'Good Pour'
  if (fill <= 95) return 'Almost Perfect'
  return 'Perfect Brew ✨'
}
function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m/60)}h ago`
  return `${Math.floor(m/1440)}d ago`
}

type Props = {
  rating: any
  onClose: () => void
  onUserClick?: (userId: string) => void
  onShopClick?: (shop: any) => void
}

export default function PostDetailModal({ rating, onClose, onUserClick, onShopClick }: Props) {
  const { profile } = useAuth()
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [likesCount, setLikesCount] = useState(rating.likes_count || 0)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const user = rating.profiles as any
  const shop = rating.coffee_shops as any
  const mugColor = getMugColor(rating.fill_level)

  useEffect(() => {
    async function load() {
      const [commentsRes, likeRes, saveRes] = await Promise.all([
        supabase.from('comments').select('*, profiles(username, avatar_url)').eq('rating_id', rating.id).order('created_at', { ascending: true }),
        profile ? supabase.from('likes').select('id').eq('user_id', profile.id).eq('rating_id', rating.id).single() : Promise.resolve({ data: null }),
        profile ? supabase.from('saved_posts').select('rating_id').eq('user_id', profile.id).eq('rating_id', rating.id).single() : Promise.resolve({ data: null }),
      ])
      if (commentsRes.data) setComments(commentsRes.data)
      setIsLiked(!!likeRes.data)
      setIsSaved(!!saveRes.data)
      setLoading(false)
    }
    load()
  }, [rating.id, profile])

  async function toggleLike() {
    if (!profile) return
    if (isLiked) {
      await supabase.from('likes').delete().eq('user_id', profile.id).eq('rating_id', rating.id)
      setIsLiked(false); setLikesCount((n: number) => Math.max(0, n - 1))
    } else {
      await supabase.from('likes').insert({ user_id: profile.id, rating_id: rating.id })
      setIsLiked(true); setLikesCount((n: number) => n + 1)
    }
  }

  async function toggleSave() {
    if (!profile) return
    if (isSaved) {
      await supabase.from('saved_posts').delete().eq('user_id', profile.id).eq('rating_id', rating.id)
      setIsSaved(false)
    } else {
      await supabase.from('saved_posts').insert({ user_id: profile.id, rating_id: rating.id })
      setIsSaved(true)
    }
  }

  async function postComment() {
    if (!newComment.trim() || !profile || posting) return
    setPosting(true)
    const content = newComment.trim()
    const { data } = await supabase.from('comments')
      .insert({ user_id: profile.id, rating_id: rating.id, content })
      .select('*, profiles(username, avatar_url)').single()
    if (data) {
      setComments(prev => [...prev, data])
      // Notify post owner
      const ownerId = rating.profiles?.id || rating.user_id
      if (ownerId) sendNotification({ userId: ownerId, actorId: profile.id, type: 'comment', ratingId: rating.id })
      // Notify @mentions
      notifyMentions(content, profile.id, rating.id)
    }
    setNewComment(''); setPosting(false)
  }

  async function deleteComment(id: string) {
    await supabase.from('comments').delete().eq('id', id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return
    await supabase.from('comments').update({ content: editText.trim(), edited: true }).eq('id', id)
    setComments(prev => prev.map(c => c.id === id ? { ...c, content: editText.trim(), edited: true } : c))
    setEditingId(null)
  }

  const cleanCaption = rating.caption?.split('🕐')[0]?.replace(/\s*·\s*$/, '').trim()

  return (
    <div className="fixed inset-0 z-50 bg-cream-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-cream-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={onClose} className="text-coffee-500"><ArrowLeft size={22} /></button>
        <div className="flex items-center gap-2 flex-1">
          <button onClick={() => onUserClick?.(user?.id)} className="w-8 h-8 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white text-xs font-bold">{user?.username?.[0]?.toUpperCase()}</span></div>}
          </button>
          <div>
            <button onClick={() => onUserClick?.(user?.id)} className="text-coffee-800 font-semibold text-sm hover:text-caramel">{user?.username}</button>
            <p className="text-coffee-400 text-xs">{timeAgo(rating.created_at)}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-coffee-400"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {/* Post content */}
        <div className="bg-white mx-4 mt-4 rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
          {/* Photo */}
          {rating.photo_url && (
            <div className="h-64">
              <img src={rating.photo_url} alt="moment" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="p-4">
            {/* Drink name */}
            {rating.drink_name && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-coffee-400 text-sm">ordered</span>
                <span className="bg-cream-100 text-coffee-700 px-3 py-1 rounded-full text-sm font-medium border border-cream-200">{rating.drink_name}</span>
              </div>
            )}

            {/* Mug fill */}
            <div className="flex items-center gap-4 mb-3">
              <svg viewBox="0 0 56 68" width="56" height="68">
                <defs><clipPath id="pd-mug"><rect x="5" y="12" width="38" height="46" rx="5" /></clipPath></defs>
                <rect x="5" y="12" width="38" height="46" rx="5" fill="#f7f0e4" stroke="#c8b090" strokeWidth="1.5" />
                <g clipPath="url(#pd-mug)">
                  <rect x="5" y={58-(46*rating.fill_level/100)} width="38" height={46*rating.fill_level/100} fill={mugColor} />
                </g>
                <rect x="3" y="8" width="42" height="8" rx="4" fill="#d4b890" />
                <path d="M43 22 Q56 22 56 33 Q56 44 43 44" stroke="#c8b090" strokeWidth="5" fill="none" strokeLinecap="round" />
                <ellipse cx="24" cy="58" rx="19" ry="5" fill="#e8ddc8" />
              </svg>
              <div>
                <p className="text-coffee-700 font-bold text-xl">{getFillLabel(rating.fill_level)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-2 w-24 bg-cream-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${rating.fill_level}%`, background: mugColor }} />
                  </div>
                  <span className="text-coffee-500 font-semibold">{rating.fill_level}%</span>
                </div>
                {rating.visit_time && <p className="text-coffee-400 text-xs mt-1">🕐 {rating.visit_time}</p>}
              </div>
            </div>

            {/* Vibes */}
            {rating.vibe_tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {rating.vibe_tags.map((tag: string) => (
                  <span key={tag} className="bg-cream-100 text-coffee-500 px-2.5 py-1 rounded-full text-xs border border-cream-200">{tag}</span>
                ))}
              </div>
            )}

            {/* Caption */}
            {cleanCaption && <p className="text-coffee-700 text-sm mb-3">{cleanCaption}</p>}

            {/* Shop */}
            {shop && (
              <button onClick={() => onShopClick?.(shop)} className="w-full flex items-center gap-3 bg-cream-50 rounded-xl p-3 border border-cream-200 text-left hover:bg-cream-100 transition-colors mb-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-coffee-200 flex-shrink-0">
                  {shop.photo_url && <img src={shop.photo_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-coffee-700 font-semibold text-sm truncate">{shop.name}</p>
                  <p className="text-coffee-400 text-xs">{shop.address}{shop.city ? `, ${shop.city}` : ''}</p>
                </div>
                <span className="text-caramel text-xs font-medium">View →</span>
              </button>
            )}

            {/* Actions */}
            <div className="flex items-center gap-4 pt-2 border-t border-cream-100">
              <button onClick={toggleLike} className="flex items-center gap-1.5 active:scale-90 transition-transform" style={{ color: isLiked ? '#e05a5a' : '#9b7a45' }}>
                <Heart size={22} fill={isLiked ? '#e05a5a' : 'none'} />
                {likesCount > 0 && <span className="text-sm font-medium">{likesCount}</span>}
              </button>
              <div className="flex items-center gap-1.5 text-coffee-500">
                <MessageCircle size={22} />
                {comments.length > 0 && <span className="text-sm">{comments.length}</span>}
              </div>
              <button onClick={toggleSave} className="ml-auto active:scale-90 transition-transform" style={{ color: isSaved ? '#c8853a' : '#9b7a45' }}>
                <Bookmark size={20} fill={isSaved ? '#c8853a' : 'none'} />
              </button>
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="px-4 mt-4">
          <p className="text-coffee-500 text-xs font-semibold uppercase tracking-wider mb-3">
            {comments.length === 0 ? 'No comments yet' : `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`}
          </p>
          {loading && <div className="flex justify-center py-4"><div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}
          <div className="space-y-3">
            {comments.map(comment => (
              <div key={comment.id} className="flex gap-2.5">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                  {comment.profiles?.avatar_url
                    ? <img src={comment.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white text-xs font-bold">{comment.profiles?.username?.[0]?.toUpperCase()}</span></div>}
                </div>
                <div className="flex-1">
                  {editingId === comment.id ? (
                    <div className="bg-cream-100 rounded-2xl px-3 py-2">
                      <input value={editText} onChange={e => setEditText(e.target.value)}
                        className="w-full bg-transparent text-coffee-800 text-sm focus:outline-none" />
                      <div className="flex gap-2 mt-1">
                        <button onClick={() => saveEdit(comment.id)} className="text-caramel text-xs font-semibold">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-coffee-400 text-xs">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-cream-100 rounded-2xl px-3 py-2">
                      <p className="text-coffee-800 font-semibold text-xs">{comment.profiles?.username}{comment.edited && <span className="text-coffee-400 font-normal"> · edited</span>}</p>
                      <p className="text-coffee-700 text-sm mt-0.5">{comment.content}</p>
                    </div>
                  )}
                  {comment.user_id === profile?.id && editingId !== comment.id && (
                    <div className="flex gap-3 mt-1 px-1">
                      <button onClick={() => { setEditingId(comment.id); setEditText(comment.content) }} className="text-coffee-400 text-xs flex items-center gap-1"><Edit2 size={10} /> Edit</button>
                      <button onClick={() => deleteComment(comment.id)} className="text-red-400 text-xs flex items-center gap-1"><Trash2 size={10} /> Delete</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comment input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-cream-200 px-4 py-3 flex gap-2 max-w-lg mx-auto">
        <input value={newComment} onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && postComment()}
          placeholder="Add a comment... use @username to mention"
          className="flex-1 bg-cream-100 rounded-full px-4 py-2 text-sm text-coffee-800 placeholder-coffee-300 focus:outline-none border border-cream-200" />
        <button onClick={postComment} disabled={!newComment.trim() || posting}
          className="w-9 h-9 rounded-full bg-caramel flex items-center justify-center disabled:opacity-40">
          <Send size={15} className="text-white" />
        </button>
      </div>
    </div>
  )
}
