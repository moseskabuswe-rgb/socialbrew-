import { useState, useEffect, useRef } from 'react'
import { X, Eye, Send, ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { notifyDM } from '../../lib/push'

interface Story {
  id: string
  user_id: string
  photo_url: string | null
  photo_urls?: string[] | null
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

interface Slide {
  story: Story
  photo: string | null
}

interface Props {
  group: StoryGroup
  onClose: () => void
  onViewed: (storyId: string) => void
  isOwn: boolean
  onNext?: () => void
}

const STORY_DURATION = 5000
const QUICK_REACTIONS = ['❤️', '😍', '🔥', '☕', '😂', '👏']

export default function StoryViewer({ group, onClose, onViewed, isOwn, onNext }: Props) {
  const { profile } = useAuth()
  const [slideIndex, setSlideIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [replyText, setReplyText] = useState('')
  const [showReply, setShowReply] = useState(false)
  const [sending, setSending] = useState(false)
  const [myReaction, setMyReaction] = useState<string | null>(null)
  const [showViewers, setShowViewers] = useState(false)
  const [viewers, setViewers] = useState<Array<{ id: string; username: string; avatar_url: string | null }>>([])
  const [storyScale, setStoryScale] = useState(1)

  const timerRef = useRef<any>(null)
  const progressRef = useRef<any>(null)
  const startTimeRef = useRef<number>(0)
  const elapsedRef = useRef<number>(0)
  const timerRunningRef = useRef(false)
  const slideIndexRef = useRef(0)
  const onCloseRef = useRef(onClose)
  const onNextRef = useRef(onNext)
  const storyPinchStartDist = useRef(0)
  const storyPinchStartScale = useRef(1)
  const storyIsPinching = useRef(false)
  const viewedStoryIds = useRef<Set<string>>(new Set())

  // Keep callback refs fresh so timers never use stale closures
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { onNextRef.current = onNext }, [onNext])
  slideIndexRef.current = slideIndex

  // Flatten stories × photos into one slide per photo (Instagram-style)
  const slides: Slide[] = group.stories.flatMap((story): Slide[] => {
    const photos = story.photo_urls?.length
      ? story.photo_urls
      : story.photo_url
        ? [story.photo_url]
        : []
    if (photos.length > 0) return photos.map(photo => ({ story, photo }))
    return [{ story, photo: null }]
  })

  const currentSlide = slides[slideIndex]
  const story = currentSlide?.story

  // Start fresh timer on every slide change
  useEffect(() => {
    if (!story) return
    elapsedRef.current = 0
    if (!viewedStoryIds.current.has(story.id)) {
      viewedStoryIds.current.add(story.id)
      onViewed(story.id)
    }
    loadMyReaction()
    setStoryScale(1)
    startTimer()
    return () => stopTimer()
  }, [slideIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pause while reply / viewers panel is open
  useEffect(() => {
    if (showReply || showViewers) stopTimer()
    else startTimer()
  }, [showReply, showViewers]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMyReaction() {
    if (!profile || isOwn || !story) return
    const { data } = await supabase
      .from('story_reactions')
      .select('emoji')
      .eq('story_id', story.id)
      .eq('user_id', profile.id)
      .maybeSingle()
    setMyReaction(data?.emoji || null)
  }

  // Move to next slide, then next group, then close
  function advance() {
    const idx = slideIndexRef.current
    if (idx < slides.length - 1) {
      setSlideIndex(idx + 1)
    } else if (onNextRef.current) {
      onNextRef.current()
    } else {
      requestAnimationFrame(() => onCloseRef.current())
    }
  }

  function startTimer() {
    // Clear without accumulating (timer may already be stopped)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (progressRef.current) clearInterval(progressRef.current)
    timerRunningRef.current = true
    startTimeRef.current = Date.now()

    setProgress((elapsedRef.current / STORY_DURATION) * 100)

    progressRef.current = setInterval(() => {
      const totalElapsed = elapsedRef.current + (Date.now() - startTimeRef.current)
      setProgress(Math.min((totalElapsed / STORY_DURATION) * 100, 100))
    }, 50)

    const remaining = Math.max(0, STORY_DURATION - elapsedRef.current)
    timerRef.current = setTimeout(() => {
      timerRunningRef.current = false
      elapsedRef.current = 0
      advance()
    }, remaining)
  }

  function stopTimer() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (progressRef.current) clearInterval(progressRef.current)
    timerRef.current = null
    progressRef.current = null
    if (timerRunningRef.current) {
      elapsedRef.current = Math.min(
        elapsedRef.current + (Date.now() - startTimeRef.current),
        STORY_DURATION
      )
      timerRunningRef.current = false
    }
  }

  function nextSlide() {
    stopTimer()
    elapsedRef.current = 0
    advance()
  }

  function prevSlide() {
    stopTimer()
    elapsedRef.current = 0
    const idx = slideIndexRef.current
    if (idx > 0) {
      setSlideIndex(idx - 1)
    } else {
      requestAnimationFrame(() => onCloseRef.current())
    }
  }

  async function sendReaction(emoji: string) {
    if (!profile || isOwn || sending || !story) return
    setSending(true)
    await supabase.from('story_reactions').upsert(
      { story_id: story.id, user_id: profile.id, emoji },
      { onConflict: 'story_id,user_id' }
    )
    setMyReaction(emoji)
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
      try { await notifyDM(group.user_id, profile.username || 'Someone', `${emoji} reacted to your story`, profile.id) } catch {}
    }
    setSending(false)
  }

  async function sendReply() {
    if (!profile || !replyText.trim() || sending || isOwn || !story) return
    setSending(true)
    await supabase.from('direct_messages').insert({
      from_id: profile.id,
      to_id: group.user_id,
      content: replyText.trim(),
      story_id: story.id,
    })
    try { await notifyDM(group.user_id, profile.username || 'Someone', replyText.trim(), profile.id) } catch {}
    setReplyText('')
    setShowReply(false)
    setSending(false)
  }

  async function loadViewers(storyId: string) {
    const { data } = await supabase
      .from('story_views')
      .select('profiles!story_views_viewer_id_fkey(id, username, avatar_url)')
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false })
    setViewers((data || []).map((v: any) => v.profiles).filter(Boolean))
  }

  if (!currentSlide) return null

  const timeAgo = (() => {
    const diff = (Date.now() - new Date(story.created_at).getTime()) / 1000 / 60
    if (diff < 60) return `${Math.floor(diff)}m ago`
    return `${Math.floor(diff / 60)}h ago`
  })()

  return (
    <div
      className="fixed inset-0 z-[90] bg-black flex flex-col"
      onClick={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
      onTouchMove={e => e.stopPropagation()}
    >
      {/* Progress bars — one per slide (photo) */}
      <div className="flex gap-1 px-3 pt-12 pb-2 flex-shrink-0">
        {slides.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/30">
            <div
              className="h-full bg-white rounded-full"
              style={{
                width: i < slideIndex ? '100%' : i === slideIndex ? `${progress}%` : '0%',
                transition: i === slideIndex ? 'none' : undefined,
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
        <button
          onClick={e => { e.stopPropagation(); onClose() }}
          className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
        >
          <X size={16} className="text-white" />
        </button>
      </div>

      {/* Story content */}
      <div
        className="flex-1 relative overflow-hidden"
        onTouchStart={(e) => {
          if (e.touches.length === 2) {
            storyIsPinching.current = true
            storyPinchStartDist.current = Math.hypot(
              e.touches[1].clientX - e.touches[0].clientX,
              e.touches[1].clientY - e.touches[0].clientY
            )
            storyPinchStartScale.current = storyScale
          }
        }}
        onTouchMove={(e) => {
          if (e.touches.length === 2 && storyIsPinching.current) {
            const dist = Math.hypot(
              e.touches[1].clientX - e.touches[0].clientX,
              e.touches[1].clientY - e.touches[0].clientY
            )
            setStoryScale(Math.min(4, Math.max(1, storyPinchStartScale.current * (dist / storyPinchStartDist.current))))
          }
        }}
        onTouchEnd={() => {
          if (storyIsPinching.current) {
            storyIsPinching.current = false
            if (storyScale < 1.05) setStoryScale(1)
          }
        }}
      >
        {currentSlide.photo ? (
          <img
            key={currentSlide.photo}
            src={currentSlide.photo}
            alt=""
            className="w-full h-full object-contain"
            style={{
              transform: `translateZ(0) scale(${storyScale})`,
              transition: storyIsPinching.current ? 'none' : 'transform 0.2s ease',
            }}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center p-8"
            style={{ background: 'linear-gradient(160deg, #1a0a02, #3d1a06, #6b3410)' }}
          >
            <p className="text-white font-display text-3xl font-bold text-center leading-tight">
              {story.caption || '☕'}
            </p>
          </div>
        )}

        {/* Caption overlay for photo slides */}
        {currentSlide.photo && story.caption && (
          <div
            className="absolute bottom-32 left-0 right-0 px-5 py-4"
            style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}
          >
            <p className="text-white text-base font-medium">{story.caption}</p>
          </div>
        )}

        {/* View count for own stories */}
        {isOwn && (
          <>
            <button
              onClick={() => { loadViewers(story.id); setShowViewers(true) }}
              className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-black/40 rounded-full px-3 py-1.5 active:scale-95 transition-all z-10"
            >
              <Eye size={13} className="text-white/70" />
              <span className="text-white/70 text-xs font-medium">
                {story.view_count || 0} {(story.view_count || 0) === 1 ? 'view' : 'views'}
              </span>
            </button>

            {showViewers && (
              <div
                className="absolute bottom-0 left-0 right-0 rounded-t-2xl flex flex-col z-20"
                style={{ background: 'rgba(18,10,4,0.97)', maxHeight: '60%' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 flex-shrink-0">
                  <button
                    onClick={() => setShowViewers(false)}
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0"
                  >
                    <ChevronLeft size={18} className="text-white" />
                  </button>
                  <p className="text-white font-semibold text-sm flex-1">
                    {viewers.length} {viewers.length === 1 ? 'viewer' : 'viewers'}
                  </p>
                </div>
                <div className="overflow-y-auto flex-1 py-2">
                  {viewers.length === 0 && (
                    <p className="text-white/40 text-sm text-center py-6">No views yet</p>
                  )}
                  {viewers.map(v => (
                    <div key={v.id} className="flex items-center gap-3 px-5 py-2.5">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-coffee-700 flex-shrink-0">
                        {v.avatar_url
                          ? <img src={v.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center">
                              <span className="text-white text-sm font-bold">{v.username?.[0]?.toUpperCase()}</span>
                            </div>}
                      </div>
                      <p className="text-white text-sm font-medium">@{v.username}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Tap zones — left third goes back, right third advances */}
        {!showReply && !showViewers && storyScale <= 1 && (
          <div className="absolute inset-0 flex">
            <div className="w-1/3 h-full" onClick={prevSlide} />
            <div className="w-1/3 h-full" />
            <div className="w-1/3 h-full" onClick={nextSlide} />
          </div>
        )}

        {/* Preload next slide's photo */}
        {slides[slideIndex + 1]?.photo && (
          <img src={slides[slideIndex + 1].photo!} style={{ display: 'none' }} alt="" />
        )}
      </div>

      {/* Reactions + reply — only for others' stories */}
      {!isOwn && (
        <div className="flex-shrink-0 px-4 pb-10 pt-3 flex flex-col gap-3">
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
              <button onClick={() => { setShowReply(false); setReplyText('') }} className="text-white/60 text-sm">
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
