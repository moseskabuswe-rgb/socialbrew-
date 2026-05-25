import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import ConversationView from '../../components/messaging/ConversationView'
import NewConversation from '../../components/messaging/NewConversation'
import { Plus, Search } from 'lucide-react'

interface Shop {
  id: string
  name: string
}

interface Props {
  shop: Shop
  userId: string
}

interface Conversation {
  id: string
  type: string
  name: string | null
  photo_url: string | null
  created_by: string | null
  updated_at: string
  last_message?: string | null
  other_username?: string
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

export default function PortalMessages({ shop, userId }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')

  async function loadConversations() {
    // Get conversations where shop is a member
    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id,conversations(id,type,name,photo_url,created_by,updated_at)')
      .eq('shop_id', shop.id)

    if (!memberships) { setLoading(false); return }

    const convList: Conversation[] = []
    for (const m of memberships) {
      const conv = m.conversations as any
      if (!conv) continue
      const { data: lastMsgArr } = await supabase
        .from('messages').select('content,sender_id')
        .eq('conversation_id', conv.id).is('deleted_at', null)
        .order('created_at', { ascending: false }).limit(1)
      const lastMsg = lastMsgArr?.[0]
      convList.push({
        id: conv.id,
        type: conv.type,
        name: conv.name,
        photo_url: conv.photo_url,
        created_by: conv.created_by,
        updated_at: conv.updated_at,
        last_message: lastMsg?.content || null,
      })
    }
    convList.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    setConversations(convList)
    setLoading(false)
  }

  useEffect(() => { loadConversations() }, [shop.id])

  function handleConvCreated(conversationId: string, name: string | null) {
    setShowNew(false)
    loadConversations()
    setActiveConv({ id: conversationId, type: 'dm', name, photo_url: null, created_by: userId, updated_at: new Date().toISOString() })
  }

  const filtered = search.trim()
    ? conversations.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase()))
    : conversations

  if (showNew) {
    return (
      <NewConversation
        currentUserId={userId}
        onConversationCreated={handleConvCreated}
        onBack={() => setShowNew(false)}
      />
    )
  }

  if (activeConv) {
    return (
      <ConversationView
        conversation={activeConv}
        currentUserId={userId}
        currentShopId={shop.id}
        onBack={() => { setActiveConv(null); loadConversations() }}
      />
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: '#c8853a' }}
        >
          <Plus size={14} /> New message
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4 bg-white border border-gray-200 rounded-xl px-3 py-2">
        <Search size={14} className="text-gray-400 flex-shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search messages..."
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">💬</p>
          <p className="text-gray-500 text-sm">No messages yet. Start a conversation with a customer!</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
          {filtered.map(conv => (
            <button
              key={conv.id}
              onClick={() => setActiveConv(conv)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-amber-100 flex-shrink-0 flex items-center justify-center">
                <span className="text-base font-bold text-amber-700">{(conv.name || '?')[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-800 truncate">{conv.name || 'Conversation'}</p>
                {conv.last_message && <p className="text-xs text-gray-400 truncate mt-0.5">{conv.last_message}</p>}
              </div>
              <p className="text-xs text-gray-400 flex-shrink-0">{timeAgo(conv.updated_at)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
