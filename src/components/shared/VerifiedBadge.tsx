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
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      {/* 8-pointed starburst / seal shape */}
      <path
        d="M8,0.5 L10.1,2.92 L13.3,2.7 L13.08,5.9 L15.5,8 L13.08,10.1 L13.3,13.3 L10.1,13.08 L8,15.5 L5.9,13.08 L2.7,13.3 L2.92,10.1 L0.5,8 L2.92,5.9 L2.7,2.7 L5.9,2.92 Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M4.5 8.5L7 11L11.5 5.5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
