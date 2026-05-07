/**
 * PriceInput.tsx — Shared price + worth-it input component
 *
 * Used in MugRating and QuickSip details steps.
 * Fully optional — users can skip both fields.
 * "Show on my post" toggle only appears once something is entered.
 *
 * Psychological design:
 * - "Steal" left (green) → positive anchor, feels exciting to tap
 * - "Worth it" center (caramel) → safe, easy default
 * - "Overpriced" right (red) → negative, rightward direction = stop
 * - Toggle only appears after entry → reduces upfront friction
 */

import { DollarSign } from 'lucide-react'

export type PricePerception = 'steal' | 'worth_it' | 'overpriced' | null

interface Props {
  price: string
  setPrice: (v: string) => void
  perception: PricePerception
  setPerception: (v: PricePerception) => void
  showOnPost: boolean
  setShowOnPost: (v: boolean) => void
  liquidColor: string
}

const WORTH_OPTIONS: { key: PricePerception; label: string; bg: string; text: string; border: string }[] = [
  { key: 'steal',      label: 'Steal 🤑',      bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  { key: 'worth_it',   label: 'Worth it ✓',    bg: '#fdf0dc', text: '#c8853a', border: '#c8853a' },
  { key: 'overpriced', label: 'Overpriced 😬', bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
]

export { WORTH_OPTIONS }

export default function PriceInput({
  price, setPrice,
  perception, setPerception,
  showOnPost, setShowOnPost,
  liquidColor,
}: Props) {
  const hasEntry = price !== '' || perception !== null

  return (
    <div className="mb-4">
      <label className="text-coffee-500 text-xs uppercase tracking-wider mb-2 block flex items-center gap-1.5">
        <DollarSign size={11} className="inline" /> How was the value?
        <span className="normal-case tracking-normal font-normal text-coffee-300 ml-1">optional</span>
      </label>

      {/* Price input */}
      <div className="flex items-center gap-2 bg-cream-50 border border-cream-200 rounded-xl px-4 py-3 mb-2 focus-within:border-caramel transition-colors">
        <span className="text-coffee-400 font-semibold text-base flex-shrink-0">$</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          max="999"
          placeholder="0.00"
          value={price}
          onChange={e => {
            const v = e.target.value
            if (v === '' || (parseFloat(v) >= 0 && parseFloat(v) <= 999)) setPrice(v)
          }}
          className="flex-1 bg-transparent text-coffee-800 text-sm focus:outline-none placeholder-coffee-300 font-medium"
          style={{ appearance: 'none', MozAppearance: 'textfield' }}
        />
        <span className="text-coffee-300 text-xs flex-shrink-0">What did you pay?</span>
      </div>

      {/* Worth-it selector */}
      <div className="grid grid-cols-3 gap-1.5 mb-2">
        {WORTH_OPTIONS.map(opt => {
          const active = perception === opt.key
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPerception(active ? null : opt.key)}
              className="py-2 rounded-xl text-xs font-medium transition-all border"
              style={{
                background: active ? opt.bg : '#f5ead8',
                borderColor: active ? opt.border : '#e8d4b0',
                color: active ? opt.text : '#9b7a55',
                fontWeight: active ? 700 : 500,
                transform: active ? 'scale(1.04)' : 'scale(1)',
              }}>
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Show on post toggle — only visible once something is entered */}
      {hasEntry && (
        <div className="flex items-center justify-between bg-cream-50 rounded-xl px-4 py-3 border border-cream-200 mt-2">
          <div>
            <p className="text-coffee-700 text-sm font-semibold">Show on my post</p>
            <p className="text-coffee-400 text-xs">Others can see the price & value</p>
          </div>
          <button
            type="button"
            onClick={() => setShowOnPost(!showOnPost)}
            className="w-11 h-6 rounded-full transition-colors relative flex-shrink-0"
            style={{ background: showOnPost ? liquidColor : '#d4c4b0' }}>
            <div
              className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
              style={{ transform: showOnPost ? 'translateX(20px)' : 'translateX(2px)' }}
            />
          </button>
        </div>
      )}
    </div>
  )
}
