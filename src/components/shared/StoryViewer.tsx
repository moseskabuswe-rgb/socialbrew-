// src/components/shared/StoryViewer.tsx
// Full-screen story viewer with progress bars, reactions, and DM replies

import { useState, useEffect, useRef } from 'react'
import { X, Eye, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { notifyDM } from '../../lib/push'

interface Story {
  id: string
  user_id: string
  photo_url: string | null
  caption: string | null
  story_type: string
  created_at: string
  profiles?: { username: string; avatar_url: string | null }
  viewed: boolean
  view_count?: number
}

interface StoryGroup {
  user_id: string
  username: string
  avatar_url: string | null
  stories: Story[]
  hasUnviewed: boolean
}

interface Props {
  group: StoryGroup
  onClose: () => void
  onViewed: (storyId: string) => void
  isOwn: boolean
}

const STORY_DURATION = 5000
const QUICK_REACTIONS = ['❤️', '😍', '🔥', '☕', '😂', '👏']

export default function StoryViewer({ group, onClose, onViewed, isOwn }: Props) {
  const { profile } = useAuth()
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)  // eslint-disable-line
  const [replyText, setReplyText] = useState('')
  const [showReply, setShowReply] = useState(false)
  const [sending, setSending] = useState(false)
  const [myReaction, setMyReaction] = useState<string | null>(null)
  const timerRef = useRef<any>(null)
  const progressRef = useRef<any>(null)
  const startTimeRef = useRef<number>(0)
  const elapsedRef = useRef<number>(0)

  const story = group.stories[index]

  useEffect(() => {
    if (!story) return
    onViewed(story.id)
    loadMyReaction()
    startTimer()
    return () => stopTimer()
  }, [index, story?.id])

  // Pause when reply input is open
  useEffect(() => {
    if (showReply) {
      stopTimer()
    } else {
      startTimer()
    }
  }, [showReply])

  async function loadMyReaction() {
    if (!profile || isOwn) return
    const { data } = await supabase
      .from('story_reactions')
      .select('emoji')
      .eq('story_id', story.id)
      .eq('user_id', profile.id)
      .maybeSingle()
    setMyReaction(data?.emoji || null)
  }

  function startTimer() {
    stopTimer()
    setProgress(elapsedRef.current / STORY_DURATION * 100)
    startTimeRef.current = Date.now()

    progressRef.current = setInterval(() => {
      const totalElapsed = elapsedRef.current + (Date.now() - startTimeRef.current)
      setProgress(Math.min((totalElapsed / STORY_DURATION) * 100, 100))
    }, 50)

    timerRef.current = setTimeout(() => {
      elapsedRef.current = 0
      if (index < group.stories.length - 1) {
        setIndex(i => i + 1)
      } else {
        onClose()
      }
    }, STORY_DURATION - elapsedRef.current)
  }

  function stopTimer() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (progressRef.current) clearInterval(progressRef.current)
    elapsedRef.current = elapsedRef.current + (Date.now() - (startTimeRef.current || Date.now()))
  }

  function prev() {
    stopTimer()
    elapsedRef.current = 0
    if (index > 0) setIndex(i => i - 1)
    else onClose()
  }

  function next() {
    stopTimer()
    elapsedRef.current = 0
    if (index < group.stories.length - 1) setIndex(i => i + 1)
    else onClose()
  }

  async function sendReaction(emoji: string) {
    if (!profile || isOwn || sending) return
    setSending(true)

    // Upsert reaction
    await supabase.from('story_reactions').upsert(
      { story_id: story.id, user_id: profile.id, emoji },
      { onConflict: 'story_id,user_id' }
    )
    setMyReaction(emoji)

    // Send as DM to story owner
    const { data: dm } = await supabase
      .from('direct_messages')
      .insert({
        from_id: profile.id,
        to_id: group.user_id,
        content: `${emoji} reacted to your story`,
        story_id: story.id,
      })
      .select('*, profiles!direct_messages_from_id_fkey(username, avatar_url)')
      .single()

    if (dm) {
      try {
        await notifyDM(
          group.user_id,
          profile.username || 'Someone',
          `${emoji} reacted to your story`
        )
      } catch {}
    }

    setSending(false)
  }

  async function sendReply() {
    if (!profile || !replyText.trim() || sending || isOwn) return
    setSending(true)

    await supabase.from('direct_messages').insert({
      from_id: profile.id,
      to_id: group.user_id,
      content: replyText.trim(),
      story_id: story.id,
    })

    try {
      await notifyDM(
        group.user_id,
        profile.username || 'Someone',
        replyText.trim()
      )
    } catch {}

    setReplyText('')
    setShowReply(false)
    setSending(false)
  }

  if (!story) return null

  const timeAgo = (() => {
    const diff = (Date.now() - new Date(story.created_at).getTime()) / 1000 / 60
    if (diff < 60) return `${Math.floor(diff)}m ago`
    return `${Math.floor(diff / 60)}h ago`
  })()

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col">
      {/* Progress bars */}
      <div className="flex gap-1 px-3 pt-12 pb-2 flex-shrink-0">
        {group.stories.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/30">
            <div
              className="h-full bg-white rounded-full"
              style={{
                width: i < index ? '100%' : i === index ? `${progress}%` : '0%',
                transition: i === index ? 'none' : undefined,
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-coffee-300 flex-shrink-0">
          {group.avatar_url
            ? <img src={group.avatar_url} alt="" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
            : <div className="w-full h-full flex items-center justify-center bg-caramel">
                <span className="text-white font-bold text-sm">{group.username?.[0]?.toUpperCase()}</span>
              </div>}
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">{group.username}</p>
          <p className="text-white/50 text-xs">{timeAgo}</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <X size={16} className="text-white" />
        </button>
      </div>

      {/* Story content */}
      <div className="flex-1 relative overflow-hidden">
        {story.photo_url ? (
          <img src={story.photo_url} alt="" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-8"
            style={{ background: 'linear-gradient(160deg, #1a0a02, #3d1a06, #6b3410)' }}>
            <p className="text-white font-display text-3xl font-bold text-center leading-tight">
              {story.caption || '☕'}
            </p>
          </div>
        )}

        {/* Caption overlay for photo stories */}
        {story.photo_url && story.caption && (
          <div className="absolute bottom-0 left-0 right-0 px-5 py-6"
            style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
            <p className="text-white text-base font-medium">{story.caption}</p>
          </div>
        )}

        {/* View count for own stories */}
        {isOwn && (
          <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-black/40 rounded-full px-3 py-1.5">
            <Eye size={13} className="text-white/70" />
            <span className="text-white/70 text-xs">{story.view_count || 0} views</span>
          </div>
        )}

        {/* Tap zones — only active when reply is closed */}
        {!showReply && (
          <div className="absolute inset-0 flex">
            <div className="w-1/3 h-full" onClick={prev} />
            <div className="w-1/3 h-full" />
            <div className="w-1/3 h-full" onClick={next} />
          </div>
        )}
      </div>

      {/* Reactions + reply bar — only for other people's stories */}
      {!isOwn && (
        <div className="flex-shrink-0 px-4 pb-10 pt-3 flex flex-col gap-3">
          {/* Quick reactions */}
          {!showReply && (
            <div className="flex items-center justify-center gap-3">
              {QUICK_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className={`text-2xl transition-transform active:scale-125 ${myReaction === emoji ? 'scale-125' : ''}`}
                  style={{ filter: myReaction === emoji ? 'drop-shadow(0 0 8px rgba(255,200,100,0.8))' : 'none' }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Reply input */}
          {showReply ? (
            <div className="flex items-center gap-2">
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder={`Reply to ${group.username}...`}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && replyText.trim()) sendReply() }}
                className="flex-1 bg-white/15 text-white rounded-full px-4 py-2.5 text-sm placeholder-white/40 focus:outline-none border border-white/20"
              />
              <button
                onClick={() => { setShowReply(false); setReplyText('') }}
                className="text-white/60 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={sendReply}
                disabled={!replyText.trim() || sending}
                className="w-9 h-9 rounded-full bg-caramel flex items-center justify-center disabled:opacity-40"
              >
                <Send size={15} className="text-white" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowReply(true)}
              className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2.5"
            >
              <span className="text-white/50 text-sm flex-1 text-left">Reply to {group.username}...</span>
              <Send size={14} className="text-white/40" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
