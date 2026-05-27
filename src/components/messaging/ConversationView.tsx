import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, MoreHorizontal, Reply, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import MessageInputBar, { type Attachment, type ReplyTo } from './MessageInputBar'
import GroupSettings from './GroupSettings'

interface Message {
  id: string
  conversation_id: string
  sender_id: string | null
  sender_shop_id: string | null
  content: string | null
  message_type: string
  attachment_url: string | null
  attachment_mime_type: string | null
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
  created_by?: string | null
  other_username?: string
  other_avatar?: string | null
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

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export default function ConversationView({ conversation, currentUserId, currentShopId, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [replyingTo, setReplyingTo] = useState<ReplyTo | null>(null)
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const typingChannelRef = useRef<any>(null)
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useEffect(() => {
    async function load() {
      const [msgRes, memberRes] = await Promise.all([
        supabase
          .from('messages')
          .select('id,conversation_id,sender_id,sender_shop_id,content,message_type,attachment_url,attachment_mime_type,reply_to_message_id,deleted_at,created_at,profiles!messages_sender_id_fkey(username,avatar_url)')
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

    supabase.from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversation.id)
      .eq('user_id', currentUserId)
      .then(() => {})

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
        supabase.from('conversation_members')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', conversation.id)
          .eq('user_id', currentUserId)
          .then(() => {})
      })
      .subscribe()

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

  async function handleSend(text: string, attachment?: Attachment, replyToId?: string) {
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: currentShopId ? null : currentUserId,
      sender_shop_id: currentShopId || null,
      content: text || null,
      message_type: attachment ? 'image' : 'text',
      attachment_url: attachment?.url || null,
      attachment_mime_type: attachment?.mimeType || null,
      reply_to_message_id: replyToId || null,
    })
    setReplyingTo(null)
    supabase.from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id)
      .then(() => {})
  }

  async function handleDelete(messageId: string) {
    await supabase.from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('sender_id', currentUserId)
    setMessages(prev => prev.filter(m => m.id !== messageId))
    setActiveMessageId(null)
  }

  function handleReply(msg: Message) {
    const senderName = msg.sender_id === currentUserId
      ? 'You'
      : (msg.profiles as any)?.username || '?'
    setReplyingTo({
      id: msg.id,
      content: msg.content || '',
      senderName,
      attachmentUrl: msg.attachment_url,
    })
    setActiveMessageId(null)
  }

  function handlePressStart(msgId: string) {
    pressTimerRef.current = setTimeout(() => setActiveMessageId(msgId), 400)
  }

  function handlePressEnd() {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current)
  }

  const displayName = conversation.name
    || (conversation.type === 'dm' ? conversation.other_username : null)
    || (() => {
      const others = members.filter(m => m.user_id !== currentUserId && m.user_id !== null)
      return others.map(m => (m.profiles as any)?.username || '?').join(', ') || 'Conversation'
    })()

  const headerAvatar = conversation.type === 'dm'
    ? (conversation.other_avatar || null)
    : conversation.photo_url

  const typingList = Array.from(typingUsers)
  const msgMap = new Map(messages.map(m => [m.id, m]))

