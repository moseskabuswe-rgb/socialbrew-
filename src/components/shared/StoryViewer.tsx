// src/components/shared/StoryViewer.tsx
// Full-screen story viewer with progress bars

import { useState, useEffect, useRef } from 'react'
import { X, Eye } from 'lucide-react'

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

export default function StoryViewer({ group, onClose, onViewed, isOwn }: Props) {
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const timerRef = useRef<any>(null)
  const progressRef = useRef<any>(null)

  const story = group.stories[index]

  useEffect(() => {
    if (!story) return
    onViewed(story.id)
    setProgress(0)

    const start = Date.now()
    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      setProgress(Math.min((elapsed / STORY_DURATION) * 100, 100))
    }, 50)

    timerRef.current = setTimeout(() => {
      if (index < group.stories.length - 1) {
        setIndex(i => i + 1)
      } else {
        onClose()
      }
    }, STORY_DURATION)

    return () => {
      clearTimeout(timerRef.current)
      clearInterval(progressRef.current)
    }
  }, [index, story?.id])

  function prev() {
    clearTimeout(timerRef.current)
    clearInterval(progressRef.current)
    if (index > 0) setIndex(i => i - 1)
    else onClose()
  }

  function next() {
    clearTimeout(timerRef.current)
    clearInterval(progressRef.current)
    if (index < group.stories.length - 1) setIndex(i => i + 1)
    else onClose()
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
              className="h-full bg-white rounded-full transition-none"
              style={{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 flex-shrink-0">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-coffee-300 flex-shrink-0">
          {group.avatar_url
            ? <img src={group.avatar_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white font-bold text-sm">{group.username?.[0]?.toUpperCase()}</span></div>}
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
          <img src={story.photo_url} alt="" className="w-full h-full object-cover" />
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

        {/* Tap zones */}
        <div className="absolute inset-0 flex">
          <div className="w-1/3 h-full" onClick={prev} />
          <div className="w-1/3 h-full" />
          <div className="w-1/3 h-full" onClick={next} />
        </div>
      </div>
    </div>
  )
}
