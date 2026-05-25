import { useState, useEffect, useCallback, useRef } from 'react'
import { Heart, MessageCircle, Bookmark, MoreHorizontal, X, Trash2, Flag, UserX, Plus, Edit2, Check, Send, Gift, ArrowLeft, Share2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import PricePills from '../shared/PricePills'
import ShareCard from '../shared/ShareCard'
import { useAuth } from '../../contexts/AuthContext'
import BrewWrapped from '../shared/BrewWrapped'
import LikedByModal from '../shared/LikedByModal'
import EditPostModal from '../shared/EditPostModal'
import StoriesBar from '../shared/StoriesBar'
import { trackEvent } from '../../lib/analytics'
import { notifyLike, notifyComment, notifyMention, notifyDM, notifyFollow } from '../../lib/push'
import ShopDetailPage from '../shared/ShopDetailPage'
import ShopsFeed from '../shops/ShopsFeed'
import PostDetailModal from '../shared/PostDetailModal'
import MessagingInbox from '../messaging/MessagingInbox'
import UserProfilePage from '../shared/UserProfilePage'
import { NotificationBell } from '../shared/NotificationsPanel'
import { cachedUrl } from '../../lib/storageUrl'

function getMugColor(fill: number) {
  if (fill === 0)  return 'transparent'
  if (fill <= 59)  return '#d4b896'
  if (fill <= 69)  return '#c49a6c'
  if (fill <= 79)  return '#b87333'
  if (fill <= 89)  return '#9b5e1a'
  if (fill <= 99)  return '#6b3410'
  return '#3d1a06'
}
function getFillLabel(fill: number) {
  if (fill === 0)  return ''
  if (fill <= 59)  return 'Not My Cup'
  if (fill <= 69)  return 'Just a Sip'
  if (fill <= 79)  return 'Decent Pour'
  if (fill <= 89)  return 'Good Brew'
  if (fill <= 99)  return 'Loved It'
  return 'Perfect Brew ✨'
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
// Format shop location — handles US (City, State) and international (City, Country)
// Gracefully handles missing fields
function formatLocation(city?: string | null, state?: string | null, country?: string | null): string {
  const c = city?.trim()
  const s = state?.trim()
  const co = country?.trim()
  if (!c) return s || co || ''
  // US: show City, State
  if (s && (!co || co === 'United States')) return `${c}, ${s}`
  // International: show City, Country
  if (co && co !== 'United States') return `${c}, ${co}`
  // Fallback: just city
  return c
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── MESSAGES ─────────────────────────────────────────────
const REACTION_EMOJIS = ['☕', '❤️', '😂', '😮', '👍', '🔥']

function MessagesPanel({ onClose, unreadPerSender = {}, onMarkRead }: {
  onClose: () => void
  unreadPerSender?: Record<string, number>
  onMarkRead?: (senderId: string) => void
}) {
  const { profile } = useAuth()
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConvo, setActiveConvo] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchUser, setSearchUser] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [reactions, setReactions] = useState<Record<string, any[]>>({})
  const [reactionPicker, setReactionPicker] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    async function load() {
      // Fetch sent and received with last message info
      const { data: sent } = await supabase.from('direct_messages')
        .select('to_id, created_at, content, profiles!direct_messages_to_id_fkey(id,username,avatar_url)')
        .eq('from_id', profile!.id).order('created_at', { ascending: false })
      const { data: received } = await supabase.from('direct_messages')
        .select('from_id, created_at, content, profiles!direct_messages_from_id_fkey(id,username,avatar_url)')
        .eq('to_id', profile!.id).order('created_at', { ascending: false })

      // Build conversation map with last message
      const partners = new Map<string, any>()
      ;(sent || []).forEach((s: any) => {
        if (!partners.has(s.to_id)) partners.set(s.to_id, { ...s.profiles, lastMsg: s.content, lastAt: s.created_at })
        else if (new Date(s.created_at) > new Date(partners.get(s.to_id).lastAt)) {
          partners.get(s.to_id).lastMsg = s.content
          partners.get(s.to_id).lastAt = s.created_at
        }
      })
      ;(received || []).forEach((r: any) => {
        if (!partners.has(r.from_id)) partners.set(r.from_id, { ...r.profiles, lastMsg: r.content, lastAt: r.created_at })
        else if (new Date(r.created_at) > new Date(partners.get(r.from_id).lastAt)) {
          partners.get(r.from_id).lastMsg = r.content
          partners.get(r.from_id).lastAt = r.created_at
        }
      })

      // Sort by most recent
      const sorted = Array.from(partners.entries())
        .map(([id, p]) => ({ id, ...p }))
        .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
      setConversations(sorted)
      setLoading(false)
    }
    load()
  }, [profile])

  // Realtime: update messages when partner reads them
  useEffect(() => {
    if (!profile || !activeConvo) return
    const channelName = `dm-read-${[profile.id, activeConvo.id].sort().join('-')}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'direct_messages',
        filter: `from_id=eq.${profile.id}`
      }, (payload) => {
        if (payload.new.read === true) {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, read: true } : m))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile, activeConvo])

  function timeAgoShort(dateStr: string) {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
    if (mins < 1) return 'now'
    if (mins < 60) return `${mins}m`
    if (mins < 1440) return `${Math.floor(mins / 60)}h`
    if (mins < 10080) return `${Math.floor(mins / 1440)}d`
    return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  async function openConvo(partner: any) {
    setActiveConvo(partner)
    setReactions({})
    setReactionPicker(null)

    const { data } = await supabase.from('direct_messages')
      .select('*, profiles!direct_messages_from_id_fkey(username,avatar_url)')
      .or(`and(from_id.eq.${profile?.id},to_id.eq.${partner.id}),and(from_id.eq.${partner.id},to_id.eq.${profile?.id})`)
      .order('created_at', { ascending: true })
    setMessages((data || []) as any)

    setTimeout(() => {
      const el = document.getElementById('msg-list')
      if (el) el.scrollTop = el.scrollHeight
    }, 50)

    // Mark read and load reactions in parallel — non-blocking so UI doesn't freeze
    supabase.from('direct_messages')
      .update({ read: true })
      .eq('to_id', profile?.id)
      .eq('from_id', partner.id)
      .eq('read', false)
      .then(() => onMarkRead?.(partner.id))

    // Load reactions async — don't await, won't block UI
    if (data && data.length > 0) {
      const ids = data.map((m: any) => m.id)
      Promise.resolve(
        supabase.from('message_reactions')
          .select('*').in('message_id', ids)
      ).then(({ data: rxns }) => {
        if (rxns && rxns.length > 0) {
          const grouped: Record<string, any[]> = {}
          rxns.forEach((r: any) => {
            if (!grouped[r.message_id]) grouped[r.message_id] = []
            grouped[r.message_id].push(r)
          })
          setReactions(grouped)
        }
      }).catch(() => { /* message_reactions table may not exist yet */ })
    }
  }

  async function sendMsg() {
    const trimmed = newMsg.trim()
    if (!trimmed || !activeConvo || !profile || sending) return
    setSending(true)
    const { data, error } = await supabase.from('direct_messages')
      .insert({ from_id: profile.id, to_id: activeConvo.id, content: trimmed })
      .select('*, profiles!direct_messages_from_id_fkey(username,avatar_url)').single()
    if (data) {
      setMessages(prev => [...prev, data as any])
      notifyDM(activeConvo.id, profile.username || 'Someone', trimmed.slice(0, 100), profile.id)
      setTimeout(() => {
        const el = document.getElementById('msg-list')
        if (el) el.scrollTop = el.scrollHeight
      }, 50)
    } else if (error) {
      console.error('DM send error:', error.message)
    }
    setNewMsg('')
    setSending(false)
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!profile) return
    try {
      const existing = reactions[messageId]?.find(r => r.user_id === profile.id && r.emoji === emoji)
      if (existing) {
        await supabase.from('message_reactions').delete().eq('id', existing.id)
        setReactions(prev => ({
          ...prev,
          [messageId]: (prev[messageId] || []).filter(r => r.id !== existing.id)
        }))
      } else {
        const { data } = await supabase.from('message_reactions')
          .insert({ message_id: messageId, user_id: profile.id, emoji })
          .select().single()
        if (data) {
          setReactions(prev => ({
            ...prev,
            [messageId]: [...(prev[messageId] || []), data]
          }))
        }
      }
    } catch {
      // message_reactions table may not exist yet — silent fail
    }
    setReactionPicker(null)
  }

  async function searchUsers(q: string) {
    setSearchUser(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    const { data } = await supabase.from('profiles').select('id,username,avatar_url').ilike('username', `%${q}%`).neq('id', profile?.id).limit(6)
    setSearchResults(data || [])
  }

  // Group reactions by emoji for display
  function groupedReactions(messageId: string) {
    const rxns = reactions[messageId] || []
    const grouped: Record<string, number> = {}
    rxns.forEach(r => { grouped[r.emoji] = (grouped[r.emoji] || 0) + 1 })
    return Object.entries(grouped)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#f8f4ef' }}
      onTouchStart={e => { (e.currentTarget as any)._swipeX = e.touches[0].clientX }}
      onTouchEnd={e => { const dx = e.changedTouches[0].clientX - ((e.currentTarget as any)._swipeX || 0); if (dx > 80) onClose() }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200 bg-white flex-shrink-0" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-2">
          {activeConvo && (
            <button onClick={() => { setActiveConvo(null); setMessages([]); setReactions({}) }} className="text-coffee-500 mr-1">
              <ArrowLeft size={22} />
            </button>
          )}
          {activeConvo ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-coffee-200">
                {activeConvo.avatar_url
                  ? <img src={cachedUrl(activeConvo.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
                  : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white font-bold text-sm">{activeConvo.username?.[0]?.toUpperCase()}</span></div>}
              </div>
              <h3 className="font-display font-bold text-coffee-800 text-base">{activeConvo.username}</h3>
            </div>
          ) : (
            <h3 className="font-display font-bold text-coffee-800 text-lg">Messages</h3>
          )}
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500">
          <X size={15} />
        </button>
      </div>

      {/* Conversation list */}
      {!activeConvo && (
        <>
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center bg-white rounded-2xl px-3 py-2.5 border border-cream-200" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <span className="text-coffee-300 mr-2 text-sm">🔍</span>
              <input value={searchUser} onChange={e => searchUsers(e.target.value)} placeholder="Search people..."
                className="flex-1 bg-transparent text-coffee-700 text-sm placeholder-coffee-300 focus:outline-none" />
            </div>
            {searchResults.map(u => (
              <button key={u.id} onClick={() => { setActiveConvo(u); setSearchUser(''); setSearchResults([]); openConvo(u) }}
                className="w-full flex items-center gap-3 py-2.5 hover:bg-cream-50 rounded-xl px-2 mt-1 transition-colors">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                  {u.avatar_url ? <img src={cachedUrl(u.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
                    : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white text-xs font-bold">{u.username[0].toUpperCase()}</span></div>}
                </div>
                <p className="text-coffee-700 font-medium text-sm">{u.username}</p>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {loading && <div className="flex justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}
            {!loading && conversations.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">☕</p>
                <p className="text-coffee-600 font-display font-bold text-base">No messages yet</p>
                <p className="text-coffee-400 text-sm mt-1">Search a friend above to start chatting</p>
              </div>
            )}
            {conversations.map(c => {
              const hasUnread = (unreadPerSender[c.id] || 0) > 0
              return (
                <button key={c.id} onClick={() => openConvo(c)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors"
                  style={{ borderBottom: '1px solid #f0e8df', background: hasUnread ? 'rgba(232,246,240,0.5)' : 'transparent' }}>
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-coffee-200">
                      {c.avatar_url ? <img src={cachedUrl(c.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
                        : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white font-bold">{c.username?.[0]?.toUpperCase()}</span></div>}
                    </div>
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ fontSize: 9, background: '#3a9e6a' }}>
                        {unreadPerSender[c.id] > 9 ? '9+' : unreadPerSender[c.id]}
                      </span>
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-sm ${hasUnread ? 'text-coffee-900 font-bold' : 'text-coffee-800 font-semibold'}`}>{c.username}</p>
                      {c.lastAt && <p className="text-xs flex-shrink-0 ml-2" style={{ color: hasUnread ? '#3a9e6a' : '#b09070' }}>{timeAgoShort(c.lastAt)}</p>}
                    </div>
                    {c.lastMsg && (
                      <p className={`text-xs truncate ${hasUnread ? 'text-coffee-700 font-medium' : 'text-coffee-400'}`}>
                        {c.lastMsg}
                      </p>
                    )}
                  </div>
                  {hasUnread && <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#3a9e6a' }} />}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Active conversation */}
      {activeConvo && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 min-h-0" id="msg-list"
            onClick={() => setReactionPicker(null)}>
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-10">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-coffee-200 mb-3">
                  {activeConvo.avatar_url
                    ? <img src={cachedUrl(activeConvo.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
                    : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white font-bold text-xl">{activeConvo.username?.[0]?.toUpperCase()}</span></div>}
                </div>
                <p className="text-coffee-700 font-semibold text-sm">{activeConvo.username}</p>
                <p className="text-coffee-400 text-xs mt-1">Say hi! ☕</p>
              </div>
            )}
            {messages.map((msg, i) => {
              const isMe = msg.from_id === profile?.id
              const prevMsg = messages[i - 1]
              const nextMsg = messages[i + 1]
              const showAvatar = !isMe && (!prevMsg || prevMsg.from_id !== msg.from_id)
              const isLastInGroup = !nextMsg || nextMsg.from_id !== msg.from_id
              const showTime = !nextMsg || new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime() > 5 * 60 * 1000
              const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              const isLastSent = isMe && (!nextMsg || !messages.slice(i + 1).some((m: any) => m.from_id === profile?.id))
              const msgReactions = groupedReactions(msg.id)

              return (
                <div key={msg.id} className="relative">
                  <div className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {/* Other user avatar */}
                    {!isMe && (
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0 mb-0.5">
                        {showAvatar
                          ? activeConvo.avatar_url
                            ? <img src={cachedUrl(activeConvo.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
                            : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white font-bold" style={{ fontSize: 11 }}>{activeConvo.username?.[0]?.toUpperCase()}</span></div>
                          : <div className="w-full h-full" />}
                      </div>
                    )}

                    {/* Message bubble */}
                    <div className="flex flex-col">
                      <div
                        className={`max-w-[72vw] px-4 py-2.5 text-sm leading-relaxed cursor-pointer select-none break-words ${
                          isMe
                            ? 'text-white rounded-2xl rounded-br-md'
                            : 'text-coffee-800 rounded-2xl rounded-bl-md'
                        } ${isLastInGroup ? '' : isMe ? 'rounded-br-2xl' : 'rounded-bl-2xl'}`}
                        style={isMe
                          ? { background: '#c8853a', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }
                          : { background: '#ede0cc', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
                        onDoubleClick={() => setReactionPicker(reactionPicker === msg.id ? null : msg.id)}
                      >
                        {msg.content}
                      </div>

                      {/* Reactions display */}
                      {msgReactions.length > 0 && (
                        <div className={`flex gap-1 mt-1 flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {msgReactions.map(([emoji, count]) => (
                            <button key={emoji}
                              onClick={() => toggleReaction(msg.id, emoji)}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-xs"
                              style={{ background: 'white', borderColor: '#e8ddd0' }}>
                              <span>{emoji}</span>
                              {(count as number) > 1 && <span className="text-coffee-500" style={{ fontSize: 10 }}>{count as number}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reaction picker */}
                  {reactionPicker === msg.id && (
                    <div className={`flex gap-1 mt-1 mb-1 ${isMe ? 'justify-end pr-2' : 'justify-start pl-9'}`}>
                      {REACTION_EMOJIS.map(emoji => (
                        <button key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-lg bg-white border border-cream-200"
                          style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Time + delivered/seen */}
                  {(showTime || isLastSent) && (
                    <div className={`flex items-center gap-1 mt-0.5 mb-2 ${isMe ? 'justify-end pr-1' : 'justify-start pl-9'}`}>
                      {showTime && <p className="text-xs text-coffee-300">{time}</p>}
                      {isLastSent && (
                        <p className="text-xs" style={{ color: msg.read ? '#3a9e6a' : '#b09070' }}>
                          {msg.read ? '· Seen' : '· Delivered'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-cream-200 bg-white flex gap-2 items-center flex-shrink-0">
            <textarea
              value={newMsg}
              onChange={e => {
                setNewMsg(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMsg()
                }
              }}
              placeholder="Message..."
              rows={1}
              className="flex-1 rounded-2xl px-4 py-2.5 text-sm text-coffee-800 placeholder-coffee-300 focus:outline-none border border-cream-200 focus:border-caramel transition-colors"
              style={{ background: '#f8f4ef', resize: 'none', minHeight: 40, maxHeight: 120, overflowY: 'auto' }}
            />
            <button
              onClick={sendMsg}
              disabled={!newMsg.trim() || sending}
              className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40 flex-shrink-0 transition-opacity"
              style={{ background: '#c8853a' }}
            >
              <Send size={15} className="text-white" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── COMMENTS ──────────────────────────────────────────────
function CommentsSection({ ratingId, onClose }: { ratingId: string; onClose: () => void }) {
  const { profile } = useAuth()
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    supabase.from('comments').select('*, profiles(username, avatar_url)').eq('rating_id', ratingId).order('created_at', { ascending: true })
      .then(({ data }) => { if (data) setComments(data); setLoading(false) })
  }, [ratingId])

  async function postComment() {
    if (!newComment.trim() || !profile || posting) return
    setPosting(true)
    const content = newComment.trim()
    const { data } = await supabase.from('comments').insert({ user_id: profile.id, rating_id: ratingId, content }).select('*, profiles(username, avatar_url)').single()
    if (data) {
      setComments(prev => [...prev, data])
      // Notify post owner of comment
      const { data: rating } = await supabase.from('ratings').select('user_id').eq('id', ratingId).single()
      if (rating?.user_id && rating.user_id !== profile.id) {
        notifyComment(rating.user_id, profile.username || 'Someone', content, ratingId)
      }
      // Notify @mentions in comment
      const mentioned = content.match(/@(\w+)/g)
      if (mentioned) {
        for (const handle of mentioned) {
          const username = handle.slice(1)
          const { data: mentionedUser } = await supabase.from('profiles').select('id').eq('username', username).single()
          if (mentionedUser?.id && mentionedUser.id !== profile.id) {
            notifyMention(mentionedUser.id, profile.username || 'Someone', content, ratingId)
          }
        }
      }
    }
    setNewComment(''); setPosting(false)
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
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.85)'}}>
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
                {comment.profiles?.avatar_url ? <img src={cachedUrl(comment.profiles.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
                  : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white text-xs font-bold">{comment.profiles?.username?.[0]?.toUpperCase()}</span></div>}
              </div>
              <div className="flex-1">
                {editingId === comment.id ? (
                  <div className="bg-cream-100 rounded-2xl px-3 py-2">
                    <input value={editText} onChange={e => setEditText(e.target.value)} className="w-full bg-transparent text-coffee-800 text-sm focus:outline-none" />
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => editComment(comment.id)} className="text-caramel text-xs font-semibold">Save</button>
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
        <div className="px-4 py-3 border-t border-cream-200 flex gap-2">
          <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && postComment()} placeholder="Add a comment..."
            className="flex-1 bg-cream-100 rounded-full px-4 py-2 text-sm text-coffee-800 placeholder-coffee-300 focus:outline-none border border-cream-200" />
          <button onClick={postComment} disabled={!newComment.trim() || posting} className="bg-caramel text-white rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40">
            {posting ? '...' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  )
}

function WishlistModal({ rating, onClose }: { rating: any; onClose: () => void }) {
  const { profile } = useAuth()
  const shop = rating.coffee_shops as any
  const [drinkName] = useState(rating.drink_name || '')
  const [shopName] = useState(shop?.name || '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  async function save() {
    if (!profile || !drinkName.trim()) return
    setSaving(true)
    await supabase.from('wishlist').insert({ user_id: profile.id, drink_name: drinkName.trim(), shop_name: shopName.trim() || null })
    setDone(true); setTimeout(onClose, 1500); setSaving(false)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.85)'}}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-coffee-800 text-lg">Add to Wishlist</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500"><X size={14} /></button>
        </div>
        {done ? <div className="text-center py-8"><p className="text-3xl mb-2">☕</p><p className="text-coffee-700 font-display text-lg">Added!</p></div> : (
          <>
            <div className="space-y-3 mb-5">
              <div className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200">
                <p className="font-semibold">{drinkName}</p>
              </div>
              {shopName && (
                <div className="w-full bg-cream-50 text-coffee-500 rounded-xl px-4 py-3 text-sm border border-cream-200">
                  <p>@ {shopName}</p>
                </div>
              )}
            </div>
            <button onClick={save} disabled={!drinkName.trim() || saving} className="w-full py-3 rounded-xl bg-caramel text-white font-semibold text-sm disabled:opacity-40">
              {saving ? 'Saving...' : 'Add to Wishlist ☕'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function PostMenu({ isOwn, onDelete, onEdit, onReport, onBlock, onClose }: {
  isOwn: boolean; onDelete: () => any; onEdit: () => void; onReport: () => any; onBlock: () => any; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.7)'}} onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-t-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-cream-200 text-center"><p className="text-coffee-400 text-xs">Post options</p></div>
        {isOwn ? (
          <>
            <button onClick={onEdit} className="w-full flex items-center gap-3 px-5 py-4 text-coffee-700 hover:bg-cream-50 border-b border-cream-100">
              <Edit2 size={18} className="text-caramel" /><span className="font-medium">Edit post</span>
            </button>
            <button onClick={onDelete} className="w-full flex items-center gap-3 px-5 py-4 text-red-500 hover:bg-red-50 border-b border-cream-100">
              <Trash2 size={18} /><span className="font-medium">Delete post</span>
            </button>
          </>
        ) : (
          <>
            <button onClick={onReport} className="w-full flex items-center gap-3 px-5 py-4 text-coffee-700 hover:bg-cream-50 border-b border-cream-100">
              <Flag size={18} className="text-orange-500" /><span className="font-medium">Report post</span>
            </button>
            <button onClick={onBlock} className="w-full flex items-center gap-3 px-5 py-4 text-red-500 hover:bg-red-50 border-b border-cream-100">
              <UserX size={18} /><span className="font-medium">Block user</span>
            </button>
          </>
        )}
        <button onClick={onClose} className="w-full py-4 text-coffee-500 font-medium hover:bg-cream-50">Cancel</button>
      </div>
    </div>
  )
}





// ── SHARE SHEET ───────────────────────────────────────────
function ShareSheet({ rating, onClose, onExternal, onDM }: {
  rating: any
  onClose: () => void
  onExternal: () => void
  onDM: () => void
}) {
  const shop = rating.coffee_shops as any
  const user = rating.profiles as any
  const mugColor = rating.fill_level >= 80 ? '#4e2008' : rating.fill_level >= 60 ? '#7a3e10' : rating.fill_level >= 40 ? '#a06428' : '#c8924a'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.7)'}}
      onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl p-5 animate-slide-up" onClick={e => e.stopPropagation()}>
        {/* Post preview */}
        <div className="flex items-center gap-3 bg-cream-50 rounded-2xl p-3 mb-4 border border-cream-200">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
            {user?.avatar_url
              ? <img src={cachedUrl(user.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
              : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white text-xs font-bold">{user?.username?.[0]?.toUpperCase()}</span></div>}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-coffee-700 font-semibold text-sm">{user?.username}</p>
            <p className="text-coffee-400 text-xs truncate">{shop?.name ?? 'Moment'} · {rating.fill_level}%</p>
          </div>
          <svg viewBox="0 0 56 68" width="32" height="38">
            <defs><clipPath id="ss-mug"><rect x="5" y="12" width="38" height="46" rx="5" /></clipPath></defs>
            <rect x="5" y="12" width="38" height="46" rx="5" fill="#f7f0e4" stroke="#c8b090" strokeWidth="1.5" />
            <g clipPath="url(#ss-mug)">
              <rect x="5" y={58-(46*rating.fill_level/100)} width="38" height={46*rating.fill_level/100} fill={mugColor} />
            </g>
            <rect x="3" y="8" width="42" height="8" rx="4" fill="#d4b890" />
            <path d="M43 22 Q56 22 56 33 Q56 44 43 44" stroke="#c8b090" strokeWidth="5" fill="none" strokeLinecap="round" />
          </svg>
        </div>

        {/* Share options */}
        <div className="space-y-2">
          <button onClick={() => { onDM(); onClose() }}
            className="w-full flex items-center gap-3 bg-cream-50 hover:bg-cream-100 transition-colors rounded-xl px-4 py-3.5 text-left border border-cream-200">
            <span className="text-xl">💬</span>
            <div>
              <p className="text-coffee-800 font-semibold text-sm">Send via Message</p>
              <p className="text-coffee-400 text-xs">Share with someone on Social Brew</p>
            </div>
          </button>
          <button onClick={() => { onExternal(); onClose() }}
            className="w-full flex items-center gap-3 bg-cream-50 hover:bg-cream-100 transition-colors rounded-xl px-4 py-3.5 text-left border border-cream-200">
            <span className="text-xl">🔗</span>
            <div>
              <p className="text-coffee-800 font-semibold text-sm">Share Link</p>
              <p className="text-coffee-400 text-xs">Send to WhatsApp, Instagram, etc.</p>
            </div>
          </button>
        </div>

        <button onClick={onClose} className="w-full mt-3 py-3 text-coffee-500 text-sm font-medium">Cancel</button>
      </div>
    </div>
  )
}

// ── SAVED POSTS PANEL ─────────────────────────────────────
function SavedPostsPanel({ posts, onClose, onPostClick }: { posts: any[]; onClose: () => void; onPostClick: (r: any) => void }) {
  // Uses top-level getMugColor — unified scale
  return (
    <div className="fixed inset-0 z-50 bg-cream-100 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-cream-200 bg-white flex-shrink-0">
        <button onClick={onClose} className="text-coffee-500"><ArrowLeft size={22} /></button>
        <h2 className="font-display text-xl font-bold text-coffee-800 flex-1">Saved Posts</h2>
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        {posts.length === 0 && (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🔖</p>
            <p className="text-coffee-600 font-display text-lg">No saved posts yet</p>
            <p className="text-coffee-400 text-sm mt-1">Tap the bookmark on any post to save it</p>
          </div>
        )}
        <div className="px-4 pt-4 space-y-2">
          {posts.map(r => {
            const user = r.profiles as any
            const shop = r.coffee_shops as any
            const mugColor = getMugColor(r.fill_level)
            return (
              <button key={r.id} onClick={() => onPostClick(r)} className="w-full bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-cream-200 text-left hover:bg-cream-50 transition-colors">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                  {user?.avatar_url
                    ? <img src={cachedUrl(user.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
                    : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white font-bold text-xs">{user?.username?.[0]?.toUpperCase()}</span></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-coffee-700 font-semibold text-sm">{user?.username}</p>
                  <p className="text-coffee-400 text-xs truncate">{shop?.name ?? 'Moment'}{r.drink_name ? ` · ${r.drink_name}` : ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-coffee-700 font-bold text-sm">{r.fill_level}%</p>
                  <div className="w-10 h-1.5 bg-cream-200 rounded-full overflow-hidden mt-1">
                    <div className="h-full rounded-full" style={{ width: `${r.fill_level}%`, background: mugColor }} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}


/**
 * FullscreenCarousel
 * 
 * Full-screen photo viewer with:
 * - Swipe left/right to navigate between multiple photos
 * - Swipe down to dismiss (like Instagram)
 * - Tap X to dismiss
 * - Tap outside photo area to dismiss
 * - Dot indicators showing position
 * - Works correctly on all phones including iOS Safari
 */
function FullscreenCarousel({ photos, initialIndex, onClose }: {
  photos: string[]
  initialIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const [dragX, setDragX] = useState(0)
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const startTime = useRef(0)

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    startTime.current = Date.now()
    setIsDragging(true)
    setDragX(0)
    setDragY(0)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!isDragging) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    setDragX(dx)
    setDragY(dy)
  }

  function onTouchEnd() {
    if (!isDragging) return
    setIsDragging(false)
    const duration = Date.now() - startTime.current
    const isSwipe = duration < 300

    // Swipe down to dismiss — vertical swipe takes priority
    if (dragY > 80 && Math.abs(dragY) > Math.abs(dragX)) {
      onClose()
      return
    }

    // Swipe left/right to navigate
    if (Math.abs(dragX) > 50 && isSwipe) {
      if (dragX < -50 && index < photos.length - 1) {
        setIndex(i => i + 1)
      } else if (dragX > 50 && index > 0) {
        setIndex(i => i - 1)
      }
    }

    setDragX(0)
    setDragY(0)
  }

  // Background opacity reduces as user swipes down (feels natural)
  const bgOpacity = Math.max(0.3, 1 - Math.abs(dragY) / 300)
  const imgTranslateY = dragY > 0 ? dragY : 0

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: `rgba(0,0,0,${bgOpacity})`, touchAction: 'none' }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Photo */}
      <img
        src={cachedUrl(photos[index])}
        alt=""
        style={{
          maxWidth: '100vw',
          maxHeight: '90vh',
          objectFit: 'contain',
          transform: `translateX(${dragX * 0.3}px) translateY(${imgTranslateY}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s ease',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        draggable={false}
      />

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onClose() }}
        style={{
          position: 'absolute',
          top: 'max(16px, env(safe-area-inset-top, 16px))',
          right: 16,
          width: 44,
          height: 44,
          background: 'rgba(0,0,0,0.7)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: 20,
          border: 'none',
          cursor: 'pointer',
          zIndex: 10,
        }}>
        ✕
      </button>

      {/* Left arrow */}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex(i => i - 1) }}
          onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setIndex(i => i - 1) }}
          style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            width: 40, height: 40, background: 'rgba(0,0,0,0.6)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 18, border: 'none', cursor: 'pointer', zIndex: 10,
          }}>‹</button>
      )}

      {/* Right arrow */}
      {index < photos.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIndex(i => i + 1) }}
          onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setIndex(i => i + 1) }}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            width: 40, height: 40, background: 'rgba(0,0,0,0.6)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 18, border: 'none', cursor: 'pointer', zIndex: 10,
          }}>›</button>
      )}

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div style={{
          position: 'absolute',
          bottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
          left: 0, right: 0,
          display: 'flex', justifyContent: 'center', gap: 8,
        }}>
          {photos.map((_, i) => (
            <div key={i} style={{
              width: i === index ? 20 : 8,
              height: 8,
              borderRadius: 4,
              background: i === index ? 'white' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.2s ease',
            }} />
          ))}
        </div>
      )}

      {/* Photo counter */}
      {photos.length > 1 && (
        <div style={{
          position: 'absolute',
          top: 'max(20px, env(safe-area-inset-top, 20px))',
          left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.5)',
          color: 'white', fontSize: 13, fontWeight: 600,
          padding: '4px 12px', borderRadius: 20,
        }}>
          {index + 1} / {photos.length}
        </div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-cream-200 animate-pulse">
      <div className="h-12 flex items-center px-4 gap-3">
        <div className="w-9 h-9 rounded-full bg-cream-200" />
        <div className="flex-1">
          <div className="h-3 w-24 bg-cream-200 rounded mb-1.5" />
          <div className="h-2.5 w-16 bg-cream-200 rounded" />
        </div>
      </div>
      <div className="h-52 bg-cream-200" />
      <div className="p-4 space-y-2">
        <div className="h-3 w-3/4 bg-cream-200 rounded" />
        <div className="h-3 w-1/2 bg-cream-200 rounded" />
      </div>
    </div>
  )
}

