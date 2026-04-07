import { useState } from 'react'
import { X, MessageSquare } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { trackEvent } from '../../lib/analytics'

function getMugStyle(fill: number) {
  if (fill === 0)  return { liquid: 'transparent', crema: 'transparent', label: 'How are we doing?' }
  if (fill <= 25)  return { liquid: '#b0c4d4', crema: '#ccdde8', label: 'Needs work' }
  if (fill <= 50)  return { liquid: '#c8924a', crema: '#dba96a', label: 'Getting there' }
  if (fill <= 75)  return { liquid: '#a06428', crema: '#c07c38', label: 'Pretty good' }
  return             { liquid: '#4e2008', crema: '#7a3a12', label: '✨ Love it!' }
}

export default function FeedbackWidget() {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [fill, setFill] = useState(0)
  const [comment, setComment] = useState('')
  const [sent, setSent] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const s = getMugStyle(fill)

  function calculateFill(clientY: number, el: HTMLElement) {
    const rect = el.getBoundingClientRect()
    setFill(Math.max(0, Math.min(100, Math.round((1 - (clientY - rect.top) / rect.height) * 100))))
  }

  function handleSubmit() {
    if (fill === 0) return
    trackEvent('feedback_submitted', {
      fill_level: fill,
      satisfaction_label: s.label,
      comment: comment.trim() || null,
      username: profile?.username,
    })
    setSent(true)
    setTimeout(() => { setOpen(false); setSent(false); setFill(0); setComment('') }, 2000)
  }

  // Mini mug for the SVG
  const W = 100, H = 110
  const BX = 12, BY = 15, BW = 60, BH = 70, BR = 8
  const fillH = Math.round((fill / 100) * (BH - 4))
  const fillY = BY + BH - fillH

  return (
    <>
      {/* Subtle floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-40 w-10 h-10 rounded-full bg-white border border-cream-200 shadow-md flex items-center justify-center text-coffee-400 hover:text-caramel hover:border-caramel transition-all duration-200 hover:scale-110"
          title="Share feedback">
          <MessageSquare size={16} />
        </button>
      )}

      {/* Feedback sheet */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(8,4,1,0.6)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h3 className="font-display font-bold text-coffee-800 text-lg">How's Social Brew?</h3>
                <p className="text-coffee-400 text-xs mt-0.5">Fill the mug to rate your experience</p>
              </div>
              <button onClick={() => { setOpen(false); setFill(0); setComment('') }}
                className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-400">
                <X size={15} />
              </button>
            </div>

            {sent ? (
              <div className="flex flex-col items-center py-10 animate-fade-in">
                <div className="text-4xl mb-3">☕</div>
                <p className="text-coffee-700 font-display text-lg font-bold">Thanks for the feedback!</p>
                <p className="text-coffee-400 text-sm mt-1">It helps us brew better.</p>
              </div>
            ) : (
              <div className="px-5 pb-6">
                {/* Mini mug drag */}
                <div className="flex flex-col items-center mb-4">
                  <div
                    onMouseDown={e => { setIsDragging(true); calculateFill(e.clientY, e.currentTarget) }}
                    onMouseMove={e => { if (isDragging) calculateFill(e.clientY, e.currentTarget) }}
                    onMouseUp={() => setIsDragging(false)}
                    onMouseLeave={() => setIsDragging(false)}
                    onTouchStart={e => { setIsDragging(true); calculateFill(e.touches[0].clientY, e.currentTarget) }}
                    onTouchMove={e => { e.preventDefault(); if (isDragging) calculateFill(e.touches[0].clientY, e.currentTarget) }}
                    onTouchEnd={() => setIsDragging(false)}
                    style={{ cursor: 'ns-resize', userSelect: 'none', width: W, height: H }}>
                    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                      <defs>
                        <clipPath id="fb-mug"><rect x={BX+3} y={BY+3} width={BW-6} height={BH-6} rx={BR-2} /></clipPath>
                        <linearGradient id="fb-ceramic" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#e8d8bc" />
                          <stop offset="50%" stopColor="#f0e4cc" />
                          <stop offset="100%" stopColor="#dcc8a8" />
                        </linearGradient>
                        <linearGradient id="fb-liquid" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={s.crema} />
                          <stop offset="20%" stopColor={s.liquid} />
                          <stop offset="100%" stopColor={s.liquid} />
                        </linearGradient>
                      </defs>
                      {/* Saucer */}
                      <ellipse cx={BX+BW/2} cy={BY+BH+10} rx={BW/2+8} ry={6} fill="#dcc8a8" />
                      {/* Handle */}
                      <path d={`M ${BX+BW-1} ${BY+16} Q ${BX+BW+22} ${BY+14} ${BX+BW+22} ${BY+BH/2} Q ${BX+BW+22} ${BY+BH-14} ${BX+BW-1} ${BY+BH-16}`}
                        stroke="#c8b090" strokeWidth="9" fill="none" strokeLinecap="round" />
                      <path d={`M ${BX+BW-1} ${BY+16} Q ${BX+BW+15} ${BY+15} ${BX+BW+15} ${BY+BH/2} Q ${BX+BW+15} ${BY+BH-15} ${BX+BW-1} ${BY+BH-16}`}
                        stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />
                      {/* Body */}
                      <rect x={BX} y={BY} width={BW} height={BH} rx={BR} fill="url(#fb-ceramic)" stroke="#c8b090" strokeWidth="1.5" />
                      {/* Liquid */}
                      {fill > 0 && (
                        <g clipPath="url(#fb-mug)">
                          <rect x={BX+3} y={fillY} width={BW-6} height={fillH} fill="url(#fb-liquid)"
                            style={{ transition: isDragging ? 'none' : 'y 0.15s ease, height 0.15s ease' }} />
                          <ellipse cx={BX+BW/2} cy={fillY+1} rx={(BW-10)/2} ry={3} fill={s.crema} opacity={0.8}
                            style={{ transition: isDragging ? 'none' : 'cy 0.15s ease' }} />
                        </g>
                      )}
                      {/* Rim */}
                      <rect x={BX-2} y={BY-4} width={BW+4} height={9} rx={4.5} fill="#dcc8a8" stroke="#c8b090" strokeWidth="1" />
                    </svg>
                  </div>

                  <p className="font-display font-bold text-coffee-700 text-lg mt-1">
                    {s.label}
                  </p>
                  {fill > 0 && (
                    <div className="w-32 h-1.5 bg-cream-200 rounded-full overflow-hidden mt-1.5">
                      <div className="h-full rounded-full transition-all duration-150"
                        style={{ width: `${fill}%`, background: s.liquid }} />
                    </div>
                  )}
                </div>

                {/* Comment */}
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Anything specific you'd like us to know? (optional)"
                  rows={2}
                  className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300 resize-none mb-4"
                />

                <button
                  onClick={handleSubmit}
                  disabled={fill === 0}
                  className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all disabled:opacity-40"
                  style={{ background: fill > 0 ? `linear-gradient(135deg, ${s.liquid}, ${s.crema})` : '#d4c4b0' }}>
                  {fill === 0 ? 'Slide the mug to rate first' : 'Send Feedback ☕'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
