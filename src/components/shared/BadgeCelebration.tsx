import { useEffect, useState } from 'react'

type Props = {
  badge: { label: string; emoji: string; color: string }
  onClose: () => void
}

export default function BadgeCelebration({ badge, onClose }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 50)
    const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 400) }, 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
      style={{ background: visible ? 'rgba(0,0,0,0.4)' : 'transparent', transition: 'background 0.3s', backdropFilter: visible ? 'blur(4px)' : 'none' }}>
      <div className="pointer-events-auto text-center px-8 py-10 rounded-3xl bg-white shadow-2xl mx-6"
        style={{
          transform: visible ? 'scale(1)' : 'scale(0.5)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s',
          border: `2px solid ${badge.color}44`,
        }}>
        {/* Confetti emoji burst */}
        <div className="text-5xl mb-1 animate-bounce">🎉</div>
        <div className="text-6xl mb-4" style={{ animation: 'bounceIn 0.6s ease-out' }}>{badge.emoji}</div>
        <p className="text-coffee-400 text-sm uppercase tracking-widest mb-1">New Title Unlocked</p>
        <p className="font-display text-3xl font-bold mb-2" style={{ color: badge.color }}>{badge.label}</p>
        <p className="text-coffee-400 text-sm">Keep brewing to level up!</p>
        <button onClick={() => { setVisible(false); setTimeout(onClose, 400) }}
          className="mt-6 px-6 py-2 rounded-full text-sm font-semibold text-white"
          style={{ background: badge.color }}>
          Nice! ☕
        </button>
      </div>
    </div>
  )
}
