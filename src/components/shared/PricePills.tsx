/**
 * PricePills.tsx — Display price + worth-it in feed cards and PostDetailModal
 *
 * Only renders if show_price is true and at least one value exists.
 * Sits inline after the drink name pill.
 */

import { WORTH_OPTIONS } from './PriceInput'

interface Props {
  price?: number | null
  perception?: string | null
  showPrice?: boolean | null
}

export default function PricePills({ price, perception, showPrice }: Props) {
  if (showPrice === false) return null
  if (!price && !perception) return null

  const opt = WORTH_OPTIONS.find(o => o.key === perception)

  return (
    <>
      {price != null && price > 0 && (
        <span
          className="text-xs font-semibold px-2.5 py-0.5 rounded-full border flex-shrink-0"
          style={{ background: '#f5ead8', color: '#7a5c3a', borderColor: '#e8d4b0' }}>
          ${price.toFixed(2)}
        </span>
      )}
      {opt && (
        <span
          className="text-xs font-semibold px-2.5 py-0.5 rounded-full border flex-shrink-0"
          style={{ background: opt.bg, color: opt.text, borderColor: opt.border }}>
          {opt.label}
        </span>
      )}
    </>
  )
}
