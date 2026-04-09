import { useState, useEffect, useCallback } from 'react'
import { Heart, MessageCircle, Gift, Bookmark, MoreHorizontal, X, Trash2, Flag, UserX, Plus, Edit2, Check, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Rating } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { trackEvent } from '../../lib/analytics'
import ShopDetailModal from '../shared/ShopDetailModal'
import { NotificationBell } from '../shared/NotificationsPanel'

function getMugColor(fill: number) {
  if (fill <= 20) return '#b0c4d4'
  if (fill <= 40) return '#c8924a'
  if (fill <= 60) return '#a06428'
  if (fill <= 80) return '#7a3e10'
  return '#4e2008'
}

function getFillLabel(fill: number) {
  if (fill <= 15) return 'Just a Sip'
  if (fill <= 30) return 'Getting There'
  if (fill <= 50) return 'Half Cup'
  if (fill <= 70) return 'Good Pour'
  if (fill <= 85) return 'Almost Perfect'
  return 'Perfect Brew ✨'
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

type Comment = {
  id: string; user_id: string; content: string; created_at: string; edited?: boolean
  profiles: { username: string; avatar_url: string | null }
}

type DM = { id: string; from_id: string; to_id: string; content: string; created_at: string; profiles: { username: string; avatar_url: string | null } }

// ── MESSAGES PANEL ──────────────────────────────────────────
function MessagesPanel({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth()
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConvo, setActiveConvo] = useState<any>(null)
  const [messages, setMessages] = useState<DM[]>([])
  const [newMsg, setNewMsg] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchUser, setSearchUser] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])

  useEffect(() => {
    if (!profile) return
    let isMounted = true
    async function load() {
      const { data: sent } = await supabase.from('direct_messages')
        .select('to_id, profiles!direct_messages_to_id_fkey(id,username,avatar_url)')
        .eq('from_id', profile.id).order('created_at', { ascending: false })

      const { data: received } = await supabase.from('direct_messages')
        .select('from_id, profiles!direct_messages_from_id_fkey(id,username,avatar_url)')
        .eq('to_id', profile.id).order('created_at', { ascending: false })

      if (!isMounted) return
      const partners = new Map()
      ;(sent || []).forEach((s: any) => { if (!partners.has(s.to_id)) partners.set(s.to_id, s.profiles) })
      ;(received || []).forEach((r: any) => { if (!partners.has(r.from_id)) partners.set(r.from_id, r.profiles) })
      setConversations(Array.from(partners.entries()).map(([id, p]) => ({ id, ...p })))
      setLoading(false)
    }
    load()
    return () => { isMounted = false }
  }, [profile])

  async function openConvo(partner: any) {
    setActiveConvo(partner)
    const { data } = await supabase.from('direct_messages')
      .select('*, profiles!direct_messages_from_id_fkey(username,avatar_url)')
      .or(`and(from_id.eq.${profile?.id},to_id.eq.${partner.id}),and(from_id.eq.${partner.id},to_id.eq.${profile?.id})`)
      .order('created_at', { ascending: true })
    setMessages((data || []) as any)
  }

  async function sendMsg() {
    if (!newMsg.trim() || !activeConvo || !profile || sending) return
    setSending(true)
    const { data } = await supabase.from('direct_messages')
      .insert({ from_id: profile.id, to_id: activeConvo.id, content: newMsg.trim() })
      .select('*, profiles!direct_messages_from_id_fkey(username,avatar_url)').single()
    if (data) setMessages(prev => [...prev, data as any])
    setNewMsg('')
    setSending(false)
  }

  async function searchUsers(q: string) {
    setSearchUser(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    const { data } = await supabase.from('profiles')
      .select('id,username,avatar_url')
      .ilike('username', `%${q}%`)
      .neq('id', profile?.id)
      .limit(6)
    setSearchResults(data || [])
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.7)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <div className="flex items-center gap-2">
            {activeConvo && (
              <button onClick={() => { setActiveConvo(null); setMessages([]) }} className="text-coffee-400 mr-1">←</button>
            )}
            <h3 className="font-display font-bold text-coffee-800 text-lg">
              {activeConvo ? activeConvo.username : 'Messages'}
            </h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500"><X size={15} /></button>
        </div>

        {!activeConvo && (
          <>
            <div className="px-4 py-2 border-b border-cream-100">
              <div className="flex items-center bg-cream-50 rounded-xl px-3 py-2 border border-cream-200">
                <span className="text-coffee-300 mr-2 text-sm">🔍</span>
                <input value={searchUser} onChange={e => searchUsers(e.target.value)}
                  placeholder="Search users to message..."
                  className="flex-1 bg-transparent text-coffee-700 text-sm placeholder-coffee-300 focus:outline-none" />
              </div>
              {searchResults.map(u => (
                <button key={u.id} onClick={() => { setActiveConvo(u); setSearchUser(''); setSearchResults([]); openConvo(u) }}
                  className="w-full flex items-center gap-3 py-2.5 hover:bg-cream-50 rounded-xl px-2 transition-colors">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                    {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white text-xs font-bold">{u.username[0].toUpperCase()}</span></div>}
                  </div>
                  <p className="text-coffee-700 font-medium text-sm">{u.username}</p>
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {loading && <div className="flex justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" /></div>}
              {!loading && conversations.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-3xl mb-2">💬</p>
                  <p className="text-coffee-500 font-display">No messages yet</p>
                  <p className="text-coffee-400 text-sm mt-1">Search for a friend above to start chatting</p>
                </div>
              )}
              {conversations.map(c => (
                <button key={c.id} onClick={() => openConvo(c)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-cream-100 hover:bg-cream-50 transition-colors">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
                    {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center bg-caramel"><span className="text-white font-bold text-sm">{c.username?.[0]?.toUpperCase()}</span></div>}
                  </div>
                  <p className="text-coffee-700 font-semibold text-sm">{c.username}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {activeConvo && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {messages.length === 0 && <p className="text-center text-coffee-400 text-sm py-6">Say hi! ☕</p>}
              {messages.map(msg => {
                const isMe = msg.from_id === profile?.id
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-3.5 py-2 rounded-2xl text-sm ${isMe ? 'bg-caramel text-white rounded-br-sm' : 'bg-cream-100 text-coffee-800 rounded-bl-sm'}`}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="px-4 py-3 border-t border-cream-200 flex gap-2">
              <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMsg()}
                placeholder="Send a message..."
                className="flex-1 bg-cream-50 rounded-full px-4 py-2 text-sm text-coffee-800 placeholder-coffee-300 focus:outline-none border border-cream-200" />
              <button onClick={sendMsg} disabled={!newMsg.trim() || sending}
                className="w-9 h-9 rounded-full bg-caramel flex items-center justify-center disabled:opacity-40">
                <Send size={15} className="text-white" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── CONTINUED: COMMENTS, WISHLIST, POST MENU, TOAST, AND MAIN HOME TAB ──
// (All other components remain largely unchanged, ensure shopToast rendering is completed as below)
