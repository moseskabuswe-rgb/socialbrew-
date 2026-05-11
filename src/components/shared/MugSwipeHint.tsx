import { useEffect, useState } from 'react'

interface Props {
  visible: boolean       // parent controls when to show
  onDismiss?: () => void // called after first real interaction
}

/**
 * MugSwipeHint — animated "swipe up" hint that appears when the mug
 * has not yet been touched. Fades out the moment the user starts dragging.
 * Stored in localStorage so it only shows on first use.
 */
export default function MugSwipeHint({ visible, onDismiss }: Props) {
  const [opacity, setOpacity] = useState(0)
  const [animPhase, setAnimPhase] = useState(0) // 0=idle, 1=moving, 2=fading

  useEffect(() => {
    if (!visible) { setOpacity(0); return }

    // Fade in
    const t1 = setTimeout(() => setOpacity(1), 80)

    // Animate the finger icon in a loop
    let phase = 0
    const loop = setInterval(() => {
      phase = (phase + 1) % 3
      setAnimPhase(phase)
    }, 900)

    return () => { clearTimeout(t1); clearInterval(loop) }
  }, [visible])

  if (!visible && opacity === 0) return null

  return (
    <div
      className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-6 z-10"
      style={{ opacity, transition: 'opacity 0.4s ease' }}
      aria-hidden="true"
    >
      {/* Animated finger + arrow */}
      <div className="flex flex-col items-center gap-1 select-none">
        {/* Arrows stacked, fade top-to-bottom to create upward flow */}
        <div className="flex flex-col items-center gap-0.5" style={{ marginBottom: 4 }}>
          {[0, 1, 2].map((i) => (
            <svg
              key={i}
              width="18" height="12"
              viewBox="0 0 18 12"
              style={{
                opacity: animPhase === 2 - i ? 1 : animPhase === (2 - i + 1) % 3 ? 0.45 : 0.12,
                transition: 'opacity 0.35s ease',
                transform: 'rotate(180deg)',
              }}
            >
              <polyline
                points="2,10 9,2 16,10"
                fill="none"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ))}
        </div>

        {/* Finger icon */}
        <div
          style={{
            transform: animPhase === 1 ? 'translateY(-6px)' : 'translateY(0)',
            transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
            {/* finger silhouette */}
            <rect x="11" y="4" width="10" height="22" rx="5" fill="rgba(255,255,255,0.9)" />
            <rect x="4" y="16" width="8" height="16" rx="4" fill="rgba(255,255,255,0.9)" />
            <rect x="20" y="16" width="8" height="16" rx="4" fill="rgba(255,255,255,0.9)" />
            <rect x="4" y="26" width="24" height="10" rx="5" fill="rgba(255,255,255,0.9)" />
          </svg>
        </div>

        <p
          className="text-xs font-semibold tracking-wide mt-1"
          style={{ color: 'rgba(255,255,255,0.75)', letterSpacing: '0.05em' }}
        >
          Swipe up to fill
        </p>
      </div>
    </div>
  )
}
