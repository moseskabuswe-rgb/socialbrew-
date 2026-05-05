/**
 * badges.ts — Single source of truth for Social Brew's badge/level system
 *
 * Levels 1-6: Pure visit count — unchanged from original system
 * Levels 7-16: Exploration score combining shops, cities, countries, continents
 *
 * Score formula (levels 7+ only):
 *   unique shops × 1
 *   + unique cities × 5
 *   + unique states × 15
 *   + unique countries × 50
 *   + unique continents × 200
 *   + First Brew count × 3
 *   + streak weeks × 2
 *
 * No existing user loses their level. Levels 1-6 thresholds unchanged.
 * Brew Master ceiling raised from 100 to 250 to give room before level 7.
 */

export interface BadgeTier {
  level: number
  label: string
  emoji: string
  color: string
  desc: string
  // Levels 1-6: min visit count
  minVisits?: number
  // Levels 7+: min exploration score
  minScore?: number
  // Levels 7+: optional geographic requirements
  minCountries?: number
  minContinents?: number
}

export const BADGE_TIERS: BadgeTier[] = [
  {
    level: 1,
    label: 'Coffee Curious',
    emoji: '🌱',
    color: '#7aaa6a',
    minVisits: 0,
    desc: 'Just getting started. Every great coffee journey begins with a first sip.',
  },
  {
    level: 2,
    label: 'Coffee Lover',
    emoji: '☕',
    color: '#c8853a',
    minVisits: 5,
    desc: 'You have a taste for the good stuff. Regulars at your favourite shops are starting to recognise you.',
  },
  {
    level: 3,
    label: 'Regular',
    emoji: '⭐',
    color: '#d4a017',
    minVisits: 10,
    desc: 'You show up. Consistency is its own form of loyalty and yours is showing.',
  },
  {
    level: 4,
    label: 'Enthusiast',
    emoji: '🔥',
    color: '#e06030',
    minVisits: 25,
    desc: "Coffee isn't just a habit — it's a passion. You know your cortado from your cappuccino.",
  },
  {
    level: 5,
    label: 'Connoisseur',
    emoji: '🏆',
    color: '#9b59b6',
    minVisits: 50,
    desc: "Rare. You've explored widely, rated honestly, and built a real coffee story.",
  },
  {
    level: 6,
    label: 'Brew Master',
    emoji: '👑',
    color: '#c0392b',
    minVisits: 100,
    desc: "The craft is in the details. You've walked through more doors, tasted more stories, and never settled for ordinary.",
  },
  {
    level: 7,
    label: 'Scene Scout',
    emoji: '🗺️',
    color: '#2980b9',
    minScore: 500,
    desc: "You've started moving beyond your comfort zone. New neighbourhoods, new roasters, new discoveries. The map is just beginning.",
  },
  {
    level: 8,
    label: 'City Explorer',
    emoji: '🌆',
    color: '#16a085',
    minScore: 1500,
    desc: "You know your city's coffee scene the way a local should — the hidden gems, the newcomers, the institutions. You could write the guide.",
  },
  {
    level: 9,
    label: 'Regional Roamer',
    emoji: '🚗',
    color: '#27ae60',
    minScore: 3000,
    desc: "A weekend trip isn't complete without finding the best independent shop in every town you pass through. Coffee is the compass.",
  },
  {
    level: 10,
    label: 'National Traveler',
    emoji: '✈️',
    color: '#8e44ad',
    minScore: 6000,
    desc: "You've chased good coffee across state lines and time zones. No city is too far if the cup is worth it.",
  },
  {
    level: 11,
    label: 'Border Crosser',
    emoji: '🌎',
    color: '#2c3e50',
    minScore: 12000,
    minCountries: 1,
    desc: "You've crossed a border in the name of coffee. That says everything about who you are and nothing needs explaining.",
  },
  {
    level: 12,
    label: 'Continental Drifter',
    emoji: '🌍',
    color: '#e67e22',
    minScore: 30000,
    minCountries: 2,
    desc: "Two countries. Two coffee cultures. You've tasted the difference and you're not done. The world is bigger than any one scene.",
  },
  {
    level: 13,
    label: 'Global Sipper',
    emoji: '🌐',
    color: '#1abc9c',
    minScore: 60000,
    minContinents: 3,
    desc: "You've sipped on three continents. Ethiopian naturals, Australian single origins, European espresso traditions — you've lived it, not just read about it.",
  },
  {
    level: 14,
    label: 'World Brewer',
    emoji: '🧭',
    color: '#d35400',
    minScore: 120000,
    minContinents: 4,
    desc: "At four continents, coffee is no longer a hobby — it's a lens through which you see the world. Every city has a cup worth finding.",
  },
  {
    level: 15,
    label: 'Coffee Cartographer',
    emoji: '⭐',
    color: '#8e44ad',
    minScore: 300000,
    minContinents: 5,
    desc: "You've mapped coffee culture across five continents. The independent coffee world knows your name, even if it doesn't know it yet.",
  },
  {
    level: 16,
    label: 'Legendary',
    emoji: '🌌',
    color: '#1a1a2e',
    minScore: 600000,
    minContinents: 6,
    desc: "There are no words. You have tasted the coffee world in a way almost no one alive has. You didn't just find the third place — you found it on every continent.",
  },
]

