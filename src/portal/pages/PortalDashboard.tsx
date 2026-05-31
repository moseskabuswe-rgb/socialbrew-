import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { PortalTab } from '../PortalApp'

interface Shop {
  id: string
  name: string
  city: string | null
  state: string | null
  photo_url: string | null
  avg_fill: number
  total_ratings: number
}

interface Props {
  shop: Shop
  onNavigate?: (tab: PortalTab) => void
}

type Range = '7d' | '30d' | 'all'

interface RecentRating {
  id: string
  fill_level: number
  vibe_tags: string[] | null
  created_at: string
  profiles: { username: string; avatar_url: string | null } | null
}

function getMugColor(fill: number) {
  if (fill <= 20) return '#b0c4d4'
  if (fill <= 40) return '#c8924a'
  if (fill <= 60) return '#a06428'
  if (fill <= 80) return '#7a3e10'
  return '#4e2008'
}

function getFillLabel(fill: number) {
  if (fill <= 20) return 'Just a Sip'
  if (fill <= 40) return 'Getting There'
  if (fill <= 60) return 'Half Cup'
  if (fill <= 80) return 'Good Pour'
  if (fill <= 95) return 'Almost Perfect'
  return 'Perfect Brew ✨'
}

function FillMug({ fill, size = 52 }: { fill: number; size?: number }) {
  const color = getMugColor(fill)
  const id = `fill-mug-${fill}`
  return (
    <svg viewBox="0 0 56 68" width={size} height={Math.round(size * 1.2)} style={{ flexShrink: 0 }}>
      <defs><clipPath id={id}><rect x="5" y="12" width="38" height="46" rx="5" /></clipPath></defs>
      <rect x="5" y="12" width="38" height="46" rx="5" fill="#fdf0dc" stroke="#e8c88a" strokeWidth="1.5" />
      <g clipPath={`url(#${id})`}>
        <rect x="5" y={58 - (46 * fill / 100)} width="38" height={46 * fill / 100} fill={color} />
      </g>
      <rect x="3" y="8" width="42" height="8" rx="4" fill="#e8c88a" />
      <path d="M43 22 Q56 22 56 33 Q56 44 43 44" stroke="#e8c88a" strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="24" cy="58" rx="19" ry="5" fill="#f5e4c0" />
    </svg>
  )
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

export default function PortalDashboard({ shop, onNavigate }: Props) {
  const [range, setRange] = useState<Range>('7d')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalFollowers: 0,
    periodFollowers: 0,
    periodReviews: 0,
    totalLikes: 0,
    totalComments: 0,
    activePunchHolders: 0,
    activeStories: 0,
  })
  const [fillBuckets, setFillBuckets] = useState<{ label: string; pct: number; color: string }[]>([])
  const [topVibes, setTopVibes] = useState<{ tag: string; count: number }[]>([])
  const [recentRatings, setRecentRatings] = useState<RecentRating[]>([])

  useEffect(() => { load() }, [shop.id, range])

  async function load() {
    setLoading(true)
    const startDate = range === '7d'
      ? new Date(Date.now() - 7 * 86400000).toISOString()
      : range === '30d'
        ? new Date(Date.now() - 30 * 86400000).toISOString()
        : new Date(0).toISOString()

    const { data: postsData } = await supabase.from('shop_posts').select('id').eq('shop_id', shop.id)
    const postIds = (postsData || []).map((p: any) => p.id)

    const [
      followTotalRes,
      followPeriodRes,
      reviewPeriodRes,
      ratingAllRes,
      likesRes,
      commentsRes,
      punchRes,
      storiesRes,
      recentRes,
    ] = await Promise.all([
      supabase.from('shop_follows').select('user_id', { count: 'exact', head: true }).eq('shop_id', shop.id),
      supabase.from('shop_follows').select('user_id', { count: 'exact', head: true }).eq('shop_id', shop.id).gte('created_at', startDate),
      supabase.from('ratings').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).gte('created_at', startDate),
      supabase.from('ratings').select('fill_level,vibe_tags').eq('shop_id', shop.id),
      postIds.length > 0
        ? supabase.from('shop_post_likes').select('post_id', { count: 'exact', head: true }).in('post_id', postIds)
        : Promise.resolve({ count: 0 }),
      postIds.length > 0
        ? supabase.from('shop_post_comments').select('post_id', { count: 'exact', head: true }).in('post_id', postIds)
        : Promise.resolve({ count: 0 }),
      supabase.from('user_punches').select('user_id', { count: 'exact', head: true }).eq('shop_id', shop.id).gt('current_count', 0),
      supabase.from('stories').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).gt('expires_at', new Date().toISOString()),
      supabase.from('ratings')
        .select('id, fill_level, vibe_tags, created_at, profiles:user_id(username, avatar_url)')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    setStats({
      totalFollowers: followTotalRes.count || 0,
      periodFollowers: followPeriodRes.count || 0,
      periodReviews: reviewPeriodRes.count || 0,
      totalLikes: (likesRes as any).count || 0,
      totalComments: (commentsRes as any).count || 0,
      activePunchHolders: punchRes.count || 0,
      activeStories: storiesRes.count || 0,
    })

    setRecentRatings((recentRes.data as any) || [])

    if (ratingAllRes.data && ratingAllRes.data.length > 0) {
      const buckets = [
        { label: '0–20%', min: 0, max: 20, color: '#b0c4d4' },
        { label: '21–40%', min: 21, max: 40, color: '#c8924a' },
        { label: '41–60%', min: 41, max: 60, color: '#a06428' },
        { label: '61–80%', min: 61, max: 80, color: '#7a3e10' },
        { label: '81–100%', min: 81, max: 100, color: '#4e2008' },
      ]
      const total = ratingAllRes.data.length
      setFillBuckets(buckets.map(b => ({
        label: b.label, color: b.color,
        pct: Math.round((ratingAllRes.data!.filter(r => r.fill_level >= b.min && r.fill_level <= b.max).length / total) * 100),
      })))

      const vibeCounts: Record<string, number> = {}
      ratingAllRes.data.forEach(r => {
        if (Array.isArray(r.vibe_tags)) r.vibe_tags.forEach((v: string) => { vibeCounts[v] = (vibeCounts[v] || 0) + 1 })
      })
      setTopVibes(Object.entries(vibeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([tag, count]) => ({ tag, count })))
    }

    setLoading(false)
  }

  const avgFill = shop.avg_fill || 0
  const rangeLabel = range === '7d' ? 'past 7 days' : range === '30d' ? 'past 30 days' : 'all time'

  const periodCards = [
    { label: 'New reviews', value: stats.periodReviews, sub: rangeLabel, emoji: '⭐', tab: 'mentions' as PortalTab },
    { label: 'New followers', value: stats.periodFollowers, sub: rangeLabel, emoji: '❤️', tab: null },
    { label: 'Post likes', value: stats.totalLikes, sub: 'all time', emoji: '👍', tab: 'posts' as PortalTab },
    { label: 'Comments', value: stats.totalComments, sub: 'all time', emoji: '💬', tab: 'posts' as PortalTab },
    { label: 'Punch holders', value: stats.activePunchHolders, sub: 'active now', emoji: '🎫', tab: 'punchcard' as PortalTab },
    ...(stats.activeStories > 0
      ? [{ label: 'Live stories', value: stats.activeStories, sub: 'active now', emoji: '📸', tab: 'stories' as PortalTab }]
      : []),
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-6">

      {/* ── Shop header card ── */}
      <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
        {/* Caramel accent stripe */}
        <div className="h-1.5" style={{ background: 'linear-gradient(90deg, #c8853a 0%, #e8b06a 50%, #c8853a 100%)' }} />

        <div className="flex items-center justify-between px-5 py-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {shop.photo_url ? (
              <img src={shop.photo_url} className="w-13 h-13 rounded-full object-cover flex-shrink-0 border-2 border-cream-200" style={{ width: 52, height: 52 }} />
            ) : (
              <div className="w-13 h-13 rounded-full flex items-center justify-center flex-shrink-0 text-2xl border-2 border-cream-200 bg-cream-50" style={{ width: 52, height: 52 }}>☕</div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-coffee-900 text-lg leading-tight truncate">{shop.name}</h1>
              {(shop.city || shop.state) && (
                <p className="text-sm text-coffee-400 mt-0.5">{[shop.city, shop.state].filter(Boolean).join(', ')}</p>
              )}
              {avgFill > 0 && (
                <p className="text-xs text-caramel font-medium mt-0.5">{getFillLabel(avgFill)} · {avgFill}% avg fill</p>
              )}
            </div>
          </div>

          {/* Social Brew logo — the real one */}
          <div className="flex-shrink-0 rounded-xl overflow-hidden border border-cream-200 shadow-sm" style={{ width: 52, height: 52 }}>
            <img src="/icon-192.png" alt="Social Brew" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>

        {/* At-a-glance totals */}
        <div className="grid grid-cols-4 border-t border-cream-100">
          {[
            { n: stats.totalFollowers, l: 'followers' },
            { n: shop.total_ratings, l: 'reviews' },
            { n: stats.totalLikes, l: 'post likes' },
            { n: stats.activePunchHolders, l: 'punch cards' },
          ].map((item, i) => (
            <div
              key={i}
              className="text-center py-3 px-1"
              style={{ borderRight: i < 3 ? '1px solid #f0e8d8' : undefined }}
            >
              <p className="font-bold text-coffee-800 text-base leading-none">{item.n.toLocaleString()}</p>
              <p className="text-[11px] text-coffee-400 mt-1 leading-none">{item.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Range selector ── */}
      <div className="flex bg-cream-100 rounded-xl p-1 gap-1">
        {(['7d', '30d', 'all'] as Range[]).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              range === r
                ? 'bg-white text-caramel shadow-sm'
                : 'text-coffee-500 hover:text-coffee-700'
            }`}
          >
            {r === '7d' ? 'Last 7 days' : r === '30d' ? 'Last 30 days' : 'All time'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Period stat cards ── */}
          <div className="grid grid-cols-2 gap-3">
            {periodCards.map(card => (
              <button
                key={card.label}
                onClick={() => card.tab && onNavigate?.(card.tab)}
                className={`bg-white rounded-xl border border-cream-200 p-4 text-left transition-all ${
                  card.tab
                    ? 'hover:border-caramel/50 hover:shadow-sm active:scale-[0.98] cursor-pointer'
                    : 'cursor-default'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-coffee-400 uppercase tracking-wide leading-none">
                    {card.label}
                  </span>
                  <span className="text-base leading-none">{card.emoji}</span>
                </div>
                <p className="text-2xl font-bold text-coffee-900 leading-none">{card.value.toLocaleString()}</p>
                <p className="text-xs text-coffee-300 mt-1.5">{card.sub}</p>
                {card.tab && (
                  <p className="text-[10px] text-caramel mt-1 font-medium">Tap to view →</p>
                )}
              </button>
            ))}
          </div>

          {/* ── Avg fill + breakdown ── */}
          {avgFill > 0 && (
            <div className="bg-white rounded-xl border border-cream-200 p-5">
              <p className="text-[11px] font-semibold text-coffee-400 uppercase tracking-wide mb-4">
                Average fill rating
              </p>
              <div className="flex items-start gap-5">
                <div className="flex flex-col items-center gap-1.5">
                  <FillMug fill={avgFill} size={52} />
                  <p className="text-xl font-bold text-coffee-900 leading-none">{avgFill}%</p>
                  <p className="text-xs text-coffee-400 text-center">{getFillLabel(avgFill)}</p>
                </div>

                {fillBuckets.length > 0 && (
                  <div className="flex-1 space-y-2 pt-1">
                    {fillBuckets.map(b => (
                      <div key={b.label} className="flex items-center gap-2">
                        <span className="text-[10px] text-coffee-400 w-12 flex-shrink-0">{b.label}</span>
                        <div className="flex-1 bg-cream-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${b.pct}%`, background: b.color }}
                          />
                        </div>
                        <span className="text-[10px] text-coffee-400 w-7 text-right">{b.pct}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Top vibes ── */}
          {topVibes.length > 0 && (
            <div className="bg-white rounded-xl border border-cream-200 p-4">
              <p className="text-[11px] font-semibold text-coffee-400 uppercase tracking-wide mb-3">
                Top vibes from customers
              </p>
              <div className="flex flex-wrap gap-2">
                {topVibes.map((v, i) => (
                  <span
                    key={v.tag}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border"
                    style={i === 0
                      ? { background: '#fdf0dc', color: '#9b5e1a', borderColor: '#e8c88a' }
                      : { background: '#f9f5f0', color: '#7a5030', borderColor: '#ede0cc' }
                    }
                  >
                    {v.tag} <span style={{ opacity: 0.5 }}>· {v.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Recent reviews ── */}
          {recentRatings.length > 0 && (
            <div className="bg-white rounded-xl border border-cream-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-coffee-400 uppercase tracking-wide">
                  Recent reviews
                </p>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('mentions')}
                    className="text-xs text-caramel font-semibold hover:underline"
                  >
                    See all →
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {recentRatings.map(r => (
                  <div key={r.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-cream-100 flex-shrink-0 flex items-center justify-center overflow-hidden border border-cream-200">
                      {r.profiles?.avatar_url
                        ? <img src={r.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <span className="text-xs font-bold text-coffee-400">
                            {r.profiles?.username?.[0]?.toUpperCase() ?? '?'}
                          </span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-coffee-700">
                          {r.profiles?.username ?? 'Customer'}
                        </span>
                        <span className="text-coffee-200">·</span>
                        <span className="text-xs text-coffee-400">{timeAgo(r.created_at)}</span>
                      </div>
                      {r.vibe_tags && r.vibe_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {r.vibe_tags.slice(0, 3).map(tag => (
                            <span
                              key={tag}
                              className="text-[10px] px-1.5 py-0.5 rounded-full"
                              style={{ background: '#fdf0dc', color: '#9b5e1a' }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="w-3 h-3 rounded-sm" style={{ background: getMugColor(r.fill_level) }} />
                      <span className="text-xs font-semibold text-coffee-600">{r.fill_level}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
