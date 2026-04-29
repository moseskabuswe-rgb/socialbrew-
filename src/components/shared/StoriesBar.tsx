// src/components/shared/StoriesBar.tsx
// Horizontal scrolling story bubbles at top of home feed
// Shows stories from people the current user follows

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import StoryViewer from './StoryViewer'
import CreateStory from './CreateStory'

interface Story {
  id: string
  user_id: string
  photo_url: string | null
  caption: string | null
  story_type: string
  created_at: string
  expires_at: string
  profiles: {
    username: string
    avatar_url: string | null
  }
  viewed: boolean
}

interface StoryGroup {
  user_id: string
  username: string
  avatar_url: string | null
  stories: Story[]
  hasUnviewed: boolean
}

export default function StoriesBar() {
  const { profile } = useAuth()
  const [groups, setGroups] = useState<StoryGroup[]>([])
  const [myStories, setMyStories] = useState<Story[]>([])
  const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    loadStories()
  }, [profile])

  async function loadStories() {
    if (!profile) return

    // Get following IDs
    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', profile.id)

    const followingIds = (followingData || []).map((f: any) => f.following_id)
    const allIds = [...followingIds, profile.id]

    // Get active stories from followed users + own stories (separate query ensures own always loads)
    const now = new Date().toISOString()
    const [followingStoriesRes, ownStoriesRes] = await Promise.all([
      supabase
        .from('stories')
        .select('*, profiles(username, avatar_url)')
        .in('user_id', followingIds.length > 0 ? followingIds : ['00000000-0000-0000-0000-000000000000'])
        .gt('expires_at', now)
        .order('created_at', { ascending: false }),
      supabase
        .from('stories')
        .select('*, profiles(username, avatar_url)')
        .eq('user_id', profile.id)
        .gt('expires_at', now)
        .order('created_at', { ascending: false })
    ])
    // Merge and deduplicate
    const allStories = [...(ownStoriesRes.data || []), ...(followingStoriesRes.data || [])]
    const seenIds = new Set<string>()
    const storiesData = allStories.filter(s => { if (seenIds.has(s.id)) return false; seenIds.add(s.id); return true })

    if (!storiesData) { setLoading(false); return }

    // Get viewed story IDs
    const { data: viewsData } = await supabase
      .from('story_views')
      .select('story_id')
      .eq('viewer_id', profile.id)

    const viewedIds = new Set((viewsData || []).map((v: any) => v.story_id))

    // Group by user
    const groupMap: Record<string, StoryGroup> = {}
    const mine: Story[] = []

    for (const s of storiesData) {
      const story = { ...s, viewed: viewedIds.has(s.id) }
      if (s.user_id === profile.id) {
        mine.push(story)
      }
      if (!groupMap[s.user_id]) {
        groupMap[s.user_id] = {
          user_id: s.user_id,
          username: s.profiles?.username || '',
          avatar_url: s.profiles?.avatar_url || null,
          stories: [],
          hasUnviewed: false,
        }
      }
      groupMap[s.user_id].stories.push(story)
      if (!story.viewed && s.user_id !== profile.id) {
        groupMap[s.user_id].hasUnviewed = true
      }
    }

    // Own stories first, then unviewed, then viewed
    const sorted = Object.values(groupMap)
      .filter(g => g.user_id !== profile.id)
      .sort((a, b) => Number(b.hasUnviewed) - Number(a.hasUnviewed))

    setMyStories(mine)
    setGroups(sorted)
    setLoading(false)
  }

  async function markViewed(storyId: string) {
    if (!profile) return
    await supabase.from('story_views').upsert({ story_id: storyId, viewer_id: profile.id }, { onConflict: 'story_id,viewer_id', ignoreDuplicates: true })
  }

  if (loading) return null
  if (groups.length === 0 && myStories.length === 0) return (
    <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
      <button onClick={() => setShowCreate(true)} className="flex flex-col items-center gap-1.5 flex-shrink-0">
        <div className="w-14 h-14 rounded-full border-2 border-dashed border-cream-300 flex items-center justify-center bg-cream-50">
          <Plus size={20} className="text-coffee-400" />
        </div>
        <span className="text-coffee-400 text-xs">Your story</span>
      </button>
      {showCreate && <CreateStory onClose={() => setShowCreate(false)} onCreated={loadStories} />}
    </div>
  )

  return (
    <>
      <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
        {/* Own story bubble */}
        <button onClick={() => myStories.length > 0 ? setViewingGroup({ user_id: profile!.id, username: profile!.username, avatar_url: profile!.avatar_url || null, stories: myStories, hasUnviewed: false }) : setShowCreate(true)}
          className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="relative">
            <div className={`w-14 h-14 rounded-full p-0.5 ${myStories.length > 0 ? 'bg-gradient-to-tr from-caramel to-amber-300' : 'border-2 border-dashed border-cream-300'}`}>
              <div className="w-full h-full rounded-full overflow-hidden bg-cream-100">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white font-bold text-lg">{profile?.username?.[0]?.toUpperCase()}</span></div>}
              </div>
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-caramel rounded-full flex items-center justify-center border-2 border-white">
              <Plus size={10} className="text-white" />
            </div>
          </div>
          <span className="text-coffee-500 text-xs font-medium">Your story</span>
        </button>

        {/* Following stories */}
        {groups.map(group => (
          <button key={group.user_id}
            onClick={() => setViewingGroup(group)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className={`w-14 h-14 rounded-full p-0.5 ${group.hasUnviewed ? 'bg-gradient-to-tr from-caramel to-amber-300' : 'bg-cream-200'}`}>
              <div className="w-full h-full rounded-full overflow-hidden bg-cream-100">
                {group.avatar_url
                  ? <img src={group.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center bg-coffee-300"><span className="text-white font-bold text-lg">{group.username?.[0]?.toUpperCase()}</span></div>}
              </div>
            </div>
            <span className={`text-xs font-medium max-w-[56px] truncate ${group.hasUnviewed ? 'text-coffee-700' : 'text-coffee-400'}`}>
              {group.username}
            </span>
          </button>
        ))}
      </div>

      {viewingGroup && (
        <StoryViewer
          group={viewingGroup}
          onClose={() => { setViewingGroup(null); loadStories() }}
          onViewed={markViewed}
          isOwn={viewingGroup.user_id === profile?.id}
        />
      )}
      {showCreate && <CreateStory onClose={() => setShowCreate(false)} onCreated={loadStories} />}
    </>
  )
}