// All level labels in order — used for progress comparisons
export const TIER_LABELS = BADGE_TIERS.map(t => t.label)

/**
 * Calculate exploration score from visit data
 * Used for levels 7+
 */
export function calcExplorationScore(stats: {
  uniqueShops: number
  uniqueCities: number
  uniqueStates: number
  uniqueCountries: number
  uniqueContinents: number
  firstBrews: number
  streakWeeks: number
}): number {
  return (
    stats.uniqueShops * 1 +
    stats.uniqueCities * 5 +
    stats.uniqueStates * 15 +
    stats.uniqueCountries * 50 +
    stats.uniqueContinents * 200 +
    stats.firstBrews * 3 +
    stats.streakWeeks * 2
  )
}

/**
 * Get current badge from visit count + exploration stats
 * Returns current tier, next tier, and progress %
 */
export function getBadge(
  visitCount: number,
  explorationStats?: {
    uniqueShops: number
    uniqueCities: number
    uniqueStates: number
    uniqueCountries: number
    uniqueContinents: number
    firstBrews: number
    streakWeeks: number
  }
): { current: BadgeTier; next: BadgeTier; progress: number } {
  const score = explorationStats ? calcExplorationScore(explorationStats) : 0
  const countries = explorationStats?.uniqueCountries || 0
  const continents = explorationStats?.uniqueContinents || 0

  let currentIdx = 0

  for (let i = BADGE_TIERS.length - 1; i >= 0; i--) {
    const tier = BADGE_TIERS[i]

    if (tier.minVisits !== undefined) {
      // Levels 1-6: pure visit count
      if (visitCount >= tier.minVisits) {
        currentIdx = i
        break
      }
    } else if (tier.minScore !== undefined) {
      // Levels 7+: score + optional geographic requirements
      const meetsScore = score >= tier.minScore
      const meetsCountries = !tier.minCountries || countries >= tier.minCountries
      const meetsContinents = !tier.minContinents || continents >= tier.minContinents
      if (meetsScore && meetsCountries && meetsContinents) {
        currentIdx = i
        break
      }
    }
  }

  const current = BADGE_TIERS[currentIdx]
  const next = BADGE_TIERS[Math.min(currentIdx + 1, BADGE_TIERS.length - 1)]

  // Progress calculation
  let progress = 100
  if (next !== current) {
    if (current.minVisits !== undefined && next.minVisits !== undefined) {
      // Visit-based progress
      progress = Math.min(100, Math.round(
        ((visitCount - current.minVisits) / (next.minVisits - current.minVisits)) * 100
      ))
    } else if (current.minScore !== undefined && next.minScore !== undefined) {
      // Score-based progress
      progress = Math.min(100, Math.round(
        ((score - (current.minScore || 0)) / (next.minScore - (current.minScore || 0))) * 100
      ))
    } else if (current.minVisits !== undefined && next.minScore !== undefined) {
      // Transition from visit-based to score-based (Brew Master → Scene Scout)
      progress = Math.min(100, Math.round((score / next.minScore) * 100))
    }
  }

  return { current, next, progress }
}
