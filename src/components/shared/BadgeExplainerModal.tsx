/**
 * BadgeExplainerModal.tsx
 *
 * Tappable tooltip/modal explaining Social Brew badges and streaks.
 * Opens when a user taps their badge pill, a friend's badge, or a streak.
 *
 * Covers:
 *   - All 6 badge tiers with requirements and descriptions
 *   - Weekly streak system explanation
 *   - Milestone system overview
 */

import { X } from 'lucide-react'

interface BadgeInfo {
  label: string
  emoji: string
  color: string
  min: number
}

interface Props {
  type: 'badge' | 'streak'
  badge?: BadgeInfo
  streak?: number
  onClose: () => void
}

const ALL_BADGES = [
  { label: 'Coffee Curious', emoji: '🌱', color: '#7aaa6a', min: 0, max: 2, desc: 'Just getting started. Every great coffee journey begins with a first sip.' },
  { label: 'Coffee Lover', emoji: '☕', color: '#c8853a', min: 3, max: 9, desc: 'You have a taste for the good stuff. Regulars at your favourite shops are starting to recognise you.' },
  { label: 'Regular', emoji: '⭐', color: '#d4a017', min: 10, max: 24, desc: 'You show up. Consistency is its own form of loyalty and yours is showing.' },
  { label: 'Enthusiast', emoji: '🔥', color: '#e06030', min: 25, max: 49, desc: 'Coffee isn\'t just a habit — it\'s a passion. You know your cortado from your cappuccino.' },
  { label: 'Connoisseur', emoji: '🏆', color: '#9b59b6', min: 50, max: 99, desc: 'Rare. You\'ve explored widely, rated honestly, and built a real coffee story.' },
  { label: 'Brew Master', emoji: '👑', color: '#c0392b', min: 100, max: null, desc: 'The highest level. You\'ve logged 100+ visits across independent shops. A true champion of local coffee culture.' },
]

export default function BadgeExplainerModal({ type, badge, streak, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.85)' }}
      onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up pb-8"
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <h3 className="font-display font-bold text-coffee-800 text-lg">
            {type === 'badge' ? '☕ Badge Levels' : '🔥 Brew Streak'}
          </h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500">
            <X size={15} />
          </button>
        </div>

        {/* Badge explanation */}
        {type === 'badge' && (
          <div className="px-5 pt-4">
            <p className="text-coffee-400 text-sm mb-4 leading-relaxed">
              Your badge reflects how deep your independent coffee journey goes.
              Every rated visit counts — no chains, real visits only.
            </p>
            <div className="space-y-3">
              {ALL_BADGES.map(b => (
                <div key={b.label}
                  className={`flex items-start gap-3 p-3 rounded-2xl transition-all ${badge?.label === b.label ? 'border-2' : 'border border-cream-200 bg-cream-50'}`}
                  style={badge?.label === b.label ? { borderColor: b.color, background: `${b.color}12` } : {}}>
                  <span className="text-2xl flex-shrink-0">{b.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-bold text-sm" style={{ color: b.color }}>{b.label}</p>
                      {badge?.label === b.label && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                          style={{ background: b.color }}>Your level</span>
                      )}
                    </div>
                    <p className="text-coffee-400 text-xs mb-1">
                      {b.max ? `${b.min}–${b.max} visits` : `${b.min}+ visits`}
                    </p>
                    <p className="text-coffee-600 text-xs leading-relaxed">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Streak explanation */}
        {type === 'streak' && (
          <div className="px-5 pt-4">
            <div className="flex items-center gap-3 mb-4 p-4 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #fdf0dc, #f5e0c0)' }}>
              <span className="text-4xl">{(streak || 0) >= 4 ? '🔥' : '☕'}</span>
              <div>
                <p className="font-bold text-coffee-800 text-xl">{streak}-week streak</p>
                <p className="text-coffee-500 text-sm">Keep it going ☕</p>
              </div>
            </div>

            <div className="space-y-4 text-sm text-coffee-600 leading-relaxed">
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">📅</span>
                <div>
                  <p className="font-semibold text-coffee-800 mb-1">How streaks work</p>
                  <p>Rate at least one visit every week to keep your streak alive. Missing a full week resets it to zero. The week runs Monday to Sunday.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">☕</span>
                <div>
                  <p className="font-semibold text-coffee-800 mb-1">Why weekly, not daily?</p>
                  <p>Most people visit independent coffee shops on weekends. A weekly streak reflects real coffee culture — not a daily checkbox.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">🔥</span>
                <div>
                  <p className="font-semibold text-coffee-800 mb-1">The fire appears at 4 weeks</p>
                  <p>Keep a streak going for 4 consecutive weeks and you earn the 🔥 — a mark of genuine dedication to the independent coffee scene.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg flex-shrink-0">🏆</span>
                <div>
                  <p className="font-semibold text-coffee-800 mb-1">Milestones unlock along the way</p>
                  <p>Reach 4, 8, 12, and 16-week streaks to unlock special milestone celebrations. Each one is a real achievement.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
