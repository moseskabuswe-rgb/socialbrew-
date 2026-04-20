// src/components/shared/MilestoneCelebration.tsx

import { useEffect, useState, useRef } from 'react'

export interface Milestone {
  type: 'standard' | 'dramatic'
  emoji: string
  title: string
  subtitle: string
  detail: string
}

interface Props {
  milestone: Milestone
  onClose: () => void
}

// Particle for dramatic celebrations
function Particle({ index }: { index: number }) {
  const emojis = ['☕', '✨', '🔥', '⭐', '💫', '🌟', '☕', '✨']
  const emoji = emojis[index % emojis.length]
  const left = Math.random() * 100
  const delay = Math.random() * 1.5
  const duration = 2.5 + Math.random() * 2
  const size = 14 + Math.floor(Math.random() * 16)

  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}%`,
        top: '-20px',
        fontSize: size,
        animation: `particleFall ${duration}s ease-in ${delay}s forwards`,
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      {emoji}
    </div>
  )
}

export default function MilestoneCelebration({ milestone, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 50)

    // Auto-dismiss standard milestones after 5 seconds
    if (milestone.type === 'standard') {
      timerRef.current = setTimeout(() => handleClose(), 5000)
    }

    return () => {
      clearTimeout(t)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 400)
  }

  if (milestone.type === 'dramatic') {
    return (
      <>
        <style>{`
          @keyframes particleFall {
            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
          @keyframes dramaticPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }
          @keyframes glowRing {
            0%, 100% { box-shadow: 0 0 30px rgba(200,133,58,0.4), 0 0 60px rgba(200,133,58,0.2); }
            50% { box-shadow: 0 0 50px rgba(200,133,58,0.7), 0 0 100px rgba(200,133,58,0.4); }
          }
        `}</style>

        {/* Full screen overlay */}
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{
            background: 'linear-gradient(160deg, #1a0a00 0%, #2d1200 40%, #1a0800 100%)',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.5s ease',
          }}
        >
          {/* Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 28 }).map((_, i) => (
              <Particle key={i} index={i} />
            ))}
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center px-8 text-center">
            {/* Glowing emoji */}
            <div
              className="w-28 h-28 rounded-full flex items-center justify-center mb-6"
              style={{
                background: 'rgba(200,133,58,0.15)',
                border: '2px solid rgba(200,133,58,0.4)',
                animation: 'glowRing 2s ease-in-out infinite, dramaticPulse 2s ease-in-out infinite',
              }}
            >
              <span style={{ fontSize: 56 }}>{milestone.emoji}</span>
            </div>

            {/* Social Brew label */}
            <p className="text-caramel text-xs font-semibold tracking-widest uppercase mb-3 opacity-70">
              Social Brew
            </p>

            {/* Title */}
            <h1
              className="text-white font-display font-bold mb-3"
              style={{ fontSize: 28, lineHeight: 1.2, textShadow: '0 0 30px rgba(200,133,58,0.5)' }}
            >
              {milestone.title}
            </h1>

            {/* Subtitle */}
            <p className="text-caramel font-semibold text-lg mb-4">
              {milestone.subtitle}
            </p>

            {/* Detail */}
            <p className="text-white/70 text-sm leading-relaxed max-w-xs mb-10">
              {milestone.detail}
            </p>

            {/* Dismiss */}
            <button
              onClick={handleClose}
              className="px-8 py-4 rounded-2xl font-bold text-base"
              style={{
                background: 'linear-gradient(135deg, #c8853a, #9b5e1a)',
                boxShadow: '0 4px 24px rgba(200,133,58,0.4)',
                color: 'white',
              }}
            >
              Keep brewing ☕
            </button>
          </div>
        </div>
      </>
    )
  }

  // Standard — bottom sheet style, auto-dismisses
  return (
    <div
      className="fixed bottom-24 left-4 right-4 z-50 rounded-2xl p-4 flex items-center gap-4"
      style={{
        background: 'linear-gradient(135deg, #2d1200, #3d1a00)',
        border: '1px solid rgba(200,133,58,0.3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        transform: visible && !closing ? 'translateY(0)' : 'translateY(120px)',
        opacity: visible && !closing ? 1 : 0,
        transition: 'transform 0.4s ease, opacity 0.4s ease',
      }}
      onClick={handleClose}
    >
      {/* Emoji */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(200,133,58,0.15)', border: '1px solid rgba(200,133,58,0.3)' }}
      >
        <span style={{ fontSize: 28 }}>{milestone.emoji}</span>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-caramel text-xs font-semibold tracking-wider uppercase mb-0.5">
          Social Brew
        </p>
        <p className="text-white font-bold text-sm leading-tight">
          {milestone.title}
        </p>
        <p className="text-white/60 text-xs mt-0.5 leading-snug">
          {milestone.subtitle}
        </p>
      </div>

      {/* Progress dots — auto dismiss indicator */}
      <div className="flex flex-col gap-1 flex-shrink-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="w-1 h-1 rounded-full"
            style={{ background: 'rgba(200,133,58,0.4)' }}
          />
        ))}
      </div>
    </div>
  )
}

// ── MILESTONE DEFINITIONS ────────────────────────────────
// Centralised so App.tsx can import and check these

export interface MilestoneDefinition {
  key: string
  emoji: string
  title: string
  subtitle: string
  detail: string
  type: 'standard' | 'dramatic'
}

export const WEEKLY_STREAK_MILESTONES: MilestoneDefinition[] = [
  {
    key: 'weekly_streak_4',
    emoji: '☕',
    title: 'One Month Strong',
    subtitle: '4 weeks without missing a beat.',
    detail: 'You\'ve shown up every week for a month. That\'s not a habit — that\'s a lifestyle.',
    type: 'standard',
  },
  {
    key: 'weekly_streak_8',
    emoji: '🔥',
    title: 'Devoted Brewer',
    subtitle: '8 consecutive weeks. Two months in.',
    detail: 'Most people quit before this point. You\'re still here, still brewing, still discovering.',
    type: 'standard',
  },
  {
    key: 'weekly_streak_13',
    emoji: '⭐',
    title: 'Quarter Regular',
    subtitle: 'A full season of weekly coffee.',
    detail: '13 weeks. One quarter. You\'ve made coffee exploration part of who you are.',
    type: 'standard',
  },
  {
    key: 'weekly_streak_26',
    emoji: '🏆',
    title: 'Half Year Brewer',
    subtitle: '26 weeks. Six months. Unreal.',
    detail: 'Half a year of showing up every single week. The coffee community is lucky to have someone like you.',
    type: 'dramatic',
  },
  {
    key: 'weekly_streak_52',
    emoji: '👑',
    title: 'A Full Year of Coffee',
    subtitle: '52 weeks. Not once did you stop.',
    detail: 'A full year without breaking your streak. This is the rarest achievement on Social Brew. You are the definition of a Brew Master.',
    type: 'dramatic',
  },
]

export const SHOP_STREAK_MILESTONES = (shopName: string, shopId: string): MilestoneDefinition[] => [
  {
    key: `shop_streak_4_${shopId}`,
    emoji: '📍',
    title: `4 Weeks at ${shopName}`,
    subtitle: 'The baristas know your face.',
    detail: `Four weeks in a row at ${shopName}. You\'re not just a customer — you\'re becoming a regular.`,
    type: 'standard',
  },
  {
    key: `shop_streak_8_${shopId}`,
    emoji: '🏡',
    title: `Local Legend`,
    subtitle: `8 weeks straight at ${shopName}.`,
    detail: `Two months. Same shop, every week. ${shopName} is basically your second home at this point.`,
    type: 'standard',
  },
  {
    key: `shop_streak_12_${shopId}`,
    emoji: '🌟',
    title: 'Part of the Furniture',
    subtitle: `3 months at ${shopName}. Iconic.`,
    detail: `${shopName} is lucky to have you. 12 weeks of loyalty — you\'re what independent coffee culture is built on.`,
    type: 'standard',
  },
  {
    key: `shop_streak_26_${shopId}`,
    emoji: '🔥',
    title: 'Six Month Regular',
    subtitle: `Half a year at ${shopName}.`,
    detail: `26 consecutive weeks at ${shopName}. This is extraordinary loyalty. You\'re part of that shop\'s story now.`,
    type: 'dramatic',
  },
]

export const GENERAL_MILESTONES: MilestoneDefinition[] = [
  {
    key: 'unique_shops_10',
    emoji: '🗺️',
    title: 'Explorer',
    subtitle: '10 different shops visited.',
    detail: 'You don\'t settle. 10 unique shops rated — you\'re building a real coffee map of your world.',
    type: 'standard',
  },
  {
    key: 'unique_shops_25',
    emoji: '🧭',
    title: 'Coffee Nomad',
    subtitle: '25 shops and counting.',
    detail: '25 different independent shops. You\'ve done more for local coffee culture than you know.',
    type: 'standard',
  },
  {
    key: '7_day_run',
    emoji: '⚡',
    title: 'Seven Day Run',
    subtitle: 'Coffee every day for a week.',
    detail: 'We noticed — 7 days in a row. Some people call it dedication. We call it beautiful.',
    type: 'standard',
  },
]
