import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, MoreHorizontal } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import MessageInputBar from './MessageInputBar'

interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  sender_shop_id: string | null
  content: string
  message_type: string
  attachment_url: string | null
  reply_to_message_id: string | null
  deleted_at: string | null
  created_at: string
  profiles?: { username: string; avatar_url: string | null } | null
}

interface Conversation {
  id: string
  type: string
  name: string | null
  photo_url: string | null
}

interface Member {
  user_id: string | null
  shop_id: string | null
  profiles?: { id: string; username: string; avatar_url: string | null } | null
}

interface Props {
  conversation: Conversation
  currentUserId: string
  currentShopId?: string | null
  onBack: () => void
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h`
  return `${Math.floor(m / 1440)}d`
}

export default function ConversationView({ conversation, currentUserId, currentShopId, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingChannelRef = useRef<any>(null)

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    async function load() {
      const [msgRes, memberRes] = await Promise.all([
        supabase
          .from('messages')
          .select('id,conversation_id,sender_id,sender_shop_id,content,message_type,attachment_url,reply_to_message_id,deleted_at,created_at,profiles!messages_sender_id_fkey(username,avatar_url)')
          .eq('conversation_id', conversation.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
          .limit(100),
        supabase
          .from('conversation_members')
          .select('user_id,shop_id,profiles!conversation_members_user_id_fkey(id,username,avatar_url)')
          .eq('conversation_id', conversation.id),
      ])
      setMessages((msgRes.data as any) || [])
      setMembers((memberRes.data as any) || [])
      setLoading(false)
      setTimeout(() => scrollToBottom(), 50)
    }
    load()

    // Mark conversation as read
    supabase.from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversation.id)
      .eq('user_id', currentUserId)
      .then(() => {})

    // Real-time message subscription
    const channel = supabase
      .channel(`conv-${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversation.id}`,
      }, async (payload) => {
        const newMsg = payload.new as Message
        if (newMsg.sender_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username,avatar_url')
            .eq('id', newMsg.sender_id)
            .single()
          setMessages(prev => [...prev, { ...newMsg, profiles: profile }])
        } else {
          setMessages(prev => [...prev, newMsg])
        }
        setTimeout(() => scrollToBottom(true), 50)
        // Mark as read if we're in the conversation
        supabase.from('conversation_members')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', conversation.id)
          .eq('user_id', currentUserId)
          .then(() => {})
      })
      .subscribe()

    // Typing indicator channel (presence-based)
    const typingChannel = supabase.channel(`typing-${conversation.id}`)
    typingChannel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.user_id === currentUserId) return
        const username = payload.username as string
        setTypingUsers(prev => new Set([...prev, username]))
        setTimeout(() => {
          setTypingUsers(prev => { const s = new Set(prev); s.delete(username); return s })
        }, 3000)
      })
      .subscribe()
    typingChannelRef.current = typingChannel

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(typingChannel)
    }
  }, [conversation.id, currentUserId, scrollToBottom])

  async function handleSend(text: string) {
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: currentShopId ? null : currentUserId,
      sender_shop_id: currentShopId || null,
      content: text,
      message_type: 'text',
    })
    // Update conversation updated_at for inbox ordering
    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversation.id)
  }

  // Derive display name for conversation
  const displayName = conversation.name || (() => {
    const otherMembers = members.filter(m => m.user_id !== currentUserId && m.user_id !== null)
    return otherMembers.map(m => (m.profiles as any)?.username || '?').join(', ') || 'Conversation'
  })()

  const typingList = Array.from(typingUsers)

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <button onClick={onBack} className="text-coffee-500 p-1">
          <ArrowLeft size={20} />
        </button>
        <div className="w-9 h-9 rounded-full bg-amber-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {conversation.photo_url
            ? <img src={conversation.photo_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-sm font-bold text-amber-700">{displayName[0]?.toUpperCase()}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-coffee-800 text-sm truncate">{displayName}</p>
          {conversation.type === 'group' && (
            <p className="text-xs text-coffee-400">{members.length} members</p>
          )}
        </div>
        <button className="text-coffee-400 p-1">
          <MoreHorizontal size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 bg-gray-50">
        {loading && (
          <div className="flex justify-center pt-8">
            <div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center pt-16">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-gray-400 text-sm">No messages yet. Say hello!</p>
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === currentUserId || (currentShopId && msg.sender_shop_id === currentShopId)
          const senderName = (msg.profiles as any)?.username || '?'
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
              {!isMe && (
                <div className="w-7 h-7 rounded-full bg-amber-100 overflow-hidden flex-shrink-0 self-end flex items-center justify-center">
                  {(msg.profiles as any)?.avatar_url
                    ? <img src={(msg.profiles as any).avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-xs font-bold text-amber-700">{senderName[0]?.toUpperCase()}</span>
                  }
                </div>
              )}
              <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {!isMe && conversation.type === 'group' && (
                  <p className="text-xs text-gray-500 mb-0.5 ml-1">{senderName}</p>
                )}
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isMe ? 'text-white rounded-br-sm' : 'text-gray-800 bg-white shadow-sm rounded-bl-sm'
                  }`}
                  style={{ background: isMe ? '#c8853a' : undefined }}
                >
                  {msg.content}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 mx-1">{timeAgo(msg.created_at)}</p>
              </div>
            </div>
          )
        })}
        {typingList.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-white rounded-2xl px-3 py-2 shadow-sm">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
            <p className="text-xs text-gray-400">{typingList.join(', ')} typing...</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <MessageInputBar
        onSend={handleSend}
        placeholder={`Message ${displayName}...`}
      />
    </div>
  )
}
