/**
 * BadgeExplainerModal.tsx
 *
 * Shows all 16 badge levels with descriptions.
 * Current level highlighted. Streak explanation included.
 */

import { X } from 'lucide-react'
import { BADGE_TIERS, BadgeTier } from '../../lib/badges'

interface Props {
  type: 'badge' | 'streak'
  badge?: { label: string; emoji: string; color: string }
  streak?: number
  onClose: () => void
}

export default function BadgeExplainerModal({ type, badge, streak, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.85)' }}
      onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white rounded-t-3xl pb-8"
        style={{ maxHeight: '88vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200 sticky top-0 bg-white z-10">
          <h3 className="font-display font-bold text-coffee-800 text-lg">
            {type === 'badge' ? '☕ Explorer Levels' : '🔥 Brew Streak'}
          </h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500">
            <X size={15} />
          </button>
        </div>

        {type === 'badge' && (
          <div className="px-5 pt-4">
            <p className="text-coffee-400 text-sm mb-2 leading-relaxed">
              Your level reflects how wide your coffee world has grown — shops visited, cities explored, countries crossed, and continents discovered.
            </p>
            <p className="text-coffee-300 text-xs mb-4 leading-relaxed">
              Levels 1–6 are based on rated visits. Levels 7–16 use an exploration score combining unique shops, cities, countries and continents.
            </p>

            {/* Group: Foundation levels */}
            <p className="text-coffee-300 text-xs font-semibold uppercase tracking-widest mb-2">Foundation</p>
            <div className="space-y-2 mb-4">
              {BADGE_TIERS.filter(t => t.level <= 6).map(tier => (
                <BadgeRow key={tier.label} tier={tier} isCurrentBadge={badge?.label === tier.label} />
              ))}
            </div>

            {/* Group: Explorer levels */}
            <p className="text-coffee-300 text-xs font-semibold uppercase tracking-widest mb-2">Explorer</p>
            <div className="space-y-2 mb-4">
              {BADGE_TIERS.filter(t => t.level >= 7 && t.level <= 10).map(tier => (
                <BadgeRow key={tier.label} tier={tier} isCurrentBadge={badge?.label === tier.label} />
              ))}
            </div>

            {/* Group: Global levels */}
            <p className="text-coffee-300 text-xs font-semibold uppercase tracking-widest mb-2">Global</p>
            <div className="space-y-2">
              {BADGE_TIERS.filter(t => t.level >= 11).map(tier => (
                <BadgeRow key={tier.label} tier={tier} isCurrentBadge={badge?.label === tier.label} />
              ))}
            </div>
          </div>
        )}

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
                <span className="text-lg flex-shrink-0">🌍</span>
                <div>
                  <p className="font-semibold text-coffee-800 mb-1">Streaks contribute to your explorer score</p>
                  <p>Each week of your streak adds 2 points to your exploration score — helping you unlock higher levels over time.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function BadgeRow({ tier, isCurrentBadge }: { tier: BadgeTier; isCurrentBadge: boolean }) {
  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-2xl transition-all ${isCurrentBadge ? 'border-2' : 'border border-cream-200 bg-cream-50'}`}
      style={isCurrentBadge ? { borderColor: tier.color, background: `${tier.color}12` } : {}}>
      <span className="text-2xl flex-shrink-0">{tier.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="font-bold text-sm" style={{ color: tier.color }}>{tier.label}</p>
          {isCurrentBadge && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ background: tier.color }}>Your level</span>
          )}
        </div>
        <p className="text-coffee-300 text-xs mb-1">
          {tier.minVisits !== undefined
            ? tier.level === 6
              ? '100+ rated visits'
              : `${tier.minVisits}${BADGE_TIERS[tier.level]?.minVisits ? `–${BADGE_TIERS[tier.level].minVisits! - 1}` : '+'} rated visits`
            : `Exploration score ${tier.minScore?.toLocaleString()}+${tier.minCountries ? ` · ${tier.minCountries}+ countr${tier.minCountries > 1 ? 'ies' : 'y'}` : ''}${tier.minContinents ? ` · ${tier.minContinents}+ continents` : ''}`
          }
        </p>
        <p className="text-coffee-600 text-xs leading-relaxed">{tier.desc}</p>
      </div>
    </div>
  )
}