export default function HomeTab({ refresh, onLogoTap, unreadPerSender = {}, onMarkRead, onNavigateToBrew, deepLink, onDeepLinkHandled }: {
  refresh: number
  onLogoTap?: () => void
  unreadPerSender?: Record<string, number>
  onMarkRead?: (senderId: string) => void
  onNavigateToBrew?: (shop?: any) => void
  deepLink?: { open: string; id?: string } | null
  onDeepLinkHandled?: () => void
}) {
  const { profile } = useAuth()
  const [ratings, setRatings] = useState<any[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set())
  const [showWrapped, setShowWrapped] = useState(false)
  const [likedByRatingId, setLikedByRatingId] = useState<string | null>(null)
  const [fullscreenPhotos, setFullscreenPhotos] = useState<string[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 20
  const bottomRef = useRef<HTMLDivElement>(null)


  const [shareRating, setShareRating] = useState<any>(null)
  const [fullscreenIndex, setFullscreenIndex] = useState(0)
  const isWrappedSeason = [11, 0].includes(new Date().getMonth())
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeComments, setActiveComments] = useState<string | null>(null)
  const [selectedShop, setSelectedShop] = useState<any>(null)
  const [activeMenu, setActiveMenu] = useState<any>(null)
  const [wishlistRating, setWishlistRating] = useState<any>(null)
  const [editingPost, setEditingPost] = useState<any>(null)
  const [editCaption, setEditCaption] = useState('') // legacy — kept for comment editing
  const [showMessages, setShowMessages] = useState(false)
  const [showNewInbox, setShowNewInbox] = useState(false)
  const unreadDMs = Object.values(unreadPerSender).reduce((a, b) => a + b, 0)
  const [activeUserProfile, setActiveUserProfile] = useState<string | null>(null)
  const [activePost, setActivePost] = useState<any>(null)
  const [showSaved, setShowSaved] = useState(false)
  const [savedPosts, setSavedPostsList] = useState<any[]>([])
  const [sharingPost, setSharingPost] = useState<any>(null)
  const [reactions, setReactions] = useState<Record<string, Record<string, boolean>>>({})
  const [reactionCounts, setReactionCounts] = useState<Record<string, Record<string, number>>>({})
  const [showReactions, setShowReactions] = useState<string | null>(null)
  const [feedTab, setFeedTab] = useState<'people' | 'shops'>('people')
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([])
  const [followedSuggestions, setFollowedSuggestions] = useState<Set<string>>(new Set())

  const loadFeed = useCallback(async (reset = true) => {
    if (reset) setLoading(true)
    else setLoadingMore(true)
    
    const currentPage = reset ? 0 : page
    const from = currentPage * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data } = await supabase
      .from('ratings')
      .select('*, profiles!ratings_user_id_fkey(id, username, avatar_url, badge), coffee_shops(id, name, city, state, country, photo_url, avg_rating, is_verified, lat, lng)')
      .order('visited_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false })
      .range(from, to)

    if (data) {
      if (reset) {
        setRatings(data)
        setPage(1)
      } else {
        setRatings(prev => {
          const ids = new Set(prev.map((r: any) => r.id))
          return [...prev, ...data.filter((r: any) => !ids.has(r.id))]
        })
        setPage(p => p + 1)
      }
      if (data.length < PAGE_SIZE) setHasMore(false)
      else setHasMore(true)

      // Load reaction counts for new batch
      if (data.length > 0) {
        const ratingIds = data.map((r: any) => r.id)
        const { data: rxData } = await supabase.from('reactions').select('rating_id, type, user_id').in('rating_id', ratingIds)
        if (rxData) {
          const counts: Record<string, Record<string, number>> = {}
          rxData.forEach((rx: any) => {
            if (!counts[rx.rating_id]) counts[rx.rating_id] = {}
            counts[rx.rating_id][rx.type] = (counts[rx.rating_id][rx.type] || 0) + 1
          })
          setReactionCounts(prev => ({ ...prev, ...counts }))
        }
      }
    }
    
    if (reset) setLoading(false)
    else setLoadingMore(false)
  }, [page, PAGE_SIZE])

  // Deep link handler — triggered by notification taps
  useEffect(() => {
    if (!deepLink) return
    if (deepLink.open === 'post' && deepLink.id) {
      supabase.from('ratings')
        .select('*, profiles!ratings_user_id_fkey(id, username, avatar_url, badge), coffee_shops(id, name, city, state, country, photo_url, avg_rating, is_verified)')
        .eq('id', deepLink.id).single()
        .then(({ data }) => { if (data) setActivePost(data) })
    } else if (deepLink.open === 'profile' && deepLink.id) {
      setActiveUserProfile(deepLink.id)
    } else if (deepLink.open === 'messages') {
      setShowMessages(true)
    }
    onDeepLinkHandled?.()
  }, [deepLink])

  // Infinite scroll — placed after loadFeed declaration
  useEffect(() => {
    if (!bottomRef.current) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setLoadingMore(true)
          loadFeed(false).finally(() => setLoadingMore(false))
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(bottomRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading, loadFeed])

  useEffect(() => {
    loadFeed()
    if (profile) {
      supabase.from('likes').select('rating_id').eq('user_id', profile.id).then(({ data }) => { if (data) setLikedIds(new Set(data.map((l: any) => l.rating_id))) })
      supabase.from('saved_posts').select('rating_id').eq('user_id', profile.id).then(({ data }) => { if (data) setSavedIds(new Set(data.map((s: any) => s.rating_id))) })
      supabase.from('blocks').select('blocked_id').eq('blocker_id', profile.id).then(({ data }) => { if (data) setBlockedUsers(new Set(data.map((b: any) => b.blocked_id))) })
      // Load friend suggestions: people not yet followed
      supabase.from('follows').select('following_id').eq('follower_id', profile.id)
        .then(async ({ data: followed }) => {
          const followedIds = new Set(followed?.map((f: any) => f.following_id) || [])
          const { data: profiles } = await supabase.from('profiles')
            .select('id, username, full_name, avatar_url, badge')
            .neq('id', profile.id)
            .limit(30)
          const suggestions = (profiles || []).filter(p => !followedIds.has(p.id)).slice(0, 8)
          setSuggestedUsers(suggestions)
        })
    }

    // Realtime: new posts, likes, comments update automatically
    const channel = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ratings' }, async (payload) => {
        // Fetch the new rating with full joins so manual shops appear immediately
        const { data: newRating } = await supabase
          .from('ratings')
          .select('*, profiles!ratings_user_id_fkey(id, username, avatar_url, badge), coffee_shops(id, name, city, state, country, photo_url, avg_rating, is_verified)')
          .eq('id', payload.new.id)
          .single()
        if (newRating) {
          setRatings(prev => {
            // Avoid duplicate if already in feed
            if (prev.some(r => r.id === newRating.id)) return prev
            return [newRating, ...prev].slice(0, 30)
          })
        } else {
          // Fallback: full reload if join failed (e.g. very new shop not indexed yet)
          setTimeout(() => loadFeed(), 800)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ratings' }, (payload) => {
        // Surgically update counts and other fields without full reload
        setRatings(prev => prev.map(r => r.id === payload.new.id
          ? { ...r, likes_count: payload.new.likes_count, comments_count: payload.new.comments_count }
          : r))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'ratings' }, (payload) => {
        setRatings(prev => prev.filter(r => r.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, (payload) => {
        // Immediately update like count in local state
        setRatings(prev => prev.map(r => r.id === payload.new.rating_id
          ? { ...r, likes_count: (r.likes_count || 0) + 1 }
          : r))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'likes' }, (payload) => {
        setRatings(prev => prev.map(r => r.id === payload.old.rating_id
          ? { ...r, likes_count: Math.max(0, (r.likes_count || 0) - 1) }
          : r))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload) => {
        // Immediately update comment count in local state
        setRatings(prev => prev.map(r => r.id === payload.new.rating_id
          ? { ...r, comments_count: (r.comments_count || 0) + 1 }
          : r))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments' }, (payload) => {
        setRatings(prev => prev.map(r => r.id === payload.old.rating_id
          ? { ...r, comments_count: Math.max(0, (r.comments_count || 0) - 1) }
          : r))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [refresh, profile])

  async function toggleLike(ratingId: string) {
    if (!profile) return
    if (likedIds.has(ratingId)) {
      await supabase.from('likes').delete().eq('user_id', profile.id).eq('rating_id', ratingId)
      setLikedIds(prev => { const n = new Set(prev); n.delete(ratingId); return n })
      setRatings(prev => prev.map(r => r.id === ratingId ? { ...r, likes_count: Math.max(0, r.likes_count - 1) } : r))
    } else {
      await supabase.from('likes').insert({ user_id: profile.id, rating_id: ratingId })
      setLikedIds(prev => new Set([...prev, ratingId]))
      setRatings(prev => prev.map(r => r.id === ratingId ? { ...r, likes_count: r.likes_count + 1 } : r))
      trackEvent('post_liked')
      // Notify post owner
      const rating = ratings.find(r => r.id === ratingId)
      if (rating?.profiles?.id && rating.profiles.id !== profile.id) {
        notifyLike(rating.profiles.id, profile.username || 'Someone', ratingId)
      }
    }
  }

  async function toggleSave(ratingId: string) {
    if (!profile) return
    if (savedIds.has(ratingId)) {
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
    if (!editingPost || !profile) return
    const trimmed = editCaption.trim()
    const { error } = await supabase
      .from('ratings')
      .update({ caption: trimmed })
      .eq('id', editingPost.id)
      .eq('user_id', profile.id)
    if (error) {
      console.error('Edit failed:', error)
      alert('Could not save — please try again.')
      return
    }
    setRatings(prev => prev.map(r => r.id === editingPost.id ? { ...r, caption: trimmed } : r))
    setEditingPost(null)
  }

  async function reportPost(rating: any) {
    if (!profile) return
    await supabase.from('reports').insert({ reporter_id: profile.id, rating_id: rating.id, reason: 'user_reported' })
    setActiveMenu(null)
    alert('Post reported. Thank you!')
  }

  async function blockUser(userId: string) {
    if (!profile) return
    await supabase.from('blocks').insert({ blocker_id: profile.id, blocked_id: userId })
    setBlockedUsers(prev => new Set([...prev, userId]))
    setRatings(prev => prev.filter(r => r.profiles?.id !== userId))
    setActiveMenu(null)
  }

  async function loadSavedPosts() {
    if (!profile) return
    setShowSaved(true)
    const { data } = await supabase
      .from('saved_posts')
      .select('rating_id, ratings(*, profiles!ratings_user_id_fkey(id, username, avatar_url, badge), coffee_shops(id, name, city, state, country, photo_url, avg_rating))')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    if (data) setSavedPostsList(data.map((s: any) => s.ratings).filter(Boolean))
  }

  async function toggleReaction(ratingId: string, type: string) {
    if (!profile) return
    const hasIt = reactions[ratingId]?.[type]
    if (hasIt) {
      await supabase.from('reactions').delete().eq('user_id', profile.id).eq('rating_id', ratingId).eq('type', type)
      setReactions(prev => ({ ...prev, [ratingId]: { ...prev[ratingId], [type]: false } }))
      setReactionCounts(prev => ({ ...prev, [ratingId]: { ...prev[ratingId], [type]: Math.max(0, (prev[ratingId]?.[type] || 1) - 1) } }))
    } else {
      await supabase.from('reactions').insert({ user_id: profile.id, rating_id: ratingId, type })
      setReactions(prev => ({ ...prev, [ratingId]: { ...prev[ratingId], [type]: true } }))
      setReactionCounts(prev => ({ ...prev, [ratingId]: { ...prev[ratingId], [type]: (prev[ratingId]?.[type] || 0) + 1 } }))
    }
    setShowReactions(null)
  }


  async function shareExternal(rating: any) {
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
  }

  // Load unread notification count for logo badge
  useEffect(() => {
    if (!profile) return
    supabase.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('read', false)
      .then(({ count }) => setUnreadNotifs(count || 0))
    // Piggyback on existing feed-realtime channel instead of new subscription
  }, [profile])

  const visibleRatings = ratings.filter(r => !blockedUsers.has(r.profiles?.id))

  return (
    <div className="min-h-screen bg-cream-100">
      <div className="sticky top-0 z-10 bg-cream-100 border-b border-cream-200 px-5 py-4 flex items-center justify-between">
        <div className="relative inline-flex items-center" onClick={onLogoTap} style={{ userSelect: 'none', cursor: 'pointer' }}>
          <h1 className="font-display text-2xl font-bold text-coffee-800">Social Brew</h1>
          {unreadNotifs > 0 && (
            <span className="absolute -top-1.5 -right-5 min-w-[18px] h-[18px] rounded-full bg-red-500 flex items-center justify-center px-1"
              style={{ fontSize: 10, fontWeight: 700, color: 'white' }}>
              {unreadNotifs > 99 ? '99+' : unreadNotifs}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowNewInbox(true)} className="relative w-9 h-9 flex items-center justify-center text-coffee-500 hover:text-caramel transition-colors">
            <MessageCircle size={22} />
            {unreadDMs > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                <span className="text-white font-bold" style={{ fontSize: 9 }}>{unreadDMs > 9 ? '9+' : unreadDMs}</span>
              </span>
            )}
          </button>
          <NotificationBell
            onOpen={() => setUnreadNotifs(0)}
            onNavigate={async (type, id) => {
            if (type === 'profile') {
              setActiveUserProfile(id)
            } else if (type === 'post') {
              // Load the rating and open PostDetailModal
              const { data } = await supabase
                .from('ratings')
                .select('*, profiles!ratings_user_id_fkey(id, username, avatar_url, badge), coffee_shops(id, name, city, state, country, photo_url, avg_rating, is_verified)')
                .eq('id', id)
                .single()
              if (data) setActivePost(data)
            }
          }} />
          <button onClick={() => loadSavedPosts()} className="w-9 h-9 flex items-center justify-center text-coffee-500 hover:text-caramel transition-colors">
            <Bookmark size={22} />
          </button>
        </div>
      </div>

      <div className="pb-24">
        {loading && (
          <div className="p-4 space-y-4">
            {[1,2,3].map(i => <SkeletonCard key={i} />)}
          </div>
        )}
        {feedTab === 'people' && !loading && visibleRatings.length === 0 && (
          <div className="text-center py-20 px-8">
            <div className="text-6xl mb-4">☕</div>
            <p className="text-coffee-700 font-display text-xl">No brews yet</p>
            <p className="text-coffee-400 text-sm mt-2">Be the first to rate a visit!</p>
          </div>
        )}

        {/* Stories */}
        <StoriesBar />
        {/* People / Shops feed switcher */}
        <div className="flex gap-2 px-4 pt-3 pb-1">
          <button
            onClick={() => setFeedTab('people')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${feedTab === 'people' ? 'bg-coffee-700 text-white shadow-sm' : 'bg-white text-coffee-600 border border-cream-200'}`}
          >
            👥 People
          </button>
          <button
            onClick={() => setFeedTab('shops')}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${feedTab === 'shops' ? 'bg-coffee-700 text-white shadow-sm' : 'bg-white text-coffee-600 border border-cream-200'}`}
          >
            ☕ Shops
          </button>
        </div>
        {feedTab === 'shops' && <ShopsFeed profileId={profile?.id || null} />}
        {feedTab === 'people' && (<>
        {/* Wrapped Season Banner */}
        {isWrappedSeason && (
          <button
            onClick={() => setShowWrapped(true)}
            className="mx-4 mt-3 mb-1 flex items-center gap-3 px-4 py-3 rounded-2xl text-left w-[calc(100%-2rem)]"
            style={{ background: 'linear-gradient(135deg, #1a0a02, #3d1a06)', border: '1px solid rgba(200,133,58,0.35)' }}
          >
            <span className="text-2xl">✨</span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Your {new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear()} Brew Wrapped is here</p>
              <p className="text-white/50 text-xs">See your year in coffee →</p>
            </div>
          </button>
        )}
        {/* Friend suggestions strip */}
        {!loading && suggestedUsers.length > 0 && (
          <div className="mx-4 mt-3 mb-1 bg-white rounded-2xl border border-cream-200 shadow-sm overflow-hidden">
            <p className="px-4 pt-3 pb-1 text-coffee-700 font-semibold text-sm">People you might know</p>
            <div className="flex gap-4 overflow-x-auto px-4 pb-3 pt-1 scrollbar-hide">
              {suggestedUsers.map(u => {
                const isFollowing = followedSuggestions.has(u.id)
                return (
                  <div key={u.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 w-20">
                    <button onClick={() => setActiveUserProfile(u.id)} className="w-14 h-14 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                      {u.avatar_url
                        ? <img src={u.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500">
                            <span className="text-white font-bold">{u.username?.[0]?.toUpperCase()}</span>
                          </div>}
                    </button>
                    <p className="text-coffee-700 text-xs font-medium text-center truncate w-full">@{u.username}</p>
                    {u.badge && <p className="text-caramel text-center truncate w-full" style={{ fontSize: 10 }}>{u.badge}</p>}
                    <button
                      onClick={async () => {
                        if (!profile || isFollowing) return
                        await supabase.from('follows').insert({ follower_id: profile.id, following_id: u.id })
                        await supabase.from('notifications').insert({ user_id: u.id, actor_id: profile.id, type: 'follow' })
                        notifyFollow(u.id, profile.username || 'Someone')
                        setFollowedSuggestions(prev => new Set([...prev, u.id]))
                      }}
                      className="text-xs px-2.5 py-1 rounded-full font-semibold transition-all active:scale-95"
                      style={isFollowing
                        ? { background: '#f0e8df', color: '#9b7a55' }
                        : { background: 'linear-gradient(135deg, #c8853a, #9b5e1a)', color: '#fff' }
                      }
                    >
                      {isFollowing ? '✓ Following' : 'Follow'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {visibleRatings.map(rating => {
          const shop = rating.coffee_shops as any
          const user = rating.profiles as any
          const isLiked = likedIds.has(rating.id)
          const isSaved = savedIds.has(rating.id)
          const isOwn = user?.id === profile?.id
          const mugColor = getMugColor(rating.fill_level)
          const isQuickSip = rating.is_quick_sip === true
          const isVibePost = rating.fill_level === 0 && !rating.is_quick_sip
          const visitTime = rating.visit_time

          if (isVibePost) {
            return (
              <div key={rating.id} className="bg-white mx-4 mb-2 rounded-2xl shadow-sm border border-cream-200 overflow-hidden animate-fade-in">
                {/* Header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => user?.id && setActiveUserProfile(user.id)} className="w-8 h-8 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                    {user?.avatar_url ? <img src={cachedUrl(user.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
                      : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500"><span className="text-white font-bold text-xs">{user?.username?.[0]?.toUpperCase()}</span></div>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button onClick={() => user?.id && setActiveUserProfile(user.id)} className="text-coffee-700 font-semibold text-sm hover:text-caramel transition-colors">{user?.username}</button>
                      <span className="text-coffee-400 text-xs">posted a vibe</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#f5e6d0', color: '#c8853a' }}>✨ Vibe Check</span>
                      <span className="text-coffee-300 text-xs">·</span>
                      <span className="text-coffee-400 text-xs">
                        {rating.visited_at && rating.visited_at !== rating.created_at?.split('T')[0]
                          ? `Visited ${new Date(rating.visited_at + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · posted ${timeAgo(rating.created_at)}`
                          : timeAgo(rating.created_at)
                        }
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setActiveMenu({ ...rating, _isOwn: isOwn })} className="text-coffee-300 p-1 flex-shrink-0"><MoreHorizontal size={15} /></button>
                </div>
                {/* Photo */}
                {/* Photo(s) — tap to fullscreen */}
                {(rating.photo_urls?.length > 0 || rating.photo_url) && (() => {
                  const urls = (rating.photo_urls?.length > 0 ? rating.photo_urls : [rating.photo_url]).filter(Boolean)
                  return (
                    <div className={urls.length > 1 ? 'grid gap-0.5' : ''} style={{
                      gridTemplateColumns: urls.length === 2 ? '1fr 1fr' : urls.length === 3 ? '1fr 1fr' : urls.length === 4 ? '1fr 1fr' : '1fr',
                      gridTemplateRows: urls.length === 3 ? 'auto auto' : urls.length === 4 ? '1fr 1fr' : 'auto',
                    }}>
                      {urls.map((url: string, i: number) => (
                        <button key={i}
                          onClick={() => { setFullscreenPhotos(urls); setFullscreenIndex(i) }}
                          className="w-full overflow-hidden"
                          style={{ gridColumn: urls.length === 3 && i === 0 ? '1 / -1' : 'auto' }}>
                          <img src={cachedUrl(url)} alt="" loading="lazy" decoding="async"
                            className="w-full object-cover"
                            style={{ height: urls.length === 1 ? 320 : urls.length === 3 && i === 0 ? 200 : 160 }} />
                        </button>
                      ))}
                    </div>
                  )
                })()}
                {/* Caption */}
                {rating.caption && (
                  <div className="px-4 py-3">
                    <p className="text-coffee-700 text-sm leading-relaxed">{rating.caption}</p>
                  </div>
                )}
                {/* Vibe tags */}
                {rating.vibe_tags && rating.vibe_tags.length > 0 && (
                  <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                    {rating.vibe_tags.map((v: string) => (
                      <span key={v} className="text-xs px-2 py-0.5 rounded-full bg-cream-100 text-coffee-500 border border-cream-200">{v}</span>
                    ))}
                  </div>
                )}
                {/* Actions */}
                <div className="flex items-center px-4 pb-3 gap-3 border-t border-cream-50 pt-2">
                  <button onClick={() => toggleLike(rating.id)} className="flex items-center gap-1 active:scale-90" style={{ color: isLiked ? '#e05a5a' : '#9b7a45' }}>
                    <Heart size={16} fill={isLiked ? '#e05a5a' : 'none'} />
                    <button onClick={() => (rating.likes_count || 0) > 0 ? setLikedByRatingId(rating.id) : null} className="text-xs hover:text-caramel transition-colors">{rating.likes_count || 0}</button>
                  </button>
                  <button onClick={() => setActivePost(rating)} className="flex items-center gap-1 text-coffee-400 active:scale-90">
                    <MessageCircle size={16} />
                    <span className="text-xs">{rating.comments_count || 0}</span>
                  </button>
                  <button onClick={() => toggleSave(rating.id)} className="flex items-center gap-1 text-coffee-400 active:scale-90 ml-auto">
                    <Bookmark size={16} fill={isSaved ? '#9b7a45' : 'none'} />
                  </button>
                </div>
              </div>
            )
          }

          if (isQuickSip) {
            return (
              <div key={rating.id} className="bg-white mx-4 mb-2 rounded-2xl shadow-sm border border-cream-200 overflow-hidden animate-fade-in">
                <div className="flex items-start gap-3 px-4 py-3">
                  <button onClick={() => user?.id && setActiveUserProfile(user.id)} className="w-8 h-8 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                    {user?.avatar_url ? <img src={cachedUrl(user.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
                      : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500"><span className="text-white font-bold text-xs">{user?.username?.[0]?.toUpperCase()}</span></div>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button onClick={() => user?.id && setActiveUserProfile(user.id)} className="text-coffee-700 font-semibold text-sm hover:text-caramel transition-colors">{user?.username}</button>
                      {rating.is_first_rating && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200 font-medium flex items-center gap-0.5">
                          ⭐ First Brew
                        </span>
                      )}
                      <span className="text-coffee-400 text-xs">had a quick sip</span>
                      {shop && <button onClick={() => setSelectedShop(shop)} className="text-caramel text-xs font-semibold hover:underline">@ {shop.name}</button>}
                    </div>
                    {/* Drink name + price pills for QuickSip */}
                    {(rating.drink_name || (rating.show_price !== false && (rating.drink_price || rating.price_perception))) && (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {rating.drink_name && (
                          <span className="bg-cream-100 text-coffee-700 px-2 py-0.5 rounded-full text-xs font-medium border border-cream-200">{rating.drink_name}</span>
                        )}
                        <PricePills price={rating.drink_price} perception={rating.price_perception} showPrice={rating.show_price} />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <svg viewBox="0 0 56 68" width="28" height="34" className="flex-shrink-0">
                        <defs><clipPath id={`qs-${rating.id}`}><rect x="5" y="12" width="38" height="46" rx="5" /></clipPath></defs>
                        <rect x="5" y="12" width="38" height="46" rx="5" fill="#f7f0e4" stroke="#c8b090" strokeWidth="1.5" />
                        <g clipPath={`url(#qs-${rating.id})`}>
                          <rect x="5" y={58-(46*rating.fill_level/100)} width="38" height={46*rating.fill_level/100} fill={mugColor} />
                        </g>
                        <rect x="3" y="8" width="42" height="8" rx="4" fill="#d4b890" />
                        <path d="M43 22 Q56 22 56 33 Q56 44 43 44" stroke="#c8b090" strokeWidth="5" fill="none" strokeLinecap="round" />
                      </svg>
                      <span className="text-coffee-500 font-semibold text-xs">{rating.fill_level}%</span>
                      <span className="text-coffee-300 text-xs">·</span>
                      <span className="text-coffee-400 text-xs">
                        {rating.visited_at && rating.visited_at !== rating.created_at?.split('T')[0]
                          ? `Visited ${new Date(rating.visited_at + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · posted ${timeAgo(rating.created_at)}`
                          : timeAgo(rating.created_at)
                        }
                      </span>
                      <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-400">⚡ Quick Sip</span>
                    </div>
                  </div>
                  <button onClick={() => setActiveMenu({ ...rating, _isOwn: isOwn })} className="text-coffee-300 p-1 flex-shrink-0"><MoreHorizontal size={15} /></button>
                </div>
                <div className="flex items-center px-4 pb-3 gap-3 border-t border-cream-50">
                  <button onClick={() => toggleLike(rating.id)} className="flex items-center gap-1 mt-2 active:scale-90" style={{ color: isLiked ? '#e05a5a' : '#9b7a45' }}>
                    <Heart size={16} fill={isLiked ? '#e05a5a' : 'none'} />
                    <button onClick={() => (rating.likes_count || 0) > 0 ? setLikedByRatingId(rating.id) : null} className="text-xs hover:text-caramel transition-colors">{rating.likes_count || 0}</button>
                  </button>
                  <button onClick={() => setActivePost(rating)} className="flex items-center gap-1 text-coffee-400 mt-2 active:scale-90">
                    <MessageCircle size={16} />
                    <span className="text-xs">{rating.comments_count || 0}</span>
                  </button>
                  <button onClick={() => setWishlistRating(rating)} className="flex items-center gap-1 text-coffee-400 mt-2 active:scale-90">
                    <Plus size={16} /><span className="text-xs">Wishlist</span>
                  </button>
                  <button onClick={() => toggleSave(rating.id)} className="ml-auto mt-2 active:scale-90" style={{ color: isSaved ? '#c8853a' : '#9b7a45' }}>
                    <Bookmark size={16} fill={isSaved ? '#c8853a' : 'none'} />
                  </button>
                  <p className="text-coffee-300 text-xs mt-2">{formatDate(rating.created_at)}</p>
                </div>
                {/* Comment count tap-to-view */}
                {rating.comments_count > 0 && (
                  <div className="px-4 pb-3 border-t border-cream-50 pt-2">
                    <button onClick={() => setActivePost(rating)} className="text-coffee-400 text-xs">
                      View {rating.comments_count} comment{rating.comments_count !== 1 ? 's' : ''} →
                    </button>
                  </div>
                )}
              </div>
            )
          }

          return (
            <div key={rating.id} className="bg-white mx-4 mb-3 rounded-2xl shadow-sm border border-cream-200 overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-start gap-3">
                  <button onClick={() => user?.id && setActiveUserProfile(user.id)} className="w-9 h-9 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                    {user?.avatar_url ? <img src={cachedUrl(user.avatar_url)} alt="" loading="lazy" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />
                      : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-caramel to-coffee-500"><span className="text-white font-bold text-sm">{user?.username?.[0]?.toUpperCase()}</span></div>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button onClick={() => user?.id && setActiveUserProfile(user.id)} className="text-coffee-800 font-semibold text-sm hover:text-caramel transition-colors">{user?.username}</button>
                      {rating.is_first_rating && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200 font-medium flex items-center gap-0.5">
                          ⭐ First Brew
                        </span>
                      )}
                      {visitTime && (
                        <span className="text-coffee-400 text-xs bg-cream-100 px-1.5 py-0.5 rounded-full border border-cream-200">
                          🕐 {visitTime}
                        </span>
                      )}
                    </div>
                    <p className="text-coffee-400 text-xs">{timeAgo(rating.created_at)}</p>
                  </div>
                </div>
                <button onClick={() => setActiveMenu({ ...rating, _isOwn: isOwn })} className="text-coffee-400 p-1"><MoreHorizontal size={18} /></button>
              </div>

              <button onClick={() => setActivePost(rating)} className="w-full text-left">
              <div className="px-4 py-2">
                {(rating.drink_name || (rating.show_price !== false && (rating.drink_price || rating.price_perception))) && (
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {rating.drink_name && (
                      <>
                        <span className="text-coffee-500 text-sm">ordered</span>
                        <span className="bg-cream-100 text-coffee-700 px-2.5 py-0.5 rounded-full text-sm font-medium border border-cream-200">{rating.drink_name}</span>
                      </>
                    )}
                    <PricePills price={rating.drink_price} perception={rating.price_perception} showPrice={rating.show_price} />
                  </div>
                )}
                <div className="flex items-center gap-3 my-3">
                  <div className="w-12 h-14 flex-shrink-0">
                    <svg viewBox="0 0 56 68" width="48" height="56">
                      <defs><clipPath id={`c-${rating.id}`}><rect x="5" y="12" width="38" height="46" rx="5" /></clipPath></defs>
                      <rect x="5" y="12" width="38" height="46" rx="5" fill="#f7f0e4" stroke="#c8b090" strokeWidth="1.5" />
                      <g clipPath={`url(#c-${rating.id})`}>
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
                {(rating.photo_urls?.length > 0 || rating.photo_url) && (() => {
                  const urls = (rating.photo_urls?.length > 0 ? rating.photo_urls : [rating.photo_url]).filter(Boolean)
                  return (
                    <div className={`${urls.length > 1 ? 'grid gap-0.5' : ''} mb-2`} style={{
                      gridTemplateColumns: urls.length >= 2 ? '1fr 1fr' : '1fr',
                      gridTemplateRows: urls.length === 3 ? 'auto auto' : urls.length === 4 ? '1fr 1fr' : 'auto',
                    }}>
                      {urls.map((url: string, i: number) => (
                        <button key={i}
                          onClick={() => { setFullscreenPhotos(urls); setFullscreenIndex(i) }}
                          className="w-full overflow-hidden rounded-sm"
                          style={{ gridColumn: urls.length === 3 && i === 0 ? '1 / -1' : 'auto' }}>
                          <img loading="lazy" decoding="async" src={cachedUrl(url)} alt=""
                            className="w-full object-cover"
                            style={{ height: urls.length === 1 ? 208 : urls.length === 3 && i === 0 ? 160 : 120, transform: 'translateZ(0)' }} />
                        </button>
                      ))}
                    </div>
                  )
                })()}
                {(rating.vibe_tags as any)?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(rating.vibe_tags as any).map((tag: string) => (
                      <span key={tag} className="bg-cream-100 text-coffee-500 px-2 py-0.5 rounded-full text-xs border border-cream-200">{tag}</span>
                    ))}
                  </div>
                )}
                {editingPost?.id === rating.id ? (
                  <div className="mb-2">
                    <textarea value={editCaption} onChange={e => setEditCaption(e.target.value)} rows={2}
                      className="w-full bg-cream-50 text-coffee-800 rounded-xl px-3 py-2 text-sm border border-cream-200 focus:border-caramel focus:outline-none resize-none" />
                    <div className="flex gap-2 mt-1">
                      <button onClick={saveEditPost} className="text-caramel text-xs font-semibold flex items-center gap-1"><Check size={12} /> Save</button>
                      <button onClick={() => setEditingPost(null)} className="text-coffee-400 text-xs">Cancel</button>
                    </div>
                  </div>
                ) : rating.caption && <p className="text-coffee-700 text-sm mb-2">{rating.caption.split('🕐')[0].replace(/\s*·\s*$/, '').trim() || null}</p>}
              </div>
              </button>

              {shop && (
                <button onClick={() => setSelectedShop(shop)} className="mx-4 mb-3 w-[calc(100%-2rem)] flex items-center gap-3 bg-cream-50 rounded-xl p-2.5 border border-cream-200 text-left hover:bg-cream-100 transition-colors overflow-hidden">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-coffee-200 flex-shrink-0">
                    {shop.photo_url && <img loading="lazy" decoding="async" src={cachedUrl(shop.photo_url)} alt="" className="w-full h-full object-cover" style={{ transform: 'translateZ(0)' }} />}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className="text-coffee-700 font-semibold text-sm truncate">{shop.name}</p>
                    <p className="text-coffee-400 text-xs truncate">{formatLocation(shop.city, shop.state, shop.country) || shop.address || ""}</p>
                  </div>
                  <span className="text-caramel text-xs font-semibold flex-shrink-0 ml-1">View</span>
                </button>
              )}

              <div className="flex items-center px-4 pb-2 gap-4">
                <button onClick={() => toggleLike(rating.id)} className="flex items-center gap-1.5 active:scale-90" style={{ color: isLiked ? '#e05a5a' : '#9b7a45' }}>
                  <Heart size={20} fill={isLiked ? '#e05a5a' : 'none'} />
                  <span className="text-sm font-medium">{rating.likes_count || 0}</span>
                </button>
                <button onClick={() => setActivePost(rating)} className="flex items-center gap-1.5 text-coffee-500 active:scale-90">
                  <MessageCircle size={20} />
                  <span className="text-sm">{rating.comments_count || 0}</span>
                </button>
                {/* Reactions */}
                <div className="relative">
                  <button onClick={() => setShowReactions(showReactions === rating.id ? null : rating.id)}
                    className="flex items-center gap-1 active:scale-90 text-coffee-400">
                    <span className="text-base leading-none">
                      {reactions[rating.id]?.same ? '☕' : reactions[rating.id]?.fire ? '🔥' : reactions[rating.id]?.need_to_try ? '😮' : '☕'}
                    </span>
                    {Object.values(reactionCounts[rating.id] || {}).reduce((a, b) => a + b, 0) > 0 && (
                      <span className="text-xs text-coffee-400">{Object.values(reactionCounts[rating.id] || {}).reduce((a, b) => a + b, 0)}</span>
                    )}
                  </button>
                  {showReactions === rating.id && (
                    <div className="absolute bottom-8 left-0 bg-white rounded-2xl shadow-xl border border-cream-200 p-2 flex gap-2 z-20 animate-fade-in">
                      {[
                        { type: 'same', emoji: '☕', label: 'Same' },
                        { type: 'fire', emoji: '🔥', label: 'Fire' },
                        { type: 'need_to_try', emoji: '😮', label: 'Need to try' },
                      ].map(rx => (
                        <button key={rx.type} onClick={() => toggleReaction(rating.id, rx.type)}
                          className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all active:scale-90 ${reactions[rating.id]?.[rx.type] ? 'bg-cream-100' : 'hover:bg-cream-50'}`}>
                          <span className="text-xl">{rx.emoji}</span>
                          <span className="text-xs text-coffee-400">{reactionCounts[rating.id]?.[rx.type] || 0}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setWishlistRating(rating)} className="flex items-center gap-1.5 text-coffee-400 active:scale-90">
                  <Plus size={18} /><span className="text-xs">Wishlist</span>
                </button>
                <button className="flex items-center gap-1.5 text-coffee-200 cursor-default ml-auto">
                  <Gift size={18} /><span className="text-xs">Gift</span>
                </button>
                <button onClick={() => toggleSave(rating.id)} className="active:scale-90" style={{ color: isSaved ? '#c8853a' : '#9b7a45' }}>
                  <Bookmark size={18} fill={isSaved ? '#c8853a' : 'none'} />
                </button>
                <button onClick={() => setShareRating(rating)} className="active:scale-90 text-coffee-400">
                  <Share2 size={18} />
                </button>
              </div>
              {/* Reaction pills — quick tap reactions */}
              <div className="flex gap-2 px-4 pb-2">
                {[
                  { type: 'fire', emoji: '🔥', label: 'Fire' },
                  { type: 'same', emoji: '☕', label: 'Same' },
                  { type: 'need_to_try', emoji: '👀', label: 'Need to try' },
                ].map(({ type, emoji }) => {
                  const count = reactionCounts[rating.id]?.[type] || 0
                  const isActive = reactions[rating.id]?.[type]
                  return (
                    <button
                      key={type}
                      onClick={() => toggleReaction(rating.id, type)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all active:scale-95"
                      style={{
                        background: isActive ? '#c8853a' : 'rgba(200,133,58,0.08)',
                        color: isActive ? '#fff' : '#9b7a45',
                        border: `1px solid ${isActive ? '#c8853a' : 'rgba(200,133,58,0.2)'}`,
                      }}
                    >
                      {emoji} {count > 0 && <span>{count}</span>}
                    </button>
                  )
                })}
              </div>
              {/* Comment count tap-to-view */}
              {rating.comments_count > 0 && (
                <div className="px-4 pb-1">
                  <button onClick={() => setActivePost(rating)} className="text-coffee-400 text-xs">
                    View {rating.comments_count} comment{rating.comments_count !== 1 ? 's' : ''} →
                  </button>
                </div>
              )}
              <div className="px-4 pb-3">
                <p className="text-coffee-300 text-xs">{formatDate(rating.created_at)}</p>
              </div>
            </div>
          )
        })}
        </>)}
      </div>

      {selectedShop && <ShopDetailPage shop={selectedShop} onBack={() => setSelectedShop(null)} onNavigateToBrew={onNavigateToBrew} />}
      {activeComments && <CommentsSection ratingId={activeComments} onClose={() => setActiveComments(null)} />}
      {showMessages && <MessagesPanel
        onClose={() => { setShowMessages(false) }}
        unreadPerSender={unreadPerSender}
        onMarkRead={onMarkRead}
      />}
      {showNewInbox && profile && (
        <MessagingInbox
          currentUserId={profile.id}
          onClose={() => setShowNewInbox(false)}
        />
      )}
      {activeMenu && (
        <PostMenu
          isOwn={activeMenu._isOwn}
          onDelete={() => deletePost(activeMenu.id)}
          onEdit={() => { setEditCaption(''); setEditingPost(activeMenu); setActiveMenu(null) }}
          onReport={() => reportPost(activeMenu)}
          onBlock={() => blockUser(activeMenu.profiles?.id)}
          onClose={() => setActiveMenu(null)}
        />
      )}
      {wishlistRating && <WishlistModal rating={wishlistRating} onClose={() => setWishlistRating(null)} />}
      {activeUserProfile && (
        <div className="fixed inset-0 z-50 bg-cream-100 overflow-y-auto">
          <UserProfilePage userId={activeUserProfile} onBack={() => setActiveUserProfile(null)} />
        </div>
      )}
      {sharingPost && (
        <ShareSheet
          rating={sharingPost}
          onClose={() => setSharingPost(null)}
          onExternal={() => shareExternal(sharingPost)}
          onDM={() => { setSharingPost(null); setShowMessages(true) }}
        />
      )}
      {showSaved && (
        <SavedPostsPanel
          posts={savedPosts}
          onClose={() => setShowSaved(false)}
          onPostClick={(r) => { setShowSaved(false); setActivePost(r) }}
        />
      )}
      {activePost && (
        <PostDetailModal
          rating={activePost}
          onClose={(commentCount, likeCount) => {
            // Sync counts back to feed when modal closes
            if (commentCount !== undefined || likeCount !== undefined) {
              setRatings(prev => prev.map(r => r.id === activePost.id ? {
                ...r,
                comments_count: commentCount ?? r.comments_count,
                likes_count: likeCount ?? r.likes_count,
              } : r))
            }
            setActivePost(null)
          }}
          onUserClick={(id) => { setActivePost(null); setActiveUserProfile(id) }}
          onShopClick={(shop) => { setActivePost(null); setSelectedShop(shop) }}
        />
      )}
      {showWrapped && <BrewWrapped onClose={() => setShowWrapped(false)} />}
      {editingPost && !editCaption && <EditPostModal
        rating={editingPost}
        onClose={() => setEditingPost(null)}
        onSaved={(updated) => {
          setRatings(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r))
          setEditingPost(null)
        }}
      />}
      {/* Infinite scroll sentinel */}
      <div ref={bottomRef} className="h-4" />
      {loadingMore && (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
        </div>
      )}
      {!hasMore && ratings.length > 0 && (
        <p className="text-coffee-300 text-xs text-center py-4">You've seen all the brews ☕</p>
      )}

      {/* Fullscreen image viewer — tap X or backdrop to close */}
      {shareRating && (
        <ShareCard
          rating={shareRating}
          onClose={() => setShareRating(null)}
        />
      )}
      {fullscreenPhotos.length > 0 && (
        <FullscreenCarousel
          photos={fullscreenPhotos}
          initialIndex={fullscreenIndex}
          onClose={() => { setFullscreenPhotos([]); setFullscreenIndex(0) }}
        />
      )}
      {likedByRatingId && <LikedByModal ratingId={likedByRatingId} onClose={() => setLikedByRatingId(null)} onViewProfile={(id) => { setLikedByRatingId(null); setActiveUserProfile(id) }} />}
    </div>
  )
}
