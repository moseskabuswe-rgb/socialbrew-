import { useState, useEffect, useMemo, useId } from 'react'
import { supabase } from '../../lib/supabase'

export interface ReportViewerProps {
  shopId: string
  shopName: string
  shopCity?: string
  reportType: 'monthly' | 'weekly' | 'consistency' | 'custom'
  monthsBack?: number
  onClose: () => void
}

interface Rating {
  fill_level: number
  drink_name: string | null
  visit_time: string | null
  vibe_tags: string[] | null
  caption: string | null
  drink_price: string | number | null
  visited_at: string | null
  created_at: string
  user_id: string
}

function getMugColor(fill: number) {
  if (fill < 20) return '#b0c4d4'
  if (fill < 60) return '#c8924a'
  if (fill < 80) return '#7a3e10'
  return '#4e2008'
}

function MiniMug({ fill, size = 40 }: { fill: number; size?: number }) {
  const uid = useId()
  const id = `mug-${uid.replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 56 68" width={size} height={size * 1.2} style={{ flexShrink: 0 }}>
      <defs><clipPath id={id}><rect x="5" y="12" width="38" height="46" rx="5" /></clipPath></defs>
      <rect x="5" y="12" width="38" height="46" rx="5" fill="#f7f0e4" stroke="#c8b090" strokeWidth="1.5" />
      <g clipPath={`url(#${id})`}>
        <rect x="5" y={58 - (46 * fill / 100)} width="38" height={46 * fill / 100} fill={getMugColor(fill)} />
      </g>
      <rect x="3" y="8" width="42" height="8" rx="4" fill="#d4b890" />
      <path d="M43 22 Q56 22 56 33 Q56 44 43 44" stroke="#c8b090" strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="24" cy="58" rx="19" ry="5" fill="#e8ddc8" />
    </svg>
  )
}

