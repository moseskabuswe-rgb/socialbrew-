import { useId } from 'react'

interface Props {
  size?: number
  className?: string
}

/**
 * Social Brew verified badge — spiky star in bluish-green with cream checkmark.
 * Only render for user profiles. Do NOT use on coffee shop cards.
 */
export default function VerifiedBadge({ size = 16, className = '' }: Props) {
  const uid = useId()
  const gradId = `vbg${uid.replace(/[^a-z0-9]/gi, '')}`

  // 8-spike star path centred on 12,12 in a 24x24 viewBox
  const cx = 12, cy = 12
  const outerR = 11, innerR = 7.8
  const spikes = 8
  const pts: string[] = []
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes - Math.PI / 2
    const r = i % 2 === 0 ? outerR : innerR
    pts.push(`${i === 0 ? 'M' : 'L'}${(cx + r * Math.cos(angle)).toFixed(3)},${(cy + r * Math.sin(angle)).toFixed(3)}`)
  }
  const starPath = pts.join(' ') + ' Z'
  const strokeW = Math.max(1.2, size * 0.1)

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Verified"
      className={`flex-shrink-0 inline-block align-middle ${className}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <path d={starPath} fill={`url(#${gradId})`} />
      <polyline
        points="7.5,12.2 10.8,15.5 16.5,8.5"
        stroke="#fdf6ee"
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
