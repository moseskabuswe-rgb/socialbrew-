/**
 * AnonymousFeedbackModal.tsx
 *
 * Shown when a user rates a visit 50% or below.
 * Gives them an optional chance to leave anonymous feedback
 * for the shop — no user_id stored, genuinely anonymous.
 *
 * Props:
 *   shopId     — the shop being rated
 *   shopName   — shown in the prompt
 *   fillLevel  — passed for context/logging
 *   onSkip     — user tapped Skip
 *   onSent     — user submitted (or skipped after typing)
 */

import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { X } from 'lucide-react'

interface Props {
  shopId: string
  shopName: string
  fillLevel: number
  onSkip: () => void
  onSent: () => void
}

export default function AnonymousFeedbackModal({ shopId, shopName, fillLevel, onSkip, onSent }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSend() {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await supabase.from('shop_feedback').insert({
        shop_id: shopId,
        fill_level: fillLevel,
        feedback_text: text.trim(),
      })
      setSent(true)
      setTimeout(onSent, 1200)
    } catch {
      // Fail silently — don't block the rating flow
      onSent()
    }
    setSending(false)
  }

  if (sent) {
    return (
      <div className="fixed inset-0 z-[150] flex items-end justify-center"
        style={{ background: 'rgba(8,4,1,0.7)' }}>
        <div className="w-full max-w-sm bg-white rounded-t-3xl px-5 py-8 text-center">
          <p className="text-3xl mb-3">📬</p>
          <p className="font-bold text-coffee-800 text-base mb-1">Feedback sent anonymously</p>
          <p className="text-coffee-400 text-sm">The shop will see this — you won't be identified.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.75)' }}
      onClick={onSkip}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl px-5 pt-5 pb-8"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-bold text-coffee-800 text-base">Leave feedback for {shopName}?</p>
            <p className="text-coffee-400 text-xs mt-0.5">This goes directly to them — completely anonymous.</p>
          </div>
          <button onClick={onSkip}
            className="w-7 h-7 rounded-full bg-cream-100 flex items-center justify-center flex-shrink-0 ml-3">
            <X size={13} className="text-coffee-400" />
          </button>
        </div>

        {/* Text area */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value.slice(0, 300))}
          placeholder="What could have been better? (optional)"
          rows={4}
          className="w-full bg-cream-50 border border-cream-200 rounded-xl px-4 py-3 text-coffee-700 text-sm resize-none focus:outline-none focus:border-caramel placeholder-coffee-300 mb-2"
          autoFocus
        />
        <p className="text-coffee-300 text-xs text-right mb-4">{text.length}/300</p>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="flex-1 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition-all"
            style={{ background: text.trim() ? 'linear-gradient(135deg, #c8853a, #9b5e1a)' : '#d4b896' }}>
            {sending ? 'Sending...' : 'Send anonymously'}
          </button>
          <button onClick={onSkip}
            className="px-5 py-3 rounded-xl bg-cream-100 text-coffee-500 text-sm font-medium">
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
