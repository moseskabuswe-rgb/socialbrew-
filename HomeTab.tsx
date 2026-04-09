import { useState, useEffect, useCallback } from 'react'
import { Heart, MessageCircle, Gift, Bookmark, X, Send } from 'lucide-react'
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

type Comment = {
  id: string
  content: string
  created_at: string
  profiles: { username: string; avatar_url: string | null }
}

function CommentSheet({ ratingId, onClose }: { ratingId: string; onClose: () => void }) {
  const { profile } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    loadComments()
  }, [ratingId])

  async function loadComments() {
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(username, avatar_url)')
      .eq('rating_id', ratingId)
      .order('created_at', { ascending: true })

    if (data) setComments(data as Comment[])
    setLoading(false)
  }

  async function postComment() {
    if (!text.trim() || !profile || posting) return
    setPosting(true)

    const { data } = await supabase
      .from('comments')
      .insert({ rating_id: ratingId, user_id: profile.id, content: text.trim() })
      .select('*, profiles(username, avatar_url)')
      .single()

    if (data) {
      setComments(prev => [...prev, data as Comment])
    }

    setText('')
    setPosting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="flex-1" onClick={onClose} />
      <div className="bg-white rounded-t-3xl flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold">Comments</h3>
          <button onClick={onClose}><X size={14} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {comments.map(c => (
            <div key={c.id}>
              <p className="text-xs font-semibold">{c.profiles?.username}</p>
              <p className="text-sm">{c.content}</p>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t flex gap-3">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1"
          />
          <button onClick={postComment}><Send size={16} /></button>
        </div>
      </div>
    </div>
  )
}

export default function HomeTab({ refresh }: { refresh: number }) {
  const { profile } = useAuth()
  const [ratings, setRatings] = useState<Rating[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [commentRatingId, setCommentRatingId] = useState<string | null>(null)

  const loadFeed = useCallback(async () => {
    if (!profile) return

    setLoading(true)

    const { data } = await supabase
      .from('ratings')
      .select('*, profiles(*), coffee_shops(*)')
      .order('created_at', { ascending: false })

    setRatings(data || [])
    setLoading(false)
  }, [profile])

  const loadLikes = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('likes').select('rating_id').eq('user_id', profile.id)
    if (data) setLikedIds(new Set(data.map(l => l.rating_id)))
  }, [profile])

  useEffect(() => {
    if (profile) {
      loadFeed()
      loadLikes()
    }
  }, [profile, refresh, loadFeed, loadLikes])

  async function toggleLike(ratingId: string) {
    if (!profile) return
    const isLiked = likedIds.has(ratingId)

    if (isLiked) {
      await supabase.from('likes').delete().eq('user_id', profile.id).eq('rating_id', ratingId)
      setLikedIds(prev => {
        const n = new Set(prev)
        n.delete(ratingId)
        return n
      })
    } else {
      await supabase.from('likes').insert({ user_id: profile.id, rating_id: ratingId })
      setLikedIds(prev => new Set([...prev, ratingId]))
    }
  }

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="p-5 font-bold text-xl">Social Brew</div>

      {loading && <div className="text-center py-10">Loading...</div>}

      {!loading && ratings.length === 0 && (
        <div className="text-center py-10">No posts</div>
      )}

      {ratings.map(r => (
        <div key={r.id} className="bg-white m-4 p-4 rounded-xl">
          <p className="font-semibold">{(r.profiles as any)?.username}</p>
          <p className="text-sm">{r.caption}</p>

          <div className="flex gap-4 mt-2">
            <button onClick={() => toggleLike(r.id)}>
              <Heart size={18} />
            </button>
            <button onClick={() => setCommentRatingId(r.id)}>
              <MessageCircle size={18} />
            </button>
          </div>
        </div>
      ))}

      {commentRatingId && (
        <CommentSheet
          ratingId={commentRatingId}
          onClose={() => setCommentRatingId(null)}
        />
      )}
    </div>
  )
}
