import { useState, useEffect, useRef } from 'react'
import { useSwipeBack } from '../../lib/useSwipeBack'
import { X, Heart, MessageCircle, Bookmark, ArrowLeft, Send, Trash2, Edit2, Share2 } from 'lucide-react'
import EditPostModal from './EditPostModal'
import { notifyLike, notifyComment, notifyMention } from '../../lib/push'
import { supabase } from '../../lib/supabase'
import LikedByModal from './LikedByModal'
import { useAuth } from '../../contexts/AuthContext'

function getMugColor(fill: number) {
  if (fill <= 20) return '#d4b896'
  if (fill <= 40) return '#c49a6c'
  if (fill <= 60) return '#b87333'
  if (fill <= 75) return '#9b5e1a'
  if (fill <= 90) return '#6b3410'
  return '#3d1a06'
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
  onClose: (finalCommentCount?: number, finalLikeCount?: number) => void
  onUserClick?: (userId: string) => void
  onShopClick?: (shop: any) => void
}


// ── PINCH-TO-ZOOM PHOTO VIEWER ────────────────────────────
function PinchZoomPhoto({ src, onClose }: { src: string; onClose: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null)
  // All transform state lives in refs — applied directly to DOM via style
  // This avoids React re-renders on every touch frame (which caused shaking)
  const scaleRef = useRef(1)
  const offsetRef = useRef({ x: 0, y: 0 })
  const startTouchesRef = useRef<{ x: number; y: number }[]>([])
  const startScaleRef = useRef(1)
  const startOffsetRef = useRef({ x: 0, y: 0 })
  const lastTapRef = useRef(0)

  function applyTransform(scale: number, x: number, y: number) {
    if (!imgRef.current) return
    imgRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
  }

  function getTouches(e: React.TouchEvent) {
    return Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }))
  }

  function dist(a: {x:number,y:number}, b: {x:number,y:number}) {
    return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2)
  }

  function mid(a: {x:number,y:number}, b: {x:number,y:number}) {
    return { x: (a.x+b.x)/2, y: (a.y+b.y)/2 }
  }

  function onTouchStart(e: React.TouchEvent) {
    e.preventDefault()
    const touches = getTouches(e)
    startTouchesRef.current = touches
    startScaleRef.current = scaleRef.current
    startOffsetRef.current = { ...offsetRef.current }

    // Double tap to reset
    if (touches.length === 1) {
      const now = Date.now()
      if (now - lastTapRef.current < 300) {
        scaleRef.current = 1
        offsetRef.current = { x: 0, y: 0 }
        applyTransform(1, 0, 0)
      }
      lastTapRef.current = now
    }
  }

  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    const touches = getTouches(e)
    const start = startTouchesRef.current

    if (touches.length === 2 && start.length === 2) {
      // Pinch: compare current finger distance to start distance
      const startDist = dist(start[0], start[1])
      const curDist = dist(touches[0], touches[1])
      if (startDist === 0) return

      const newScale = Math.min(6, Math.max(1, startScaleRef.current * (curDist / startDist)))

      // Pan based on midpoint movement
      const startMid = mid(start[0], start[1])
      const curMid = mid(touches[0], touches[1])
      const newX = startOffsetRef.current.x + (curMid.x - startMid.x)
      const newY = startOffsetRef.current.y + (curMid.y - startMid.y)

      scaleRef.current = newScale
      offsetRef.current = { x: newX, y: newY }
      applyTransform(newScale, newX, newY)

    } else if (touches.length === 1 && start.length >= 1 && scaleRef.current > 1) {
      // Single finger pan (only when zoomed)
      const newX = startOffsetRef.current.x + (touches[0].x - start[0].x)
      const newY = startOffsetRef.current.y + (touches[0].y - start[0].y)
      offsetRef.current = { x: newX, y: newY }
      applyTransform(scaleRef.current, newX, newY)
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    e.preventDefault()
    // Snap back if under-zoomed
    if (scaleRef.current < 1.05) {
      scaleRef.current = 1
      offsetRef.current = { x: 0, y: 0 }
      if (imgRef.current) {
        imgRef.current.style.transition = 'transform 0.25s ease'
        applyTransform(1, 0, 0)
        setTimeout(() => { if (imgRef.current) imgRef.current.style.transition = 'none' }, 260)
      }
    }
    // Update start refs for next gesture
    startTouchesRef.current = getTouches(e)
    startScaleRef.current = scaleRef.current
    startOffsetRef.current = { ...offsetRef.current }
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-black flex items-center justify-center overflow-hidden"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'none' }}>
      <img
        ref={imgRef}
        src={src}
        alt="photo"
        draggable={false}
        style={{
          maxWidth: '100vw',
          maxHeight: '100vh',
          objectFit: 'contain',
          transformOrigin: 'center center',
          transform: 'translate(0px,0px) scale(1)',
          transition: 'none',
          userSelect: 'none',
          willChange: 'transform',
        }}
      />
      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onClose() }}
        style={{
          position: 'absolute',
          top: 'max(16px, env(safe-area-inset-top, 16px))',
          right: 16,
          width: 44,
          height: 44,
          background: 'rgba(0,0,0,0.75)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 20,
          zIndex: 100,
          WebkitTapHighlightColor: 'transparent',
          cursor: 'pointer',
          border: 'none',
        }}>
        ✕
      </button>
    </div>
  )
}

