import { useState } from 'react'
import { X, MessageSquare, Send } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

function getMugStyle(fill: number) {
  if (fill === 0)  return { liquid: 'transparent', label: 'Drag to rate', color: '#b8935a' }
  if (fill <= 20)  return { liquid: '#b0c4d4', label: 'Not great', color: '#8ca8c5' }
  if (fill <= 40)  return { liquid: '#c8924a', label: 'It\'s okay', color: '#c8924a' }
  if (fill <= 60)  return { liquid: '#a06428', label: 'Pretty good', color: '#a06428' }
  if (fill <= 80)  return { liquid: '#7a3e10', label: 'Really good', color: '#7a3e10' }
  return             { liquid: '#3d1f0a', label: 'Love it ✨', color: '#c8853a' }
}

export default function FeedbackWidget() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [fill, setFill] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [dragging, setDragging] = useState(false)

  const s = getMugStyle(fill)

  function handleMugMove(clientY: number, rect: DOMRect) {
    const relY = rect.bottom - clientY
    const pct = Math.max(0, Math.min(100, Math.round((relY / rect.height) * 100)))
    setFill(pct)
  }

  async function submit() {
    if (fill === 0) return

    // Log to console for now — swap for Posthog when ready
    console.log('[SocialBrew Feedback]', { fill, label: s.label, comment, user: profile?.username })

    // Also save to Supabase feedback table if it exists
    await supabase.from('feedback').insert({
      user_id: profile?.id || null,
      fill_level: fill,
      label: s.label,
      comment: comment.trim() || null,
    }).then(() => {}).catch(() => {}) // silent fail if table doesn't exist yet

    setSubmitted(true)
    setTimeout(() => {
      setOpen(false)
      setSubmitted(false)
      setFill(0)
      setComment('')
    }, 1500)
  }

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed',
            bottom: 76,
            right: 16,
            zIndex: 90,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #c8853a, #a06028)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(200,133,58,0.5)',
            cursor: 'pointer',
          }}
        >
          <MessageSquare size={18} color="white" />
        </button>
      )}

      {/* Feedback sheet */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="flex-1" onClick={() => setOpen(false)} />
          <div className="bg-white rounded-t-3xl p-6 pb-10">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-display font-bold text-coffee-800 text-lg">How's Social Brew?</h3>
                <p className="text-coffee-400 text-xs mt-0.5">Your feedback helps us improve</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-full bg-cream-100 flex items-center justify-center">
                <X size={14} className="text-coffee-600" />
              </button>
            </div>

            {submitted ? (
              <div className="text-center py-8">
                <p className="text-4xl mb-3">☕</p>
                <p className="text-coffee-800 font-semibold text-lg">Thanks for the feedback!</p>
                <p className="text-coffee-400 text-sm mt-1">It goes directly to Moses.</p>
              </div>
            ) : (
              <>
                {/* Mini mug */}
                <div className="flex flex-col items-center gap-3 mb-6">
                  <div
                    style={{ position: 'relative', width: 80, height: 96, cursor: 'ns-resize', userSelect: 'none' }}
                    onMouseDown={() => setDragging(true)}
                    onMouseUp={() => setDragging(false)}
                    onMouseLeave={() => setDragging(false)}
                    onMouseMove={e => { if (dragging) { const r = e.currentTarget.getBoundingClientRect(); handleMugMove(e.clientY, r) } }}
                    onTouchStart={() => setDragging(true)}
                    onTouchEnd={() => setDragging(false)}
                    onTouchMove={e => { const r = e.currentTarget.getBoundingClientRect(); handleMugMove(e.touches[0].clientY, r) }}
                  >
                    <svg viewBox="0 0 60 72" width="80" height="96">
                      <defs><clipPath id="fb-clip"><path d="M8 15 Q8 11 12 11 L48 11 Q52 11 52 15 L52 63 Q52 68 47 68 L13 68 Q8 68 8 63 Z" /></clipPath></defs>
                      <path d="M8 15 Q8 11 12 11 L48 11 Q52 11 52 15 L52 63 Q52 68 47 68 L13 68 Q8 68 8 63 Z" fill="#f7f0e4" stroke="#b8935a" strokeWidth="1.5" />
                      <g clipPath="url(#fb-clip)">
                        <rect x="8" y={68 - (57 * fill / 100)} width="44" height={57 * fill / 100} fill={s.liquid} style={{ transition: 'all 0.1s' }} />
                      </g>
                      <path d="M52 25 Q64 25 64 40 Q64 55 52 55" stroke="#b8935a" strokeWidth="5" fill="none" strokeLinecap="round" />
                    </svg>
                  </div>
                  <p className="font-semibold text-base" style={{ color: s.color }}>{s.label}</p>
                  {fill === 0 && <p className="text-coffee-400 text-xs">Drag up or down on the mug</p>}
                </div>

                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Anything specific? (optional)"
                  rows={2}
                  className="w-full bg-cream-50 border border-cream-200 rounded-2xl px-4 py-3 text-sm text-coffee-800 focus:outline-none focus:border-caramel resize-none mb-4"
                />

                <button
                  onClick={submit}
                  disabled={fill === 0}
                  className="w-full py-3.5 rounded-2xl font-bold text-base text-white disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: fill > 0 ? 'linear-gradient(135deg, #c8853a, #a06028)' : '#e0c898' }}
                >
                  <Send size={16} />
                  Send Feedback
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
