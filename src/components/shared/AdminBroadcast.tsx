// src/components/shared/AdminBroadcast.tsx
// Hidden admin panel — only visible to Moses

import { useState } from 'react'
import { Send, X } from 'lucide-react'
import { sendBroadcastNotification, sendPushToUser } from '../../lib/push'

const ADMIN_USER_ID = '47e5480e-e592-44bc-9b34-1111af76ea0e'

interface Props {
  currentUserId: string
  onClose: () => void
}

export default function AdminBroadcast({ currentUserId, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetId, setTargetId] = useState('')
  const [mode, setMode] = useState<'broadcast' | 'single'>('broadcast')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  if (currentUserId !== ADMIN_USER_ID) return null

  function fillApology() {
    setTitle('A note from Social Brew ☕')
    setMessage("We hit a database issue during a migration that wiped recent posts. Really sorry about that. Your next brew matters — we're back and better than ever.")
    setMode('broadcast')
  }

  function fillWelcomeBack() {
    setTitle('Social Brew is back! ☕')
    setMessage("New shops added, bugs fixed, and the app is running better than ever. Come share your next coffee visit!")
    setMode('broadcast')
  }

  async function handleSend() {
    if (!title.trim() || !message.trim()) return
    setLoading(true)
    setResult('')
    try {
      if (mode === 'broadcast') {
        await sendBroadcastNotification(title, message, { type: 'broadcast' })
        setResult('✓ Sent to all users!')
      } else {
        if (!targetId.trim()) { setResult('Enter a user ID'); setLoading(false); return }
        await sendPushToUser(targetId.trim(), title, message, { type: 'direct' })
        setResult('✓ Sent!')
      }
      setTimeout(() => { setTitle(''); setMessage(''); setTargetId(''); setResult('') }, 3000)
    } catch (e) {
      setResult('Error sending — check Edge Function logs')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full rounded-t-3xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-display text-xl font-bold text-coffee-800">📣 Send Notification</h2>
            <p className="text-coffee-400 text-xs mt-0.5">Admin only</p>
          </div>
          <button onClick={onClose} className="text-coffee-400 p-1"><X size={22} /></button>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-xl bg-cream-100 p-1 mb-4">
          {(['broadcast', 'single'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${mode === m ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'}`}
            >
              {m === 'broadcast' ? 'All users' : 'One user'}
            </button>
          ))}
        </div>

        {mode === 'single' && (
          <div className="mb-3">
            <label className="text-coffee-500 text-xs font-medium block mb-1">User UUID</label>
            <input
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
              placeholder="Paste user UUID..."
              className="w-full border border-cream-200 rounded-xl px-3 py-2.5 text-sm text-coffee-800 focus:outline-none focus:border-caramel"
            />
          </div>
        )}

        <div className="mb-3">
          <label className="text-coffee-500 text-xs font-medium block mb-1">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Notification title..."
            className="w-full border border-cream-200 rounded-xl px-3 py-2.5 text-sm text-coffee-800 focus:outline-none focus:border-caramel"
          />
        </div>

        <div className="mb-4">
          <label className="text-coffee-500 text-xs font-medium block mb-1">Message</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Notification body..."
            rows={3}
            className="w-full border border-cream-200 rounded-xl px-3 py-2.5 text-sm text-coffee-800 focus:outline-none focus:border-caramel resize-none"
          />
        </div>

        {/* Quick fill buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={fillApology}
            className="flex-1 border border-dashed border-caramel text-caramel rounded-xl py-2 text-xs font-medium"
          >
            ☕ Apology message
          </button>
          <button
            onClick={fillWelcomeBack}
            className="flex-1 border border-dashed border-coffee-400 text-coffee-500 rounded-xl py-2 text-xs font-medium"
          >
            🎉 Welcome back
          </button>
        </div>

        {result && (
          <p className={`text-sm font-medium mb-3 text-center ${result.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
            {result}
          </p>
        )}

        <button
          onClick={handleSend}
          disabled={loading || !title.trim() || !message.trim()}
          className="w-full bg-caramel text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
        >
          {loading ? 'Sending...' : <><Send size={16} /> {mode === 'broadcast' ? `Send to all users` : 'Send to user'}</>}
        </button>
      </div>
    </div>
  )
}
