import { useId } from 'react'

interface Props {
  size?: number
  className?: string
}

export default function VerifiedBadge({ size = 16, className = '' }: Props) {
  const uid = useId()
  const gradId = `vbg${uid.replace(/[^a-z0-9]/gi, '')}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-label="Verified"
      className={`flex-shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8a454" />
          <stop offset="100%" stopColor="#9b5e1a" />
        </linearGradient>
      </defs>
      <circle cx="8" cy="8" r="8" fill={`url(#${gradId})`} />
      <path
        d="M4.5 8.5L7 11L11.5 5.5"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
