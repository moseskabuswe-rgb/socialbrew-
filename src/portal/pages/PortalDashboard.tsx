import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

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

function MiniMug({ fill, size = 48 }: { fill: number; size?: number }) {
  const color = getMugColor(fill)
  const id = `dash-mug-${fill}-${size}`
  return (
    <svg viewBox="0 0 56 68" width={size} height={size * 1.2}>
      <defs><clipPath id={id}><rect x="5" y="12" width="38" height="46" rx="5" /></clipPath></defs>
      <rect x="5" y="12" width="38" height="46" rx="5" fill="#f7f0e4" stroke="#c8b090" strokeWidth="1.5" />
      <g clipPath={`url(#${id})`}>
        <rect x="5" y={58 - (46 * fill / 100)} width="38" height={46 * fill / 100} fill={color} />
      </g>
      <rect x="3" y="8" width="42" height="8" rx="4" fill="#d4b890" />
      <path d="M43 22 Q56 22 56 33 Q56 44 43 44" stroke="#c8b090" strokeWidth="5" fill="none" strokeLinecap="round" />
      <ellipse cx="24" cy="58" rx="19" ry="5" fill="#e8ddc8" />
    </svg>
  )
}

export default function PortalDashboard({ shop }: Props) {
  const [stats, setStats] = useState({ followers: 0, thisWeek: 0, total: shop.total_ratings })
  const [fillBuckets, setFillBuckets] = useState<{ label: string; pct: number; color: string }[]>([])
  const [topVibes, setTopVibes] = useState<{ tag: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const [followRes, weekRes, ratingRes] = await Promise.all([
        supabase.from('shop_follows').select('user_id', { count: 'exact', head: true }).eq('shop_id', shop.id),
        supabase.from('ratings').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id).gte('created_at', weekAgo),
        supabase.from('ratings').select('fill_level,vibe_tags').eq('shop_id', shop.id),
      ])

      setStats({
        followers: followRes.count || 0,
        thisWeek: weekRes.count || 0,
        total: ratingRes.data?.length || 0,
      })

      if (ratingRes.data && ratingRes.data.length > 0) {
        const buckets = [
          { label: '0–20%', min: 0, max: 20, color: '#b0c4d4' },
          { label: '21–40%', min: 21, max: 40, color: '#c8924a' },
          { label: '41–60%', min: 41, max: 60, color: '#a06428' },
          { label: '61–80%', min: 61, max: 80, color: '#7a3e10' },
          { label: '81–100%', min: 81, max: 100, color: '#4e2008' },
        ]
        const total = ratingRes.data.length
        setFillBuckets(buckets.map(b => ({
          label: b.label,
          color: b.color,
          pct: Math.round((ratingRes.data!.filter(r => r.fill_level >= b.min && r.fill_level <= b.max).length / total) * 100),
        })))

        const vibeCounts: Record<string, number> = {}
        ratingRes.data.forEach(r => {
          if (Array.isArray(r.vibe_tags)) {
            r.vibe_tags.forEach((v: string) => { vibeCounts[v] = (vibeCounts[v] || 0) + 1 })
          }
        })
        const sorted = Object.entries(vibeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
        setTopVibes(sorted.map(([tag, count]) => ({ tag, count })))
      }

      setLoading(false)
    }
    load()
  }, [shop.id])

  const avgFill = shop.avg_fill || 0

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{shop.name}</h1>
        {(shop.city || shop.state) && (
          <p className="text-sm text-gray-400 mt-0.5">{[shop.city, shop.state].filter(Boolean).join(', ')}</p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Followers', value: stats.followers, icon: '❤️' },
          { label: 'This week', value: stats.thisWeek, icon: '☕' },
          { label: 'All-time reviews', value: stats.total, icon: '⭐' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <p className="text-xl mb-1">{s.icon}</p>
            <p className="text-2xl font-bold text-gray-900">{s.value.toLocaleString()}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Avg fill */}
      {avgFill > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex items-center gap-5">
          <MiniMug fill={avgFill} size={52} />
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-wide font-medium mb-0.5">Average rating</p>
            <p className="text-2xl font-bold text-gray-900">{avgFill}%</p>
            <p className="text-sm text-gray-500">{getFillLabel(avgFill)}</p>
          </div>
        </div>
      )}

      {!loading && fillBuckets.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Rating breakdown</p>
          <div className="space-y-2">
            {fillBuckets.map(b => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-14 flex-shrink-0">{b.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${b.pct}%`, background: b.color }} />
                </div>
                <span className="text-xs text-gray-500 w-8 text-right">{b.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {topVibes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Top vibes from customers</p>
          <div className="flex flex-wrap gap-2">
            {topVibes.map(v => (
              <span key={v.tag} className="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded-full text-xs font-medium">
                {v.tag} · {v.count}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
        </div>
      )}
    </div>
  )
}
