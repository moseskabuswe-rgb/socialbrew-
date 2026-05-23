import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { type AdminTab } from '../AdminLayout'

interface Props {
  pending: { claims: number; edits: number; shopPosts: number; reports: number }
  onNavigate: (tab: AdminTab) => void
  isAdmin?: boolean
  isViewer?: boolean
}

interface Stats {
  users: number
  ratings: number
  shops: number
  reports: number
}

interface TopShop {
  shop_id: string
  shop_name: string
  count: number
}

export default function OverviewTab({ pending, onNavigate, isViewer }: Props) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [topShops, setTopShops] = useState<TopShop[]>([])
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    async function load() {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const [users, ratings, shops, reports, shopReports, weekRatings] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('ratings').select('id', { count: 'exact', head: true }),
        supabase.from('coffee_shops').select('id', { count: 'exact', head: true }),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false),
        supabase.from('shop_post_reports').select('id', { count: 'exact', head: true }).eq('resolved', false),
        supabase.from('ratings').select('shop_id, coffee_shops(name)').gte('created_at', weekAgo).limit(500),
      ])

      setStats({
        users: users.count || 0,
        ratings: ratings.count || 0,
        shops: shops.count || 0,
        reports: (reports.count || 0) + (shopReports.count || 0),
      })

      // Aggregate top shops client-side
      const tally: Record<string, { name: string; count: number }> = {}
      for (const r of weekRatings.data || []) {
        const id = r.shop_id
        const name = (r.coffee_shops as any)?.name || 'Unknown'
        if (!tally[id]) tally[id] = { name, count: 0 }
        tally[id].count++
      }
      const sorted = Object.entries(tally)
        .map(([shop_id, v]) => ({ shop_id, shop_name: v.name, count: v.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
      setTopShops(sorted)
      setLoadingStats(false)
    }
    load()
  }, [])

  const totalPending = pending.claims + pending.edits + pending.shopPosts + pending.reports

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-0.5">Platform health at a glance</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Users', value: stats?.users },
          { label: 'Ratings', value: stats?.ratings },
          { label: 'Shops', value: stats?.shops },
          { label: 'Open Reports', value: stats?.reports, highlight: (stats?.reports || 0) > 0 },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">{card.label}</p>
            {loadingStats ? (
              <div className="h-7 w-12 bg-gray-200 rounded animate-pulse" />
            ) : (
              <p className={`text-2xl font-bold ${card.highlight ? 'text-red-500' : 'text-gray-900'}`}>
                {card.value?.toLocaleString() ?? '—'}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Pending actions — hidden for viewers */}
      {totalPending > 0 && !isViewer && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-amber-900 text-sm">
                {totalPending} item{totalPending !== 1 ? 's' : ''} need attention
              </p>
              <div className="text-xs text-amber-700 mt-1 space-x-3">
                {pending.claims > 0 && <span>{pending.claims} claim{pending.claims !== 1 ? 's' : ''}</span>}
                {pending.edits > 0 && <span>{pending.edits} edit{pending.edits !== 1 ? 's' : ''}</span>}
                {pending.shopPosts > 0 && <span>{pending.shopPosts} post{pending.shopPosts !== 1 ? 's' : ''}</span>}
                {pending.reports > 0 && <span>{pending.reports} report{pending.reports !== 1 ? 's' : ''}</span>}
              </div>
            </div>
            <button
              onClick={() => onNavigate(pending.reports > 0 && (pending.claims + pending.edits + pending.shopPosts) === 0 ? 'reports' : 'approvals')}
              className="px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 transition-colors"
            >
              Review all
            </button>
          </div>
        </div>
      )}

      {/* Top shops this week */}
      <div className="bg-white rounded-xl border border-gray-100">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="font-medium text-gray-900 text-sm">Top shops this week</p>
        </div>
        {loadingStats ? (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        ) : topShops.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No ratings this week</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {topShops.map((shop, i) => (
              <div key={shop.shop_id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-5 text-xs font-bold text-gray-300 text-right">{i + 1}</span>
                <span className="flex-1 text-sm text-gray-800 truncate">{shop.shop_name}</span>
                <span className="text-xs text-gray-500">{shop.count} rating{shop.count !== 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