export default function PostDetailModal({ rating, onClose, onUserClick, onShopClick }: Props) {
  const { profile } = useAuth()
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [isLiked, setIsLiked] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [likesCount, setLikesCount] = useState(rating.likes_count || 0)
  const [showLikedBy, setShowLikedBy] = useState(false)
  const [showEditPost, setShowEditPost] = useState(false)
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set())
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionUsers, setMentionUsers] = useState<any[]>([])
  const [mentionStart, setMentionStart] = useState(-1)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const swipeBack = useSwipeBack(() => onClose(comments.length, likesCount))
  const [zoomedPhoto, setZoomedPhoto] = useState(false)

  const user = rating.profiles as any
  const shop = rating.coffee_shops as any
  const mugColor = getMugColor(rating.fill_level)

  useEffect(() => {
    async function load() {
      const [commentsRes, likeRes, saveRes, commentLikesRes] = await Promise.all([
        supabase.from('comments').select('*, profiles(username, avatar_url)').eq('rating_id', rating.id).order('created_at', { ascending: true }),
        profile ? supabase.from('likes').select('id').eq('user_id', profile.id).eq('rating_id', rating.id).single() : Promise.resolve({ data: null }),
        profile ? supabase.from('saved_posts').select('rating_id').eq('user_id', profile.id).eq('rating_id', rating.id).single() : Promise.resolve({ data: null }),
        profile ? supabase.from('comment_likes').select('comment_id').eq('user_id', profile.id) : Promise.resolve({ data: [] }),
      ])
      if (commentsRes.data) setComments(commentsRes.data)
      setIsLiked(!!likeRes.data)
      setIsSaved(!!saveRes.data)
      if (commentLikesRes.data) setLikedComments(new Set(commentLikesRes.data.map((l: any) => l.comment_id)))
      setLoading(false)
    }
    load()

    // Realtime comments
    const channel = supabase
      .channel('comments-' + rating.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `rating_id=eq.${rating.id}` }, async (payload) => {
        // Fetch with profile data
        const { data } = await supabase.from('comments').select('*, profiles(username, avatar_url)').eq('id', payload.new.id).single()
        if (data) setComments(prev => {
          if (prev.find(c => c.id === data.id)) return prev
          return [...prev, data]
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments', filter: `rating_id=eq.${rating.id}` }, (payload) => {
        setComments(prev => prev.filter(c => c.id !== payload.old.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [rating.id, profile])

  async function toggleLike() {
    if (!profile) return
    if (isLiked) {
      await supabase.from('likes').delete().eq('user_id', profile.id).eq('rating_id', rating.id)
      setIsLiked(false); setLikesCount((n: number) => Math.max(0, n - 1))
    } else {
      await supabase.from('likes').insert({ user_id: profile.id, rating_id: rating.id })
      setIsLiked(true); setLikesCount((n: number) => n + 1)
      // Notify post owner
      const ownerId = rating.profiles?.id || rating.user_id
      if (ownerId && ownerId !== profile.id) {
        notifyLike(ownerId, profile.username || 'Someone')
      }
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

  async function handleCommentChange(val: string) {
    setNewComment(val)
    // Detect @mention trigger
    const lastAt = val.lastIndexOf('@')
    if (lastAt >= 0) {
      const query = val.slice(lastAt + 1).split(' ')[0]
      if (query.length >= 1) {
        setMentionStart(lastAt)
        setMentionQuery(query)
        const { data } = await supabase.from('profiles').select('id, username, avatar_url')
          .ilike('username', `${query}%`).neq('id', profile?.id ?? '').limit(5)
        setMentionUsers(data || [])
        return
      }
    }
    setMentionUsers([])
    setMentionStart(-1)
  }

  function insertMention(username: string) {
    const before = newComment.slice(0, mentionStart)
    const after = newComment.slice(mentionStart + mentionQuery.length + 1)
    setNewComment(`${before}@${username} ${after}`)
    setMentionUsers([])
    setMentionStart(-1)
  }

  async function shareExternal() {
    const shop = rating.coffee_shops as any
    const user = rating.profiles as any
    const text = `Check out ${user?.username}'s brew at ${shop?.name ?? 'Social Brew'} — ${rating.fill_level}% ☕`
    const url = 'https://socialbrew-ani.pages.dev'
    if (navigator.share) {
      try { await navigator.share({ title: 'Social Brew', text, url }) } catch { /* dismissed */ }
    } else {
      await navigator.clipboard.writeText(`${text} ${url}`)
      alert('Link copied!')
    }
    setShowShareSheet(false)
  }

  async function toggleCommentLike(commentId: string) {
    if (!profile) return
    if (likedComments.has(commentId)) {
      await supabase.from('comment_likes').delete().eq('user_id', profile.id).eq('comment_id', commentId)
      setLikedComments(prev => { const n = new Set(prev); n.delete(commentId); return n })
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes_count: Math.max(0, (c.likes_count || 0) - 1) } : c))
    } else {
      await supabase.from('comment_likes').insert({ user_id: profile.id, comment_id: commentId })
      setLikedComments(prev => new Set([...prev, commentId]))
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, likes_count: (c.likes_count || 0) + 1 } : c))
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
      if (ownerId && ownerId !== profile.id) notifyComment(ownerId, profile.username || 'Someone', content)
      // Notify @mentions
      const mentioned = content.match(/@(\w+)/g)
      if (mentioned) {
        for (const handle of mentioned) {
          const username = handle.slice(1)
          const { data: mentionedUser } = await supabase.from('profiles').select('id').eq('username', username).single()
          if (mentionedUser?.id && mentionedUser.id !== profile.id) {
            notifyMention(mentionedUser.id, profile.username || 'Someone', content)
          }
        }
      }
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
    <div ref={swipeBack.ref} onTouchStart={swipeBack.onTouchStart} onTouchMove={swipeBack.onTouchMove} onTouchEnd={swipeBack.onTouchEnd} className="fixed inset-0 z-50 bg-cream-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-cream-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button onClick={() => onClose(comments.length, likesCount)} className="text-coffee-500"><ArrowLeft size={22} /></button>
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
        <div className="flex items-center gap-1">
          {/* Edit button — only shown on own posts */}
          {profile && (rating.user_id === profile.id || rating.profiles?.id === profile.id) && (
            <button
              onClick={() => setShowEditPost(true)}
              className="w-8 h-8 flex items-center justify-center text-coffee-400 hover:text-caramel transition-colors"
            >
              <Edit2 size={18} />
            </button>
          )}
          <button onClick={() => onClose(comments.length, likesCount)} className="text-coffee-400"><X size={20} /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {/* Post content */}
        <div className="bg-white mx-4 mt-4 rounded-2xl shadow-sm border border-cream-200 overflow-hidden">
          {/* Photo */}
          {rating.photo_url && (
            <div className="relative">
              <button onClick={() => setZoomedPhoto(true)} className="w-full">
                <div className="h-64 overflow-hidden">
                  <img src={rating.photo_url} alt="moment" className="w-full h-full object-cover" />
                </div>
              </button>
              {(rating.tagged_users as any)?.length > 0 && (
                <div className="absolute bottom-2 left-2 flex gap-1 flex-wrap">
                  {(rating.tagged_users as any).map((u: any) => (
                    <span key={u} className="bg-black/50 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">@{u}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Full screen pinch-to-zoom photo viewer */}
          {zoomedPhoto && rating.photo_url && (
            <PinchZoomPhoto src={rating.photo_url} onClose={() => setZoomedPhoto(false)} />
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
                {likesCount > 0 && <button onClick={() => setShowLikedBy(true)} className="text-sm font-medium hover:text-red-400 transition-colors">{likesCount}</button>}
              </button>
              <div className="flex items-center gap-1.5 text-coffee-500">
                <MessageCircle size={22} />
                {comments.length > 0 && <span className="text-sm">{comments.length}</span>}
              </div>
              <button onClick={() => setShowShareSheet(true)} className="active:scale-90 transition-transform text-coffee-400">
                <Share2 size={20} />
              </button>
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
                  <div className="flex items-center gap-3 mt-1 px-1">
                    {comment.user_id === profile?.id && editingId !== comment.id && (
                      <>
                        <button onClick={() => { setEditingId(comment.id); setEditText(comment.content) }} className="text-coffee-400 text-xs flex items-center gap-1"><Edit2 size={10} /> Edit</button>
                        <button onClick={() => deleteComment(comment.id)} className="text-red-400 text-xs flex items-center gap-1"><Trash2 size={10} /> Delete</button>
                      </>
                    )}
                    <button onClick={() => toggleCommentLike(comment.id)}
                      className="flex items-center gap-1 text-xs ml-auto"
                      style={{ color: likedComments.has(comment.id) ? '#e05a5a' : '#9b7a45' }}>
                      <Heart size={11} fill={likedComments.has(comment.id) ? '#e05a5a' : 'none'} />
                      {(comment.likes_count || 0) > 0 && <span>{comment.likes_count}</span>}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comment input */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-cream-200 max-w-lg mx-auto">
        {/* @mention autocomplete */}
        {mentionUsers.length > 0 && (
          <div className="border-b border-cream-200">
            {mentionUsers.map(u => (
              <button key={u.id} onClick={() => insertMention(u.username)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-cream-50 transition-colors text-left">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white text-xs font-bold">{u.username?.[0]?.toUpperCase()}</span></div>}
                </div>
                <span className="text-coffee-800 text-sm font-medium">@{u.username}</span>
              </button>
            ))}
          </div>
        )}
        <div className="px-4 py-3 flex gap-2 items-center">
          <button onClick={() => setShowShareSheet(true)} className="text-coffee-400 flex-shrink-0">
            <Share2 size={20} />
          </button>
          <input value={newComment} onChange={e => handleCommentChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !mentionUsers.length && postComment()}
            placeholder="Add a comment... @mention someone"
            className="flex-1 bg-cream-100 rounded-full px-4 py-2 text-sm text-coffee-800 placeholder-coffee-300 focus:outline-none border border-cream-200" />
          <button onClick={postComment} disabled={!newComment.trim() || posting}
            className="w-9 h-9 rounded-full bg-caramel flex items-center justify-center disabled:opacity-40 flex-shrink-0">
            <Send size={15} className="text-white" />
          </button>
        </div>
      </div>

      {/* Share Sheet */}
      {showShareSheet && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.7)'}}
          onClick={() => setShowShareSheet(false)}>
          <div className="w-full max-w-sm bg-white rounded-t-3xl p-5 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 bg-cream-50 rounded-2xl p-3 mb-4 border border-cream-200">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                {(rating.profiles as any)?.avatar_url
                  ? <img src={(rating.profiles as any).avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white text-xs font-bold">{(rating.profiles as any)?.username?.[0]?.toUpperCase()}</span></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-coffee-700 font-semibold text-sm">{(rating.profiles as any)?.username}</p>
                <p className="text-coffee-400 text-xs">{(rating.coffee_shops as any)?.name ?? 'Moment'} · {rating.fill_level}%</p>
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={() => setShowShareSheet(false)}
                className="w-full flex items-center gap-3 bg-cream-50 hover:bg-cream-100 transition-colors rounded-xl px-4 py-3.5 text-left border border-cream-200">
                <span className="text-xl">💬</span>
                <div>
                  <p className="text-coffee-800 font-semibold text-sm">Send via Message</p>
                  <p className="text-coffee-400 text-xs">Share with someone on Social Brew</p>
                </div>
              </button>
              <button onClick={shareExternal}
                className="w-full flex items-center gap-3 bg-cream-50 hover:bg-cream-100 transition-colors rounded-xl px-4 py-3.5 text-left border border-cream-200">
                <span className="text-xl">🔗</span>
                <div>
                  <p className="text-coffee-800 font-semibold text-sm">Share Link</p>
                  <p className="text-coffee-400 text-xs">Send to WhatsApp, Instagram, etc.</p>
                </div>
              </button>
            </div>
            <button onClick={() => setShowShareSheet(false)} className="w-full mt-3 py-3 text-coffee-500 text-sm font-medium">Cancel</button>
          </div>
        </div>
      )}
      {showEditPost && (
        <EditPostModal
          rating={rating}
          onClose={() => setShowEditPost(false)}
          onSaved={(updated) => {
            // Refresh the post data in place
            setShowEditPost(false)
            setLikesCount(updated.likes_count || likesCount)
          }}
        />
      )}
      {showLikedBy && <LikedByModal ratingId={rating.id} onClose={() => setShowLikedBy(false)} onViewProfile={() => { setShowLikedBy(false) }} />}
    </div>
  )
}