export default function ReportViewer({
  shopId,
  shopName,
  shopCity,
  reportType,
  monthsBack = 1,
  onClose,
}: ReportViewerProps) {
  const [ratings, setRatings] = useState<Rating[]>([])
  const [cityTopShopId, setCityTopShopId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const now = useMemo(() => new Date(), [])

  const { startISO } = useMemo(() => {
    const days =
      reportType === 'weekly' ? 7
      : reportType === 'monthly' ? 30
      : reportType === 'consistency' ? 90
      : Math.min(monthsBack, 24) * 30
    const start = new Date(now.getTime() - days * 86400000)
    return { startISO: start.toISOString() }
  }, [reportType, monthsBack, now])

  useEffect(() => {
    async function load() {
      const ratingSelect = 'fill_level, drink_name, visit_time, vibe_tags, caption, drink_price, visited_at, created_at, user_id'
      const [{ data: curr }, cityResult] = await Promise.all([
        supabase.from('ratings').select(ratingSelect).eq('shop_id', shopId).gte('created_at', startISO),
        shopCity
          ? supabase.from('coffee_shops').select('id, weekly_visits').eq('city', shopCity).order('weekly_visits', { ascending: false }).limit(1)
          : Promise.resolve({ data: null }),
      ])
      setRatings((curr || []) as Rating[])
      const cityShops = cityResult.data as { id: string; weekly_visits: number }[] | null
      if (cityShops && cityShops.length > 0) setCityTopShopId(cityShops[0].id)
      setLoading(false)
    }
    load()
  }, [shopId, startISO, shopCity])

  // ── Stats ────────────────────────────────────────────────────────────────
  const n = ratings.length
  const avgFill = n ? Math.round(ratings.reduce((s, r) => s + r.fill_level, 0) / n) : 0
  const variance = n ? ratings.reduce((s, r) => s + Math.pow(r.fill_level - avgFill, 2), 0) / n : 0
  const stdDev = Math.sqrt(variance)
  const consistencyScore = Math.max(0, Math.min(100, Math.round(100 - stdDev * 2)))
  const consistencyLabel = consistencyScore >= 80 ? 'Pristine' : consistencyScore >= 60 ? 'Steady' : consistencyScore >= 40 ? 'Fair' : 'Poor'

  const userIds = ratings.map(r => r.user_id)
  const uniqueVisitors = new Set(userIds).size
  const userIdCounts = userIds.reduce((acc: Record<string, number>, id) => { acc[id] = (acc[id] || 0) + 1; return acc }, {})
  const returnVisitors = Object.values(userIdCounts).filter(c => c > 1).length
  const returnRate = uniqueVisitors ? Math.round((returnVisitors / uniqueVisitors) * 100) : 0

  const isTopInCity = !!(shopCity && cityTopShopId === shopId)

  // Time slots
  const TIME_SLOTS = ['morning', 'afternoon', 'evening', 'late night']
  const timeGroups: Record<string, number[]> = {}
  ratings.forEach(r => {
    if (!r.visit_time) return
    const slot = r.visit_time.toLowerCase()
    if (!timeGroups[slot]) timeGroups[slot] = []
    timeGroups[slot].push(r.fill_level)
  })
  const timeSlotData = TIME_SLOTS.map(slot => {
    const fills = timeGroups[slot]
    const avg = fills ? Math.round(fills.reduce((s, f) => s + f, 0) / fills.length) : null
    return {
      slot,
      label: slot === 'late night' ? 'Late Night' : slot.charAt(0).toUpperCase() + slot.slice(1),
      avg,
      count: fills?.length ?? 0,
    }
  })
  const validSlots = timeSlotData.filter(s => s.avg !== null)
  const topSlot = validSlots.length ? validSlots.reduce((a, b) => (a.avg! > b.avg! ? a : b)) : null
  const weakSlot = validSlots.length ? validSlots.reduce((a, b) => (a.avg! < b.avg! ? a : b)) : null
  const slotGap = topSlot && weakSlot && topSlot !== weakSlot ? topSlot.avg! - weakSlot.avg! : 0

  // Drinks
  const drinkGroups: Record<string, number[]> = {}
  ratings.forEach(r => {
    if (!r.drink_name) return
    if (!drinkGroups[r.drink_name]) drinkGroups[r.drink_name] = []
    drinkGroups[r.drink_name].push(r.fill_level)
  })
  const topDrinks = Object.entries(drinkGroups)
    .map(([name, fills]) => {
      const avg = fills.reduce((s, f) => s + f, 0) / fills.length
      const drinkVar = fills.length > 1 ? fills.reduce((s, f) => s + Math.pow(f - avg, 2), 0) / fills.length : 0
      return { name, count: fills.length, avgFill: Math.round(avg), variance: drinkVar }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  const topDrink = topDrinks[0] ?? null
  const mostVolatileDrink = topDrinks.length ? [...topDrinks].sort((a, b) => b.variance - a.variance)[0] : null

  // Vibes
  const vibeCounts: Record<string, number> = {}
  ratings.forEach(r => {
    const tags = Array.isArray(r.vibe_tags) ? r.vibe_tags : []
    tags.forEach((tag: string) => { vibeCounts[tag] = (vibeCounts[tag] || 0) + 1 })
  })
  const topVibes = Object.entries(vibeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

  // Distribution
  const BUCKETS = [
    { label: '0–20', min: 0, max: 20 },
    { label: '21–40', min: 21, max: 40 },
    { label: '41–60', min: 41, max: 60 },
    { label: '61–80', min: 61, max: 80 },
    { label: '81–100', min: 81, max: 100 },
  ]
  const bucketCounts = BUCKETS.map(b => ({
    ...b,
    count: ratings.filter(r => r.fill_level >= b.min && r.fill_level <= b.max).length,
    active: avgFill >= b.min && avgFill <= b.max,
  }))
  const maxBucketCount = Math.max(...bucketCounts.map(b => b.count), 1)

  // Period label
  const periodLabel =
    reportType === 'weekly' ? 'Weekly · Last 7 days'
    : reportType === 'monthly' ? `Monthly · ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
    : reportType === 'consistency' ? 'Consistency · Last 90 days'
    : `Custom · Last ${monthsBack} month${monthsBack === 1 ? '' : 's'}`

  const sectionTwoHeadline =
    reportType === 'weekly' ? 'this week'
    : reportType === 'monthly' ? now.toLocaleDateString('en-US', { month: 'long' })
    : reportType === 'consistency' ? 'the last 90 days'
    : `the last ${monthsBack} month${monthsBack === 1 ? '' : 's'}`

  // Pull quote
  const ratedWithCaption = ratings.filter(r => r.caption && r.caption.trim())
  const pullQuote =
    ratedWithCaption.length
      ? avgFill < 60
        ? ratedWithCaption.reduce((a, b) => a.fill_level < b.fill_level ? a : b)
        : ratedWithCaption.reduce((a, b) => a.fill_level > b.fill_level ? a : b)
      : null

  // Timeline
  const timelineRatings = [...ratings].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const timelineShown = timelineRatings.slice(0, 50)
  const timelineMore = timelineRatings.length > 50 ? timelineRatings.length - 50 : 0

  // Week-over-week
  const midMs = (new Date(startISO).getTime() + now.getTime()) / 2
  const earlyRatings = ratings.filter(r => new Date(r.created_at).getTime() < midMs)
  const lateRatings = ratings.filter(r => new Date(r.created_at).getTime() >= midMs)
  const earlyAvg = earlyRatings.length ? Math.round(earlyRatings.reduce((s, r) => s + r.fill_level, 0) / earlyRatings.length) : null
  const lateAvg = lateRatings.length ? Math.round(lateRatings.reduce((s, r) => s + r.fill_level, 0) / lateRatings.length) : null

  // Price — drink_price is numeric in Postgres, returned as string by Supabase
  const prices = ratings.filter(r => r.drink_price && Number(r.drink_price) > 0).map(r => Number(r.drink_price))
  const avgPrice = prices.length ? (prices.reduce((s, p) => s + p, 0) / prices.length).toFixed(2) : null

  // Narrative
  const strength = avgFill > 75 ? 'its strongest' : avgFill > 55 ? 'a steady' : 'a quiet'
  const narrative = `With ${n} rating${n === 1 ? '' : 's'} averaging ${avgFill}%, ${shopName} had ${strength} period.`
  const narrativeAppend =
    isTopInCity && shopCity ? ` The shop led ${shopCity}'s independent coffee scene this period.`
    : returnRate > 40 ? ` Repeat customers made up ${returnRate}% of visits, showing strong loyalty.`
    : ''

  // Quote cards (2 highest + 2 lowest fill, from captioned ratings)
  const captionRatings = [...ratedWithCaption].sort((a, b) => b.fill_level - a.fill_level)
  const highQuotes = captionRatings.slice(0, 2)
  const lowQuotes = captionRatings.slice(-2).reverse()
  const quoteCards = [...highQuotes, ...lowQuotes]
    .filter((r, i, arr) => arr.findIndex(x => x === r) === i)
    .slice(0, 4)

  // Actionable steps
  type Step = { headline: string; body: string; weight: number }
  const steps: Step[] = []

  if (consistencyScore < 60) {
    steps.push({
      headline: `Stabilize your ${mostVolatileDrink ? mostVolatileDrink.name : 'drink quality'}`,
      body: 'High variance signals inconsistent recipes. Each 10-point consistency gain typically brings 1–2 more returning customers per week.',
      weight: 5,
    })
  }
  if (weakSlot && weakSlot.count >= 2 && slotGap > 15) {
    const est = Math.round((slotGap / 100) * 4 * n / 4)
    steps.push({
      headline: `Review your ${weakSlot.label} experience`,
      body: `Your ${weakSlot.label} scores drop to ${weakSlot.avg}% — ${slotGap}pts below your best window. That gap costs an estimated $${est} in weekly repeat visits.`,
      weight: est,
    })
  }
  if (returnRate < 40) {
    steps.push({
      headline: 'Build your return reason',
      body: 'Repeat customers cost 5x less to keep than new ones to acquire. A punch card program, signature drink, or loyalty ritual gives people a reason to come back.',
      weight: 4,
    })
  }
  if (topDrink && topDrink.avgFill > 80 && topDrink.count >= 3) {
    steps.push({
      headline: `Feature your ${topDrink.name}`,
      body: `It's your highest-rated drink at ${topDrink.avgFill}%. Making it your signature protects your best revenue driver and gives customers a reason to recommend you.`,
      weight: 3,
    })
  }
  const atmoVibes = ['quiet', 'cozy', 'warm']
  const matchingVibe = topVibes.find(([tag]) => atmoVibes.some(v => tag.toLowerCase().includes(v)))
  if (matchingVibe) {
    steps.push({
      headline: 'Lean into your atmosphere',
      body: `Your customers describe you as ${matchingVibe[0]}. That's a moat chains can't replicate — feature it in your Social Brew profile and on signage.`,
      weight: 2,
    })
  }
  steps.push({
    headline: 'Encourage more Social Brew reviews',
    body: `Each new rating improves your Trending tab ranking and puts your shop in front of more coffee lovers${shopCity ? ` in ${shopCity}` : ''}.`,
    weight: 1,
  })
  const topSteps = steps.sort((a, b) => b.weight - a.weight).slice(0, 5)

  const consistencyColors: Record<string, string> = {
    Poor: 'bg-red-50 text-red-600 border-red-200',
    Fair: 'bg-amber-50 text-amber-600 border-amber-200',
    Steady: 'bg-yellow-50 text-caramel border-yellow-200',
    Pristine: 'bg-green-50 text-green-600 border-green-200',
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-cream-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-cream-50 overflow-y-auto">
      <button
        onClick={onClose}
        className="sticky top-0 z-10 flex items-center gap-1.5 bg-cream-50/95 backdrop-blur px-4 py-3 text-caramel text-sm font-medium w-full border-b border-cream-200"
      >
        ← Back to Reports
      </button>

      <div className="max-w-2xl mx-auto px-4 pb-16 space-y-10">

        {/* ── SECTION 1: COVER ─────────────────────────────────────────── */}
        <section className="bg-cream-100 rounded-3xl p-6 text-center mt-4">
          <p className="text-caramel text-xs font-semibold tracking-widest mb-4">SOCIAL BREW</p>
          <h1 className="font-display text-2xl font-black text-coffee-900 mb-1">FIELD REPORT</h1>
          <p className="text-coffee-500 text-sm mb-1">from {shopName}</p>
          <p className="text-coffee-400 text-xs mb-6">{periodLabel}</p>

          <div className="flex justify-center mb-6">
            <MiniMug fill={avgFill} size={80} />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { label: '01 At a Glance', value: `${avgFill}/100` },
              { label: '02 Consistency', value: `${consistencyScore}/100` },
              {
                label: '03 Hours & Drinks',
                value: [topSlot?.label, topDrink?.name].filter(Boolean).join(' · ') || '—',
              },
              { label: '04 Voices & Verdict', value: `${returnRate}% return` },
            ].map(pill => (
              <div key={pill.label} className="bg-white rounded-2xl px-3 py-3 text-center border border-cream-200">
                <p className="text-coffee-400 text-xs mb-1">{pill.label}</p>
                <p className="text-coffee-800 font-bold text-sm leading-tight">{pill.value}</p>
              </div>
            ))}
          </div>

          {pullQuote && (
            <p className="text-coffee-600 italic text-base leading-relaxed">
              "{pullQuote.caption}"
            </p>
          )}
        </section>

        {/* ── SECTION 2: SHAPE OF PERIOD ───────────────────────────────── */}
        <section>
          <h2 className="font-display text-xl font-bold text-coffee-900 mb-1">
            The shape of {sectionTwoHeadline}, at a glance.
          </h2>

          <div className="grid grid-cols-4 gap-2 mb-5">
            {[
              { label: 'Ratings', value: n.toString() },
              { label: 'Avg Fill', value: `${avgFill}%` },
              { label: 'Visitors', value: uniqueVisitors.toString() },
              { label: 'Return', value: `${returnRate}%` },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-3 text-center border border-cream-200">
                <p className="text-coffee-800 font-bold text-lg">{s.value}</p>
                <p className="text-coffee-400 text-xs">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <p className="text-coffee-500 text-xs font-medium mb-2">Rating timeline</p>
            <div className="flex gap-1 overflow-x-auto pb-2 items-end">
              {timelineShown.map((r, i) => (
                <MiniMug key={i} fill={r.fill_level} size={28} />
              ))}
              {timelineMore > 0 && (
                <span className="text-coffee-400 text-xs self-end ml-1 whitespace-nowrap">+{timelineMore} more</span>
              )}
              {timelineShown.length === 0 && (
                <span className="text-coffee-400 text-xs">No ratings this period</span>
              )}
            </div>
          </div>

          {isTopInCity && shopCity && (
            <div className="inline-flex items-center gap-1.5 bg-caramel/10 text-caramel border border-caramel/20 px-3 py-1.5 rounded-full text-xs font-semibold mb-4">
              ☕ #1 most-visited independent in {shopCity}
            </div>
          )}

          <p className="text-coffee-600 text-sm leading-relaxed">{narrative}{narrativeAppend}</p>
        </section>

        {/* ── SECTION 3: FIXABLE AXIS ──────────────────────────────────── */}
        <section>
          <h2 className="font-display text-xl font-bold text-coffee-900 mb-1">The fixable axis.</h2>
          <p className="text-coffee-400 text-sm mb-5">Consistency is the quiet driver of revenue.</p>

          <div className="text-center mb-6">
            <div className="flex items-baseline justify-center gap-1">
              <span className="font-display text-7xl font-black text-coffee-900">{consistencyScore}</span>
              <span className="text-coffee-400 text-2xl">/100</span>
            </div>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-bold border ${consistencyColors[consistencyLabel] ?? 'bg-cream-100 text-coffee-500 border-cream-200'}`}>
              {consistencyLabel}
            </span>
            <p className="text-coffee-400 text-xs mt-2">Standard deviation: {stdDev.toFixed(1)} pts</p>
          </div>

          <div className="flex items-end justify-between gap-1 mb-3" style={{ height: 160 }}>
            {bucketCounts.map(b => (
              <div key={b.label} className="flex-1 flex flex-col items-center justify-end gap-1">
                <span className="text-coffee-600 text-xs font-medium">{b.count}</span>
                <div
                  className={`w-full rounded-t-lg ${b.active ? 'bg-caramel' : 'bg-cream-300'}`}
                  style={{ height: Math.max(4, (b.count / maxBucketCount) * 120) }}
                />
                <span className="text-coffee-400 text-xs">{b.label}</span>
              </div>
            ))}
          </div>

          {ratings.length >= 14 && earlyAvg !== null && lateAvg !== null && (
            <div className="bg-cream-100 rounded-2xl px-4 py-3 mb-4 text-sm text-coffee-600">
              Earlier in the period: <span className="font-semibold">{earlyAvg}%</span> avg → Recent: <span className="font-semibold">{lateAvg}%</span> avg
            </div>
          )}

          <div className="bg-amber-50 border border-caramel/30 rounded-2xl px-4 py-4 mb-4 text-sm text-coffee-700 leading-relaxed">
            Shops with a Consistency score above 70 see an average 23% higher return rate. Reducing variance by 10 points typically means 1–2 more returning customers per week.
          </div>

          {consistencyScore < 60 && mostVolatileDrink && mostVolatileDrink.variance > 0 && (
            <p className="text-sm text-coffee-500 leading-relaxed">
              Your <span className="font-semibold text-coffee-700">{mostVolatileDrink.name}</span> shows the most variation. Standardizing its recipe could lift your score by approximately {Math.round(Math.sqrt(mostVolatileDrink.variance) * 1.5)} points.
            </p>
          )}
        </section>

        {/* ── SECTION 4: WHEN THEY CAME ────────────────────────────────── */}
        <section>
          <h2 className="font-display text-xl font-bold text-coffee-900 mb-5">When they came, what they ordered.</h2>

          <div className="grid grid-cols-2 gap-2 mb-6">
            {timeSlotData.map(slot => (
              <div
                key={slot.slot}
                className={`rounded-2xl p-4 border relative overflow-hidden ${slot.avg !== null ? 'bg-white border-cream-200' : 'bg-cream-100 border-cream-200'}`}
              >
                {slot.avg !== null && (
                  <div className="absolute inset-y-0 left-0 bg-caramel/6 rounded-2xl" style={{ width: `${slot.avg}%` }} />
                )}
                <p className="font-bold text-coffee-900 text-2xl relative z-10">{slot.avg !== null ? `${slot.avg}%` : '—'}</p>
                <p className="text-coffee-400 text-xs relative z-10">{slot.label}</p>
              </div>
            ))}
          </div>

          {topDrinks.length > 0 && (
            <div className="mb-5">
              <p className="text-coffee-500 text-xs font-medium mb-2">Top drinks</p>
              <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden divide-y divide-cream-100">
                {topDrinks.map((drink, i) => (
                  <div key={drink.name} className={`flex items-center gap-3 px-4 py-3 ${i === 0 ? 'bg-caramel/5' : ''}`}>
                    <span className="text-coffee-400 text-xs font-bold w-5">#{i + 1}</span>
                    <span className="flex-1 text-coffee-800 text-sm font-medium truncate">{drink.name}</span>
                    <span className="text-coffee-400 text-xs">{drink.count}×</span>
                    <span className="text-coffee-700 text-sm font-semibold">{drink.avgFill}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {avgPrice && (
            <p className="text-coffee-500 text-sm mb-5">
              Average spend: <span className="font-semibold text-coffee-700">${avgPrice}</span>
            </p>
          )}

          {weakSlot && topSlot && weakSlot !== topSlot && slotGap > 15 && weakSlot.count >= 2 && (
            <div className="bg-amber-50 border border-caramel/30 rounded-2xl px-4 py-4 mb-5 text-sm text-coffee-700 leading-relaxed">
              Your {weakSlot.label} experience scores {weakSlot.avg}% — {slotGap}pts below your peak.
              Closing that gap is worth an estimated ${Math.round((slotGap / 100) * 4 * n / 4)} in weekly repeat visits.
            </div>
          )}

          {topVibes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {topVibes.map(([tag, count]) => (
                <span key={tag} className="bg-cream-100 text-coffee-600 border border-cream-200 text-xs font-medium px-3 py-1.5 rounded-full">
                  {tag} <span className="text-coffee-400">×{count}</span>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ── SECTION 5: WHAT THEY SAID ────────────────────────────────── */}
        <section>
          <h2 className="font-display text-xl font-bold text-coffee-900 mb-5">What they said. What to do.</h2>

          {quoteCards.length > 0 && (
            <div className="space-y-3 mb-8">
              {quoteCards.map((r, i) => (
                <div key={i} className="bg-white border-l-4 border-caramel rounded-r-2xl px-4 py-3">
                  <p className="italic text-coffee-700 text-sm leading-relaxed">"{r.caption}"</p>
                  <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${r.fill_level >= 60 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
                    {r.fill_level}%
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="text-center mb-8">
            <p className="font-display text-5xl font-black text-coffee-900">{returnRate}%</p>
            <p className="text-coffee-500 text-sm mt-1">return rate</p>
            <p className="text-coffee-400 text-xs mt-0.5">
              {returnVisitors} in {uniqueVisitors} customers came back this period
            </p>
          </div>

          <div>
            <p className="font-display font-bold text-coffee-900 text-lg mb-4">What to do.</p>
            <div className="space-y-4">
              {topSteps.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-caramel text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-coffee-800 text-sm">{step.headline}</p>
                    <p className="text-coffee-500 text-sm leading-relaxed mt-0.5">{step.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-coffee-300 text-xs mt-12">☕ Social Brew · Independent coffee, only.</p>
        </section>
      </div>
    </div>
  )
}
