// src/components/shared/BrewWrapped.tsx
// Social Brew Wrapped — available December and January only
// Shows calendar year stats, rankings, and personality type

import { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  onClose: () => void
}

interface WrappedData {
  year: number
  totalSips: number
  totalShops: number
  topShop: { name: string; city: string; count: number } | null
  topVibe: string | null
  longestStreak: number
  badge: string
  favoriteMonth: string
  cities: string[]
  // Rankings
  rankCity: { rank: number; total: number; city: string } | null
  rankNational: { rank: number; total: number } | null
  rankGlobal: { rank: number; total: number } | null
  // Personality
  title: string
  subtitle: string
  emoji: string
}

function getPersonality(data: Omit<WrappedData, 'title' | 'subtitle' | 'emoji'>): { title: string; subtitle: string; emoji: string } {
  const { totalSips, totalShops, cities, longestStreak, topVibe } = data

  // Multi-city explorer
  if (cities.length >= 4) {
    return {
      title: 'The Wandering Barista',
      subtitle: `You took your coffee passport to ${cities.length} cities this year`,
      emoji: '✈️',
    }
  }
  // Loyalty — same shop many times
  if (data.topShop && data.topShop.count >= 10) {
    return {
      title: 'The Local Legend',
      subtitle: `${data.topShop.name} basically named a drink after you`,
      emoji: '👑',
    }
  }
  // High volume rater
  if (totalSips >= 50) {
    return {
      title: 'The Connoisseur',
      subtitle: `${totalSips} sips logged — your palate is basically a scientific instrument`,
      emoji: '🔬',
    }
  }
  // Streak focused
  if (longestStreak >= 8) {
    return {
      title: 'The Ritual Keeper',
      subtitle: `${longestStreak}-week streak — coffee isn't a habit for you, it's a practice`,
      emoji: '🔥',
    }
  }
  // Shop explorer
  if (totalShops >= 10) {
    return {
      title: 'The Explorer',
      subtitle: `${totalShops} different shops — you never order from the same place twice`,
      emoji: '🗺️',
    }
  }
  // Vibe-driven
  if (topVibe === '☕ Cozy' || topVibe === '📚 Quiet') {
    return {
      title: 'The Slow Sipper',
      subtitle: 'You don\'t rush your coffee and your coffee doesn\'t rush you',
      emoji: '☁️',
    }
  }
  if (topVibe === '💻 Work-friendly') {
    return {
      title: 'The Café Office',
      subtitle: 'Your best work happens with a flat white in hand',
      emoji: '💻',
    }
  }
  if (topVibe === '🎉 Social') {
    return {
      title: 'The Coffee Connector',
      subtitle: 'Every coffee is better with company — you proved that this year',
      emoji: '🤝',
    }
  }
  // Getting started
  if (totalSips >= 3) {
    return {
      title: 'The Rising Brew',
      subtitle: 'Your coffee journey is just getting started — wait till next year',
      emoji: '🌱',
    }
  }
  return {
    title: 'The Coffee Curious',
    subtitle: 'You showed up. That\'s how every great coffee story starts',
    emoji: '☕',
  }
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

// Slide backgrounds — each slide gets its own vibe
const SLIDE_STYLES = [
  { bg: 'linear-gradient(160deg, #1a0a02 0%, #3d1a06 60%, #6b3410 100%)', accent: '#c8853a' },
  { bg: 'linear-gradient(160deg, #0a1628 0%, #1a2d4a 60%, #2a4a7a 100%)', accent: '#7ab0c8' },
  { bg: 'linear-gradient(160deg, #1a0a14 0%, #3d1228 60%, #6b2040 100%)', accent: '#c87ab0' },
  { bg: 'linear-gradient(160deg, #0a1a0a 0%, #1a3d1a 60%, #2a6b2a 100%)', accent: '#7ac87a' },
  { bg: 'linear-gradient(160deg, #1a1402 0%, #3d300a 60%, #6b5a18 100%)', accent: '#c8b03a' },
  { bg: 'linear-gradient(160deg, #12001a 0%, #2a003d 60%, #4a006b 100%)', accent: '#b07ac8' },
]

export default function BrewWrapped({ onClose }: Props) {
  const { profile } = useAuth()
  const [data, setData] = useState<WrappedData | null>(null)
  const [loading, setLoading] = useState(true)
  const [slide, setSlide] = useState(0)

  const year = new Date().getMonth() === 0
    ? new Date().getFullYear() - 1  // January shows previous year
    : new Date().getFullYear()       // December shows current year

  useEffect(() => {
    if (!profile) return
    async function load() {
      const start = `${year}-01-01`
      const end = `${year}-12-31`

      const [ratingsRes, visitsRes, profileRes] = await Promise.all([
        supabase
          .from('ratings')
          .select('*, coffee_shops(name, city, state)')
          .eq('user_id', profile!.id)
          .gte('created_at', start)
          .lte('created_at', end)
          .order('created_at', { ascending: true }),
        supabase
          .from('user_shop_visits')
          .select('*, coffee_shops(name, city, state)')
          .eq('user_id', profile!.id),
        supabase
          .from('profiles')
          .select('longest_streak, badge, current_streak')
          .eq('id', profile!.id)
          .single(),
      ])

      const ratings = ratingsRes.data || []
      void visitsRes // reserved for future use
      const prof = profileRes.data

      // Total sips this year
      const totalSips = ratings.length

      // Unique shops this year
      const shopIds = new Set(ratings.filter(r => r.shop_id).map(r => r.shop_id))
      const totalShops = shopIds.size

      // Top shop by visit count
      const shopCounts: Record<string, { name: string; city: string; count: number }> = {}
      for (const r of ratings) {
        if (r.coffee_shops) {
          const key = r.shop_id
          if (!shopCounts[key]) shopCounts[key] = { name: r.coffee_shops.name, city: r.coffee_shops.city, count: 0 }
          shopCounts[key].count++
        }
      }
      const topShop = Object.values(shopCounts).sort((a, b) => b.count - a.count)[0] || null

      // Top vibe
      const vibeCounts: Record<string, number> = {}
      for (const r of ratings) {
        for (const v of (r.vibe_tags || [])) {
          vibeCounts[v] = (vibeCounts[v] || 0) + 1
        }
      }
      const topVibe = Object.entries(vibeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

      // Favorite month
      const monthCounts = new Array(12).fill(0)
      for (const r of ratings) {
        const m = new Date(r.created_at).getMonth()
        monthCounts[m]++
      }
      const favoriteMonthIdx = monthCounts.indexOf(Math.max(...monthCounts))
      const favoriteMonth = totalSips > 0 ? MONTHS[favoriteMonthIdx] : 'N/A'

      // Cities visited
      const citySet = new Set<string>()
      for (const r of ratings) {
        if (r.coffee_shops?.city) citySet.add(r.coffee_shops.city)
      }
      const cities = Array.from(citySet)

      // Rankings — compare total sips against other users this year
      const { data: allUsers } = await supabase
        .from('ratings')
        .select('user_id, profiles(city)')
        .gte('created_at', start)
        .lte('created_at', end)

      // Build user sip counts
      const userSips: Record<string, { count: number; city?: string }> = {}
      for (const r of (allUsers || [])) {
        if (!userSips[r.user_id]) userSips[r.user_id] = { count: 0, city: (r as any).profiles?.city }
        userSips[r.user_id].count++
      }
      // Ensure current user is in the map
      if (!userSips[profile!.id]) userSips[profile!.id] = { count: totalSips }

      const allCounts = Object.values(userSips).map(u => u.count).sort((a, b) => b - a)
      const globalRank = allCounts.indexOf(totalSips) + 1
      const globalTotal = allCounts.length

      // City rank — use profile city or top city from ratings
      const userCity = (profile as any).city || cities[0]
      let rankCity = null
      if (userCity) {
        const cityCounts = Object.entries(userSips)
          .filter(([_, u]) => u.city === userCity)
          .map(([_, u]) => u.count)
          .sort((a, b) => b - a)
        if (cityCounts.length > 0) {
          const cityRank = cityCounts.indexOf(totalSips) + 1 || 1
          rankCity = { rank: cityRank, total: cityCounts.length, city: userCity }
        }
      }

      const rankNational = { rank: globalRank, total: globalTotal }
      const rankGlobal = { rank: globalRank, total: globalTotal }

      const baseData = {
        year,
        totalSips,
        totalShops,
        topShop,
        topVibe,
        longestStreak: prof?.longest_streak || 0,
        badge: prof?.badge || 'Coffee Curious',
        favoriteMonth,
        cities,
        rankCity,
        rankNational,
        rankGlobal,
      }

      const personality = getPersonality(baseData)

      setData({ ...baseData, ...personality })
      setLoading(false)
    }
    load()
  }, [profile, year])

  if (loading) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center" style={{ background: '#1a0a02' }}>
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">☕</div>
          <p className="text-white/60 text-sm">Brewing your {year} recap...</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const slides = [
    // Slide 0 — Cover
    {
      style: SLIDE_STYLES[0],
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <div className="text-7xl mb-6">{data.emoji}</div>
          <p className="text-white/50 text-sm tracking-widest uppercase mb-2">Social Brew</p>
          <h1 className="text-white font-display text-5xl font-bold leading-tight mb-4">{data.year}<br />Wrapped</h1>
          <p className="text-white/60 text-base">Your year in coffee, @{profile?.username}</p>
          <div className="mt-10 flex items-center gap-2 text-white/40 text-sm">
            <span>Swipe to explore</span>
            <ChevronRight size={16} />
          </div>
        </div>
      ),
    },
    // Slide 1 — Personality
    {
      style: SLIDE_STYLES[1],
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <p className="text-white/50 text-xs tracking-widest uppercase mb-6">Your Coffee Persona</p>
          <div className="text-8xl mb-6">{data.emoji}</div>
          <h2 className="text-white font-display text-4xl font-bold mb-4">{data.title}</h2>
          <p className="text-white/70 text-base leading-relaxed">{data.subtitle}</p>
          <div className="mt-8 px-5 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <p className="text-white/80 text-sm">Badge achieved: <span className="font-bold text-white">{data.badge}</span></p>
          </div>
        </div>
      ),
    },
    // Slide 2 — Big numbers
    {
      style: SLIDE_STYLES[2],
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <p className="text-white/50 text-xs tracking-widest uppercase mb-10">Your {data.year} in numbers</p>
          <div className="space-y-8 w-full">
            <div>
              <p className="text-white font-display" style={{ fontSize: 80, lineHeight: 1, fontWeight: 900 }}>{data.totalSips}</p>
              <p className="text-white/60 text-lg mt-1">sips logged</p>
            </div>
            <div className="w-16 h-px mx-auto" style={{ background: 'rgba(255,255,255,0.2)' }} />
            <div>
              <p className="text-white font-display" style={{ fontSize: 80, lineHeight: 1, fontWeight: 900 }}>{data.totalShops}</p>
              <p className="text-white/60 text-lg mt-1">shops visited</p>
            </div>
          </div>
        </div>
      ),
    },
    // Slide 3 — Top shop + vibe
    {
      style: SLIDE_STYLES[3],
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <p className="text-white/50 text-xs tracking-widest uppercase mb-10">Your favorites</p>
          {data.topShop ? (
            <div className="mb-10">
              <p className="text-white/60 text-sm mb-2">Most visited shop</p>
              <h2 className="text-white font-display text-3xl font-bold">{data.topShop.name}</h2>
              <p className="text-white/50 text-sm mt-1">{data.topShop.city} · {data.topShop.count}x this year</p>
            </div>
          ) : (
            <div className="mb-10">
              <p className="text-white/60 text-sm mb-2">Most visited shop</p>
              <h2 className="text-white font-display text-2xl">Start exploring in {data.year + 1}!</h2>
            </div>
          )}
          <div className="w-16 h-px mx-auto mb-10" style={{ background: 'rgba(255,255,255,0.2)' }} />
          {data.topVibe && (
            <div>
              <p className="text-white/60 text-sm mb-2">Your vibe</p>
              <p className="text-white font-display text-3xl font-bold">{data.topVibe}</p>
            </div>
          )}
          <div className="mt-6">
            <p className="text-white/60 text-sm mb-1">Peak coffee month</p>
            <p className="text-white font-bold text-xl">{data.favoriteMonth}</p>
          </div>
        </div>
      ),
    },
    // Slide 4 — Streak + cities
    {
      style: SLIDE_STYLES[4],
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <p className="text-white/50 text-xs tracking-widest uppercase mb-10">Dedication</p>
          <div className="mb-8">
            <p className="text-white font-display" style={{ fontSize: 72, lineHeight: 1, fontWeight: 900 }}>{data.longestStreak}</p>
            <p className="text-white/60 text-lg mt-1">week best streak 🔥</p>
          </div>
          <div className="w-16 h-px mx-auto mb-8" style={{ background: 'rgba(255,255,255,0.2)' }} />
          <div>
            <p className="text-white/60 text-sm mb-3">Cities you brewed in</p>
            {data.cities.length > 0 ? (
              <div className="flex flex-wrap gap-2 justify-center">
                {data.cities.slice(0, 6).map(c => (
                  <span key={c} className="px-3 py-1.5 rounded-full text-white text-sm font-medium" style={{ background: 'rgba(255,255,255,0.15)' }}>{c}</span>
                ))}
                {data.cities.length > 6 && (
                  <span className="px-3 py-1.5 rounded-full text-white/60 text-sm">+{data.cities.length - 6} more</span>
                )}
              </div>
            ) : (
              <p className="text-white/40 text-sm">No shops visited yet</p>
            )}
          </div>
        </div>
      ),
    },
    // Slide 5 — Rankings
    {
      style: SLIDE_STYLES[5],
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <p className="text-white/50 text-xs tracking-widest uppercase mb-10">How you rank</p>
          <div className="space-y-6 w-full">
            {data.rankCity && data.rankCity.total > 1 && (
              <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <p className="text-white/60 text-xs uppercase tracking-wider mb-1">In {data.rankCity.city}</p>
                <p className="text-white font-display text-4xl font-bold">#{data.rankCity.rank}</p>
                <p className="text-white/50 text-sm mt-1">of {data.rankCity.total} brewers</p>
                {data.rankCity.rank <= Math.ceil(data.rankCity.total * 0.1) && (
                  <p className="text-yellow-300 text-xs mt-2 font-semibold">🏆 Top 10% locally</p>
                )}
              </div>
            )}
            {data.rankNational && data.rankNational.total > 1 && (
              <div className="rounded-2xl p-5" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <p className="text-white/60 text-xs uppercase tracking-wider mb-1">On Social Brew</p>
                <p className="text-white font-display text-4xl font-bold">#{data.rankNational.rank}</p>
                <p className="text-white/50 text-sm mt-1">of {data.rankNational.total} brewers</p>
                {data.rankNational.rank === 1 && (
                  <p className="text-yellow-300 text-xs mt-2 font-semibold">👑 #1 Brewer of the Year</p>
                )}
                {data.rankNational.rank <= 3 && data.rankNational.rank > 1 && (
                  <p className="text-yellow-300 text-xs mt-2 font-semibold">🏆 Top 3 globally</p>
                )}
                {data.rankNational.rank <= Math.ceil(data.rankNational.total * 0.1) && data.rankNational.rank > 3 && (
                  <p className="text-yellow-300 text-xs mt-2 font-semibold">⭐ Top 10% on Social Brew</p>
                )}
              </div>
            )}
          </div>
        </div>
      ),
    },
    // Slide 6 — Closing
    {
      style: SLIDE_STYLES[0],
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <div className="text-6xl mb-6">☕</div>
          <h2 className="text-white font-display text-4xl font-bold mb-4">Here's to {data.year + 1}</h2>
          <p className="text-white/60 text-base leading-relaxed mb-8">
            {data.totalSips === 0
              ? `Your coffee journey starts now. See you in ${data.year + 1}.`
              : `${data.totalSips} sips. ${data.totalShops} shops. One community. Keep brewing.`
            }
          </p>
          <div className="w-full space-y-3">
            <div className="rounded-2xl p-4" style={{ background: 'rgba(200,133,58,0.2)', border: '1px solid rgba(200,133,58,0.3)' }}>
              <p className="text-caramel font-bold text-sm">@{profile?.username}</p>
              <p className="text-white/60 text-xs mt-0.5">{data.title} · {data.year}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
            >
              Back to Social Brew
            </button>
          </div>
        </div>
      ),
    },
  ]

  const current = slides[slide]

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col select-none"
      style={{ background: current.style.bg, transition: 'background 0.5s ease' }}
    >
      {/* Progress bars */}
      <div className="flex gap-1 px-4 pt-safe pb-2 flex-shrink-0">
        {slides.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: i < slide ? '100%' : i === slide ? '100%' : '0%',
                background: i <= slide ? 'white' : 'transparent',
              }}
            />
          </div>
        ))}
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-12 right-4 w-8 h-8 rounded-full flex items-center justify-center z-10"
        style={{ background: 'rgba(255,255,255,0.15)' }}
      >
        <X size={16} className="text-white" />
      </button>

      {/* Slide content */}
      <div className="flex-1 overflow-hidden">
        {current.content}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 px-5 pb-12 pt-4 flex-shrink-0">
        {slide > 0 && (
          <button
            onClick={() => setSlide(s => s - 1)}
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
        )}
        {slide < slides.length - 1 ? (
          <button
            onClick={() => setSlide(s => s + 1)}
            className="flex-1 h-12 rounded-full flex items-center justify-center gap-2 font-semibold text-sm"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
          >
            Next <ChevronRight size={16} />
          </button>
        ) : null}
      </div>

      {/* Tap zones for navigation */}
      <div className="absolute inset-0 flex pointer-events-none">
        <div
          className="w-1/3 h-full pointer-events-auto cursor-pointer"
          onClick={() => slide > 0 && setSlide(s => s - 1)}
        />
        <div className="w-1/3 h-full" />
        <div
          className="w-1/3 h-full pointer-events-auto cursor-pointer"
          onClick={() => slide < slides.length - 1 && setSlide(s => s + 1)}
        />
      </div>
    </div>
  )
}
