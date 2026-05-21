import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { sendBroadcastNotification, sendPushToUser } from '../../lib/push'

interface Props {
  currentUserId: string
}

interface BroadcastLog {
  id: string
  title: string
  message: string
  target_type: string
  target_value: string | null
  recipient_count: number
  sent_by: string
  created_at: string
  sender_profile: { username: string } | null
}

interface UserOption {
  id: string
  username: string
  display_name: string | null
}

type TargetType = 'all' | 'city' | 'user' | 'role'

const TEMPLATES = [
  { label: '☕ New feature', title: 'Something new is brewing!', message: "We just launched a new feature on Social Brew. Tap to check it out!" },
  { label: '🏆 Weekend picks', title: "This weekend's top picks", message: "Check out the highest-rated spots this week — brewed by your community." },
  { label: '✨ Leave a review', title: "Rate your last visit", message: "Haven't logged a brew lately? Drop a quick rating and help the community discover great coffee." },
  { label: '📣 Announcement', title: 'Announcement from Social Brew', message: '' },
]

export default function BroadcastTab({ currentUserId }: Props) {
  const [targetType, setTargetType] = useState<TargetType>('all')
  const [targetCity, setTargetCity] = useState('')
  const [targetRole, setTargetRole] = useState('consumer')
  const [userSearch, setUserSearch] = useState('')
  const [userOptions, setUserOptions] = useState<UserOption[]>([])
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [history, setHistory] = useState<BroadcastLog[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const userSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchHistory() {
    const { data } = await supabase
      .from('broadcast_log')
      .select('id,title,message,target_type,target_value,recipient_count,sent_by,created_at,sender_profile:profiles!sent_by(username)')
      .order('created_at', { ascending: false })
      .limit(20)
    setHistory((data as any) || [])
    setLoadingHistory(false)
  }

  useEffect(() => { fetchHistory() }, [])

  function handleUserSearch(val: string) {
    setUserSearch(val)
    setSelectedUser(null)
    if (userSearchTimer.current) clearTimeout(userSearchTimer.current)
    if (!val.trim()) { setUserOptions([]); return }
    userSearchTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id,username,display_name')
        .or(`username.ilike.%${val}%,display_name.ilike.%${val}%`)
        .limit(8)
      setUserOptions(data || [])
    }, 300)
  }

  async function handleSend() {
    if (!title.trim() || !message.trim()) return
    if (targetType === 'user' && !selectedUser) return
    setSending(true)
    let recipientCount = 0

    try {
      if (targetType === 'all') {
        await sendBroadcastNotification(title, message, { type: 'broadcast' })
        const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).not('push_token', 'is', null)
        recipientCount = count || 0
      } else if (targetType === 'city') {
        // Get users in city via their ratings/profiles
        const { data: cityUsers } = await supabase
          .from('profiles')
          .select('id')
          .ilike('city', `%${targetCity}%`)
          .not('push_token', 'is', null)
        recipientCount = cityUsers?.length || 0
        for (const u of cityUsers || []) {
          await sendPushToUser(u.id, title, message, { type: 'broadcast' })
        }
      } else if (targetType === 'user' && selectedUser) {
        await sendPushToUser(selectedUser.id, title, message, { type: 'direct' })
        recipientCount = 1
      } else if (targetType === 'role') {
        const { data: roleUsers } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', targetRole)
          .not('push_token', 'is', null)
        recipientCount = roleUsers?.length || 0
        for (const u of roleUsers || []) {
          await sendPushToUser(u.id, title, message, { type: 'broadcast' })
        }
      }

      await supabase.from('broadcast_log').insert({
        title,
        message,
        target_type: targetType,
        target_value: targetType === 'city' ? targetCity : targetType === 'user' ? selectedUser?.id : targetType === 'role' ? targetRole : null,
        recipient_count: recipientCount,
        sent_by: currentUserId,
      })

      setSent(true)
      setTitle('')
      setMessage('')
      setUserSearch('')
      setSelectedUser(null)
      setTargetCity('')
      setTimeout(() => setSent(false), 4000)
      fetchHistory()
    } catch (err) {
      console.error('Broadcast failed:', err)
    }
    setSending(false)
  }

  const charLeft = 500 - message.length
  const canSend = title.trim().length > 0 && message.trim().length > 0 && message.length <= 500 &&
    (targetType !== 'user' || !!selectedUser) &&
    (targetType !== 'city' || targetCity.trim().length > 0)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Broadcast</h1>
        <p className="text-sm text-gray-400 mt-0.5">Send push notifications to users</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-5">
        {/* Target */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Target audience</label>
          <div className="flex gap-2 flex-wrap">
            {([['all', 'Everyone'], ['city', 'By city'], ['user', 'Single user'], ['role', 'By role']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setTargetType(val)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${targetType === val ? 'bg-caramel text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {targetType === 'city' && (
            <input
              className="mt-3 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-caramel/30"
              placeholder="City name…"
              value={targetCity}
              onChange={e => setTargetCity(e.target.value)}
            />
          )}
          {targetType === 'user' && (
            <div className="mt-3 relative">
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-caramel/30"
                placeholder="Search username…"
                value={selectedUser ? `@${selectedUser.username}` : userSearch}
                onChange={e => { if (!selectedUser) handleUserSearch(e.target.value) }}
                onFocus={() => { if (selectedUser) setSelectedUser(null) }}
              />
              {userOptions.length > 0 && !selectedUser && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-40 overflow-y-auto">
                  {userOptions.map(u => (
                    <button
                      key={u.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => { setSelectedUser(u); setUserSearch(''); setUserOptions([]) }}
                    >
                      <span className="font-medium">@{u.username}</span>
                      {u.display_name && <span className="text-gray-400 ml-2">{u.display_name}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {targetType === 'role' && (
            <select
              className="mt-3 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-caramel/30"
              value={targetRole}
              onChange={e => setTargetRole(e.target.value)}
            >
              <option value="consumer">Consumers</option>
              <option value="business">Business owners</option>
              <option value="moderator">Moderators</option>
            </select>
          )}
        </div>

        {/* Quick templates */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Quick fill</label>
          <div className="flex gap-2 flex-wrap">
            {TEMPLATES.map(t => (
              <button
                key={t.label}
                onClick={() => { setTitle(t.title); setMessage(t.message) }}
                className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Title</label>
          <input
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-caramel/30"
            placeholder="Notification title…"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={80}
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Message</label>
          <textarea
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-caramel/30 resize-none"
            placeholder="Notification body…"
            rows={4}
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={500}
          />
          <p className={`text-xs mt-1 text-right ${charLeft < 50 ? 'text-red-500' : 'text-gray-400'}`}>
            {charLeft} remaining
          </p>
        </div>

        {/* Preview toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreview(p => !p)}
            className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {preview ? 'Hide preview' : 'Preview'}
          </button>
        </div>

        {/* Phone mockup preview */}
        {preview && (
          <div className="flex justify-center">
            <div className="w-64 bg-gray-900 rounded-[2rem] p-4 pt-8">
              <div className="bg-gray-800 rounded-2xl p-3">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 rounded-xl bg-caramel flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs">☕</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-semibold truncate">{title || 'Title'}</p>
                    <p className="text-gray-300 text-[11px] mt-0.5 line-clamp-3">{message || 'Message body'}</p>
                  </div>
                </div>
              </div>
              <div className="text-center mt-2">
                <p className="text-gray-500 text-[10px]">Social Brew</p>
              </div>
            </div>
          </div>
        )}

        {/* Send button */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          {sent && <p className="text-sm text-green-600 font-medium">Sent!</p>}
          <button
            onClick={handleSend}
            disabled={!canSend || sending}
            className="ml-auto px-5 py-2.5 bg-caramel text-white text-sm font-medium rounded-xl hover:bg-caramel/90 disabled:opacity-40 transition-colors"
          >
            {sending ? 'Sending…' : 'Send notification'}
          </button>
        </div>
      </div>

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent broadcasts</h2>
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {loadingHistory ? (
            <div className="p-4">
              <div className="space-y-2 animate-pulse">
                {[1,2,3].map(i => <div key={i} className="h-4 bg-gray-200 rounded" />)}
              </div>
            </div>
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No broadcasts yet</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {history.map(log => (
                <div key={log.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{log.title}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{log.message}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-400 capitalize">{log.target_type}{log.target_value ? `: ${log.target_value}` : ''}</span>
                        <span className="text-xs text-gray-400">{log.recipient_count} recipient{log.recipient_count !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400">{new Date(log.created_at).toLocaleDateString()}</p>
                      <p className="text-xs text-gray-400">@{(log.sender_profile as any)?.username || '?'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
