export default function SocialBrewMugIcon({
  size = 24,
  cupColor = '#3d1a08',
  steamColor = '#c8a068',
}: {
  size?: number
  cupColor?: string
  steamColor?: string
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 58 Q20 78 50 78 Q80 78 80 58 L80 52 L20 52 Z" fill={cupColor} />
      <rect x="18" y="48" width="64" height="7" rx="3.5" fill={cupColor} />
      <path d="M78 56 Q92 56 92 64 Q92 72 78 72" stroke={cupColor} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M38 44 Q34 34 38 24 Q42 14 38 6" stroke={steamColor} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M52 44 Q48 32 52 20 Q56 10 52 2" stroke={steamColor} strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  )
}
