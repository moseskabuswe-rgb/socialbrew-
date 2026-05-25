import { useState, useEffect } from 'react'
import { ArrowLeft, Plus, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import ConversationView from './ConversationView'
import NewConversation from './NewConversation'

interface Conversation {
  id: string
  type: string
  name: string | null
  photo_url: string | null
  created_by: string | null
  updated_at: string
  last_message?: string | null
  unread?: number
  other_username?: string
  other_avatar?: string | null
}

interface Props {
  currentUserId: string
  onClose: () => void
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  if (m < 10080) return `${Math.floor(m / 1440)}d`
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function MessagingInbox({ currentUserId, onClose }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')

  async function loadConversations() {
    // Get conversations the user is a member of
    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id,last_read_at,conversations(id,type,name,photo_url,created_by,updated_at)')
      .eq('user_id', currentUserId)
      .order('joined_at', { ascending: false })

    if (!memberships) { setLoading(false); return }

    const convList: Conversation[] = []

    for (const m of memberships) {
      const conv = m.conversations as any
      if (!conv) continue

      // Get last message
      const { data: lastMsgArr } = await supabase
        .from('messages')
        .select('content,created_at,sender_id,profiles!messages_sender_id_fkey(username)')
        .eq('conversation_id', conv.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)

      const lastMsg = lastMsgArr?.[0]

      // Unread count: messages after last_read_at
      let unread = 0
      if (m.last_read_at) {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .gt('created_at', m.last_read_at)
          .neq('sender_id', currentUserId)
          .is('deleted_at', null)
        unread = count || 0
      }

      // For DMs, get the other person's info
      let otherUsername: string | undefined
      let otherAvatar: string | null | undefined
      if (conv.type === 'dm') {
        const { data: others } = await supabase
          .from('conversation_members')
          .select('user_id,profiles!conversation_members_user_id_fkey(username,avatar_url)')
          .eq('conversation_id', conv.id)
          .neq('user_id', currentUserId)
          .limit(1)
        if (others?.[0]) {
          otherUsername = (others[0].profiles as any)?.username
          otherAvatar = (others[0].profiles as any)?.avatar_url
        }
      }

      const lastMsgContent = lastMsg ? (
        lastMsg.sender_id === currentUserId ? `You: ${lastMsg.content}` : lastMsg.content
      ) : null

      convList.push({
        id: conv.id,
        type: conv.type,
        name: conv.name,
        photo_url: conv.photo_url,
        created_by: conv.created_by,
        updated_at: lastMsg?.created_at || conv.updated_at,
        last_message: lastMsgContent,
        unread,
        other_username: otherUsername,
        other_avatar: otherAvatar,
      })
    }

    // Sort by most recent
    convList.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    setConversations(convList)
    setLoading(false)
  }

  useEffect(() => {
    loadConversations()
  }, [currentUserId])

  function handleConversationCreated(conversationId: string, name: string | null) {
    setShowNew(false)
    loadConversations()
    // Find or create a placeholder conversation object to open
    const existing = conversations.find(c => c.id === conversationId)
    if (existing) {
      setActiveConversation(existing)
    } else {
      setActiveConversation({
        id: conversationId,
        type: 'dm',
        name,
        photo_url: null,
        created_by: currentUserId,
        updated_at: new Date().toISOString(),
      })
    }
  }

  const filtered = search.trim()
    ? conversations.filter(c => {
        const displayName = c.type === 'dm' ? c.other_username : c.name
        return (displayName || '').toLowerCase().includes(search.toLowerCase())
      })
    : conversations

  if (showNew) {
    return (
      <NewConversation
        currentUserId={currentUserId}
        onConversationCreated={handleConversationCreated}
        onBack={() => setShowNew(false)}
      />
    )
  }

  if (activeConversation) {
    return (
      <ConversationView
        conversation={activeConversation}
        currentUserId={currentUserId}
        onBack={() => { setActiveConversation(null); loadConversations() }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <button onClick={onClose} className="text-coffee-500 p-1">
          <ArrowLeft size={20} />
        </button>
        <p className="font-display font-bold text-coffee-800 text-lg flex-1">Messages</p>
        <button
          onClick={() => setShowNew(true)}
          className="w-8 h-8 rounded-full bg-caramel flex items-center justify-center"
        >
          <Plus size={16} className="text-white" />
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mx-4 my-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
        <Search size={14} className="text-gray-400 flex-shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search conversations..."
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
        />
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center pt-12">
            <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center pt-16 px-8">
            <p className="text-3xl mb-3">💬</p>
            <p className="text-coffee-700 font-semibold text-base mb-1">
              {conversations.length === 0 ? 'No messages yet' : 'No results'}
            </p>
            <p className="text-coffee-400 text-sm">
              {conversations.length === 0 ? 'Tap + to start a conversation' : 'Try a different name'}
            </p>
          </div>
        ) : (
          filtered.map(conv => {
            const displayName = conv.type === 'dm'
              ? (conv.other_username ? `@${conv.other_username}` : 'DM')
              : (conv.name || 'Group')
            const avatar = conv.type === 'dm' ? conv.other_avatar : conv.photo_url
            return (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(conv)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full bg-amber-100 overflow-hidden flex items-center justify-center">
                    {avatar
                      ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                      : <span className="text-base font-bold text-amber-700">{displayName[0]?.toUpperCase()}</span>
                    }
                  </div>
                  {(conv.unread || 0) > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-red-500 flex items-center justify-center px-0.5">
                      <span className="text-white font-bold" style={{ fontSize: 9 }}>{(conv.unread || 0) > 9 ? '9+' : conv.unread}</span>
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className={`text-sm ${(conv.unread || 0) > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-800'} truncate`}>
                    {displayName}
                  </p>
                  {conv.last_message && (
                    <p className={`text-xs truncate mt-0.5 ${(conv.unread || 0) > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                      {conv.last_message}
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-400 flex-shrink-0">{timeAgo(conv.updated_at)}</p>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