  if (showSettings) {
    return (
      <GroupSettings
        conversationId={conversation.id}
        conversationName={conversation.name}
        members={members}
        currentUserId={currentUserId}
        createdBy={conversation.created_by || null}
        onBack={() => setShowSettings(false)}
        onLeave={onBack}
        onNameUpdated={(_name) => {
          setShowSettings(false)
        }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <button onClick={onBack} className="text-coffee-500 p-1">
          <ArrowLeft size={20} />
        </button>
        <div className="w-9 h-9 rounded-full bg-amber-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {headerAvatar
            ? <img src={headerAvatar} alt="" className="w-full h-full object-cover" />
            : <span className="text-sm font-bold text-amber-700">{displayName[0]?.toUpperCase()}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-coffee-800 text-sm truncate">
            {conversation.type === 'dm' ? `@${displayName}` : displayName}
          </p>
          {conversation.type === 'group' && (
            <p className="text-xs text-coffee-400">{members.length} members</p>
          )}
        </div>
        {conversation.type === 'group' && (
          <button onClick={() => setShowSettings(true)} className="text-coffee-400 p-1">
            <MoreHorizontal size={18} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50"
        onClick={() => setActiveMessageId(null)}
      >
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

        <div className="space-y-1">
          {messages.map((msg, idx) => {
            const isMe = msg.sender_id === currentUserId || (!!currentShopId && msg.sender_shop_id === currentShopId)
            const senderName = (msg.profiles as any)?.username || '?'
            const prevMsg = messages[idx - 1]
            const showAvatar = !isMe && (!prevMsg || prevMsg.sender_id !== msg.sender_id)
            const showName = !isMe && conversation.type === 'group' && showAvatar
            const repliedMsg = msg.reply_to_message_id ? msgMap.get(msg.reply_to_message_id) : null
            const isActive = activeMessageId === msg.id
            const isImage = msg.message_type === 'image' || !!msg.attachment_url

            return (
              <div key={msg.id}>
                {/* Date separator */}
                {(idx === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[idx - 1].created_at).toDateString()) && (
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-gray-200" />
                    <p className="text-xs text-gray-400 font-medium">
                      {new Date(msg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}

                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2 ${isActive ? 'opacity-80' : ''}`}>
                  {/* Avatar */}
                  {!isMe && (
                    <div className="w-7 flex-shrink-0 self-end">
                      {showAvatar && (
                        <div className="w-7 h-7 rounded-full bg-amber-100 overflow-hidden flex items-center justify-center">
                          {(msg.profiles as any)?.avatar_url
                            ? <img src={(msg.profiles as any).avatar_url} alt="" className="w-full h-full object-cover" />
                            : <span className="text-xs font-bold text-amber-700">{senderName[0]?.toUpperCase()}</span>}
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`max-w-[72%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {showName && (
                      <p className="text-xs text-gray-500 mb-0.5 ml-1">{senderName}</p>
                    )}

                    {/* Reply quote */}
                    {repliedMsg && (
                      <div className={`mb-1 px-2.5 py-1.5 rounded-xl text-xs max-w-full border-l-2 border-caramel bg-gray-100 ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'}`}>
                        <p className="font-semibold text-caramel mb-0.5">
                          {repliedMsg.sender_id === currentUserId ? 'You' : (repliedMsg.profiles as any)?.username || '?'}
                        </p>
                        {repliedMsg.attachment_url
                          ? <p className="text-gray-500">📷 Photo</p>
                          : <p className="text-gray-600 truncate">{repliedMsg.content}</p>}
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      onTouchStart={() => handlePressStart(msg.id)}
                      onTouchEnd={handlePressEnd}
                      onTouchMove={handlePressEnd}
                      onClick={(e) => { e.stopPropagation(); setActiveMessageId(isActive ? null : msg.id) }}
                      className={`rounded-2xl overflow-hidden ${isMe ? 'rounded-br-sm' : 'rounded-bl-sm'} cursor-pointer`}
                      style={{ background: isMe ? '#c8853a' : '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}
                    >
                      {isImage && msg.attachment_url && (
                        <button onClick={(e) => { e.stopPropagation(); setFullscreenImage(msg.attachment_url!) }}>
                          <img
                            src={msg.attachment_url}
                            alt=""
                            className="max-w-full max-h-64 object-cover block"
                            style={{ minWidth: 120 }}
                          />
                        </button>
                      )}
                      {msg.content && (
                        <p className={`px-3.5 py-2.5 text-sm leading-relaxed ${isMe ? 'text-white' : 'text-gray-800'}`}>
                          {msg.content}
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 mt-0.5 mx-1">{formatTime(msg.created_at)}</p>

                    {/* Action bar on tap */}
                    {isActive && (
                      <div className={`flex gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReply(msg) }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-xs text-gray-600 shadow-sm active:scale-95"
                        >
                          <Reply size={12} /> Reply
                        </button>
                        {isMe && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(msg.id) }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-red-200 text-xs text-red-500 shadow-sm active:scale-95"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {typingList.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <div className="flex gap-1 bg-white rounded-2xl px-3 py-2 shadow-sm">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <p className="text-xs text-gray-400">{typingList.join(', ')} typing...</p>
            </div>
          )}
        </div>
        <div ref={bottomRef} />
      </div>

      <MessageInputBar
        onSend={handleSend}
        placeholder={`Message ${conversation.type === 'dm' ? `@${displayName}` : displayName}...`}
        replyTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        currentUserId={currentUserId}
      />

      {/* Fullscreen image viewer */}
      {fullscreenImage && (
        <div
          className="fixed inset-0 z-[70] bg-black flex items-center justify-center"
          onClick={() => setFullscreenImage(null)}
        >
          <img src={fullscreenImage} alt="" className="max-w-full max-h-full object-contain" />
          <button className="absolute top-4 right-4 text-white bg-black/40 rounded-full w-9 h-9 flex items-center justify-center">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
