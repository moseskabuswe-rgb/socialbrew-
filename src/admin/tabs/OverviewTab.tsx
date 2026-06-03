import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { type AdminTab } from '../AdminLayout'

interface Props {
  pending: { claims: number; edits: number; reports: number; punchCards: number }
  onNavigate: (tab: AdminTab) => void
  isAdmin?: boolean
  isViewer?: boolean
}

interface Stats {
  users: number
  ratings: number
  shops: number
  reports: number
  activePunchCards: number
  punchRedemptions: number
  foundingPartners: number
  newUsersWeek: number
  newUsersMonth: number
  brewsWeek: number
  brewsMonth: number
  totalFollows: number
  postsWeek: number
  totalPosts: number
  claimedShops: number
}

interface TopShop { shop_id: string; shop_name: string; count: number }
interface FollowedShop { name: string; followers: number }
interface GeoEntry { label: string; count: number }

const FULL_TO_ABBREV: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
  Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH',
  'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
  'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA',
  'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN',
  Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA',
  'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
}

const US_ABBREVS = new Set(Object.values(FULL_TO_ABBREV))
const US_FULL_NAMES = new Set(Object.keys(FULL_TO_ABBREV))

// Values that appear in the state column but are actually countries
const STATE_AS_COUNTRY: Record<string, string> = {
  Indonesia: 'Indonesia',
  Bali: 'Indonesia',
  Turkey: 'Turkey',
  Germany: 'Germany',
  France: 'France',
  Australia: 'Australia',
  Canada: 'Canada',
  Mexico: 'Mexico',
  'United Kingdom': 'United Kingdom',
  UK: 'United Kingdom',
  Japan: 'Japan',
  India: 'India',
  Brazil: 'Brazil',
  Thailand: 'Thailand',
  'Udon Thani': 'Thailand',
  Sonora: 'Mexico',
}

const COUNTRY_TO_CONTINENT: Record<string, string> = {
  'United States': 'North America',
  Canada: 'North America',
  Mexico: 'North America',
  'United Kingdom': 'Europe',
  Germany: 'Europe',
  France: 'Europe',
  Netherlands: 'Europe',
  Spain: 'Europe',
  Italy: 'Europe',
  Turkey: 'Europe',
  Indonesia: 'Asia',
  Japan: 'Asia',
  India: 'Asia',
  Thailand: 'Asia',
  China: 'Asia',
  'South Korea': 'Asia',
  'Saudi Arabia': 'Asia',
  UAE: 'Asia',
  Australia: 'Oceania',
  'New Zealand': 'Oceania',
  Brazil: 'South America',
  Argentina: 'South America',
  Colombia: 'South America',
  Kenya: 'Africa',
  Ethiopia: 'Africa',
  'South Africa': 'Africa',
}

function normalizeState(s: string | null): string | null {
  if (!s) return null
  const t = s.trim()
  return FULL_TO_ABBREV[t] ?? (t.length <= 4 ? t.toUpperCase() : t)
}

function inferCountry(state: string | null, country: string | null): string | null {
  if (country) return country
  if (!state) return null
  const t = state.trim()
  if (US_ABBREVS.has(t.toUpperCase()) || US_FULL_NAMES.has(t)) return 'United States'
  if (STATE_AS_COUNTRY[t]) return STATE_AS_COUNTRY[t]
  return null
}

function inferContinent(country: string | null, continent: string | null): string | null {
  if (continent) return continent
  if (!country) return null
  return COUNTRY_TO_CONTINENT[country] ?? null
}

function Skeleton({ w = 'w-12', h = 'h-7' }: { w?: string; h?: string }) {
  return <div className={`${h} ${w} rounded-lg animate-pulse`} style={{ background: '#e8ddc8' }} />
}

function StatCard({
  label, value, sub, loading, accent, icon,
}: {
  label: string; value?: number | string; sub?: string; loading: boolean; accent?: boolean; icon?: string
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1" style={{ background: '#fff', border: '1px solid #e8ddc8' }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium uppercase tracking-wide text-coffee-400">{label}</p>
        {icon && <span className="text-base">{icon}</span>}
      </div>
      {loading ? <Skeleton /> : (
        <p className={`text-2xl font-bold font-display ${accent ? 'text-red-500' : 'text-coffee-900'}`}>
          {typeof value === 'number' ? value.toLocaleString() : (value ?? '—')}
        </p>
      )}
      {sub && <p className="text-xs text-coffee-400">{sub}</p>}
    </div>
  )
}

function GrowthPill({ label, value, loading }: { label: string; value?: number; loading: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#f5ead8', border: '1px solid #e8ddc8' }}>
      {loading ? <Skeleton w="w-8" h="h-5" /> : (
        <span className="text-lg font-bold font-display text-coffee-900">+{value?.toLocaleString() ?? 0}</span>
      )}
      <span className="text-xs text-coffee-500">{label}</span>
    </div>
  )
}

export default function OverviewTab({ pending, onNavigate, isViewer }: Props) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [topShops, setTopShops] = useState<TopShop[]>([])
  const [followedShops, setFollowedShops] = useState<FollowedShop[]>([])
  const [stateBreakdown, setStateBreakdown] = useState<GeoEntry[]>([])
  const [countryBreakdown, setCountryBreakdown] = useState<GeoEntry[]>([])
  const [continentBreakdown, setContinentBreakdown] = useState<GeoEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const [
        users, ratings, shops, reports, shopReports,
        newUsersWeek, newUsersMonth,
        weekRatings, monthRatings,
        activePunchCards, punchRedemptions, foundingPartners,
        follows, postsWeek, totalPosts, claimedShops,
        followsData, allGeoData,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('ratings').select('id', { count: 'exact', head: true }),
        supabase.from('coffee_shops').select('id', { count: 'exact', head: true }),
        supabase.from('reports').select('id', { count: 'exact', head: true }).eq('resolved', false),
        supabase.from('shop_post_reports').select('id', { count: 'exact', head: true }).eq('resolved', false),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo),
        supabase.from('ratings').select('shop_id, coffee_shops(name)', { count: 'exact' }).gte('created_at', weekAgo).limit(500),
        supabase.from('ratings').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo),
        supabase.from('punch_cards').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('punch_redemptions').select('id', { count: 'exact', head: true }).not('redeemed_at', 'is', null),
        supabase.from('shop_owners').select('id', { count: 'exact', head: true }).eq('founding_partner', true),
        supabase.from('shop_follows').select('id', { count: 'exact', head: true }),
        supabase.from('shop_posts').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('shop_posts').select('id', { count: 'exact', head: true }),
        supabase.from('coffee_shops').select('id', { count: 'exact', head: true }).not('claimed_by', 'is', null),
        supabase.from('shop_follows').select('shop_id, coffee_shops(name)').limit(1000),
        supabase.from('coffee_shops').select('state, country, continent'),
      ])

      setStats({
        users: users.count || 0,
        ratings: ratings.count || 0,
        shops: shops.count || 0,
        reports: (reports.count || 0) + (shopReports.count || 0),
        activePunchCards: activePunchCards.count || 0,
        punchRedemptions: punchRedemptions.count || 0,
        foundingPartners: foundingPartners.count || 0,
        newUsersWeek: newUsersWeek.count || 0,
        newUsersMonth: newUsersMonth.count || 0,
        brewsWeek: weekRatings.count || 0,
        brewsMonth: monthRatings.count || 0,
        totalFollows: follows.count || 0,
        postsWeek: postsWeek.count || 0,
        totalPosts: totalPosts.count || 0,
        claimedShops: claimedShops.count || 0,
      })

      // Top shops this week
      const tally: Record<string, { name: string; count: number }> = {}
      for (const r of weekRatings.data || []) {
        const id = r.shop_id
        const name = (r.coffee_shops as any)?.name || 'Unknown'
        if (!tally[id]) tally[id] = { name, count: 0 }
        tally[id].count++
      }
      setTopShops(
        Object.entries(tally)
          .map(([shop_id, v]) => ({ shop_id, shop_name: v.name, count: v.count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
      )

      // Top followed shops
      const followTally: Record<string, { name: string; count: number }> = {}
      for (const f of followsData.data || []) {
        const id = f.shop_id
        const name = (f.coffee_shops as any)?.name || 'Unknown'
        if (!followTally[id]) followTally[id] = { name, count: 0 }
        followTally[id].count++
      }
      setFollowedShops(
        Object.values(followTally)
          .map(v => ({ name: v.name, followers: v.count }))
          .sort((a, b) => b.followers - a.followers)
          .slice(0, 6)
      )

      // Geo breakdown — infer country + continent from state where missing
      const stateTally: Record<string, number> = {}
      const countryTally: Record<string, number> = {}
      const continentTally: Record<string, number> = {}

      for (const row of allGeoData.data || []) {
        const country = inferCountry(row.state, row.country)
        const continent = inferContinent(country, row.continent)

        // Only count states for US shops (or shops with a recognisable US state)
        const isUSState = country === 'United States'
        if (isUSState && row.state) {
          const norm = normalizeState(row.state)
          if (norm) stateTally[norm] = (stateTally[norm] || 0) + 1
        }

        if (country) countryTally[country] = (countryTally[country] || 0) + 1
        if (continent) continentTally[continent] = (continentTally[continent] || 0) + 1
      }

      setStateBreakdown(
        Object.entries(stateTally)
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 12)
      )
      setCountryBreakdown(
        Object.entries(countryTally)
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)
      )
      setContinentBreakdown(
        Object.entries(continentTally)
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)
      )

      setLoading(false)
    }
    load()
  }, [])

  const totalPending = pending.claims + pending.edits + pending.reports + pending.punchCards
  const maxStateCount = stateBreakdown[0]?.count || 1

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold font-display text-coffee-900">Platform Overview</h1>
        <p className="text-sm text-coffee-400 mt-0.5">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </div>

      {/* Pending actions banner */}
      {totalPending > 0 && !isViewer && (
        <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: '#fff8ed', border: '1px solid #f0c97a' }}>
          <div>
            <p className="font-semibold text-sm text-coffee-800">
              {totalPending} item{totalPending !== 1 ? 's' : ''} need attention
            </p>
            <div className="text-xs text-coffee-500 mt-1 flex flex-wrap gap-3">
              {pending.claims > 0 && <span>☕ {pending.claims} claim{pending.claims !== 1 ? 's' : ''}</span>}
              {pending.edits > 0 && <span>✏️ {pending.edits} edit{pending.edits !== 1 ? 's' : ''}</span>}
              {pending.punchCards > 0 && <span>🎫 {pending.punchCards} punch card{pending.punchCards !== 1 ? 's' : ''}</span>}
              {pending.reports > 0 && <span>🚨 {pending.reports} report{pending.reports !== 1 ? 's' : ''}</span>}
            </div>
          </div>
          <button
            onClick={() => onNavigate(pending.reports > 0 && (pending.claims + pending.edits) === 0 ? 'reports' : 'approvals')}
            className="px-4 py-2 rounded-lg text-white text-xs font-semibold transition-opacity hover:opacity-90"
            style={{ background: '#c8853a' }}
          >
            Review →
          </button>
        </div>
      )}

      {/* Core metrics */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-coffee-400 mb-3">Core Metrics</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Brewers" value={stats?.users} icon="👤" loading={loading} />
          <StatCard label="Total Brews" value={stats?.ratings} icon="☕" loading={loading} />
          <StatCard label="Shops Listed" value={stats?.shops} icon="🏪" loading={loading} />
          <StatCard label="Open Reports" value={stats?.reports} icon="🚨" loading={loading} accent={(stats?.reports || 0) > 0} />
        </div>
      </div>

      {/* Growth */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-coffee-400 mb-3">Growth</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <GrowthPill label="brewers this week" value={stats?.newUsersWeek} loading={loading} />
          <GrowthPill label="brewers this month" value={stats?.newUsersMonth} loading={loading} />
          <GrowthPill label="brews this week" value={stats?.brewsWeek} loading={loading} />
          <GrowthPill label="brews this month" value={stats?.brewsMonth} loading={loading} />
        </div>
      </div>

      {/* Social & Engagement */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-coffee-400 mb-3">Social & Engagement</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard label="Shop Follows" value={stats?.totalFollows} icon="❤️" loading={loading} />
          <StatCard label="Posts This Week" value={stats?.postsWeek} icon="📢" loading={loading} />
          <StatCard label="Total Posts" value={stats?.totalPosts} icon="📋" loading={loading} />
          <StatCard label="Claimed Shops" value={stats?.claimedShops} icon="✅" loading={loading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top followed shops */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e8ddc8' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#f7f0e6', borderBottom: '1px solid #e8ddc8' }}>
              <p className="text-sm font-semibold text-coffee-800">❤️ Most followed shops</p>
            </div>
            {loading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-4 rounded animate-pulse" style={{ background: '#e8ddc8' }} />)}
              </div>
            ) : followedShops.length === 0 ? (
              <p className="px-4 py-6 text-sm text-coffee-400 text-center">No follows yet</p>
            ) : (
              <div className="divide-y" style={{ '--tw-divide-color': '#f5ead8' } as any}>
                {followedShops.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid #f5ead8' }}>
                    <span className="w-5 text-xs font-bold text-coffee-300 text-right shrink-0">{i + 1}</span>
                    <span className="flex-1 text-sm text-coffee-800 truncate">{s.name}</span>
                    <span className="text-xs font-semibold text-coffee-500 shrink-0">{s.followers} follower{s.followers !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top shops this week */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e8ddc8' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#f7f0e6', borderBottom: '1px solid #e8ddc8' }}>
              <p className="text-sm font-semibold text-coffee-800">☕ Most brewed this week</p>
            </div>
            {loading ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-4 rounded animate-pulse" style={{ background: '#e8ddc8' }} />)}
              </div>
            ) : topShops.length === 0 ? (
              <p className="px-4 py-6 text-sm text-coffee-400 text-center">No brews this week</p>
            ) : (
              <div>
                {topShops.map((shop, i) => (
                  <div key={shop.shop_id} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid #f5ead8' }}>
                    <span className="w-5 text-xs font-bold text-coffee-300 text-right shrink-0">{i + 1}</span>
                    <span className="flex-1 text-sm text-coffee-800 truncate">{shop.shop_name}</span>
                    <span className="text-xs font-semibold text-coffee-500 shrink-0">{shop.count} brew{shop.count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Geographic Reach */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-coffee-400 mb-3">Geographic Reach</p>

        {/* Summary pills */}
        <div className="flex flex-wrap gap-3 mb-4">
          {[
            { label: 'States', value: stateBreakdown.length, icon: '🗺️' },
            { label: 'Countries', value: countryBreakdown.length, icon: '🌍' },
            { label: 'Continents', value: continentBreakdown.length, icon: '🌐' },
            { label: 'Total Shops', value: stats?.shops, icon: '🏪' },
          ].map(p => (
            <div key={p.label} className="flex items-center gap-2 px-4 py-2.5 rounded-xl" style={{ background: '#fff', border: '1px solid #e8ddc8' }}>
              <span>{p.icon}</span>
              {loading ? <Skeleton w="w-6" h="h-5" /> : (
                <span className="text-lg font-bold font-display text-coffee-900">{p.value?.toLocaleString() ?? '—'}</span>
              )}
              <span className="text-xs text-coffee-400">{p.label}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* State bar chart */}
          <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ border: '1px solid #e8ddc8' }}>
            <div className="px-4 py-3" style={{ background: '#f7f0e6', borderBottom: '1px solid #e8ddc8' }}>
              <p className="text-sm font-semibold text-coffee-800">🗺️ Shops by state</p>
            </div>
            {loading ? (
              <div className="p-4 space-y-2.5">
                {[1,2,3,4,5].map(i => <div key={i} className="h-5 rounded animate-pulse" style={{ background: '#e8ddc8' }} />)}
              </div>
            ) : stateBreakdown.length === 0 ? (
              <p className="px-4 py-6 text-sm text-coffee-400 text-center">No state data available</p>
            ) : (
              <div className="p-4 space-y-2">
                {stateBreakdown.map(entry => (
                  <div key={entry.label} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-coffee-500 w-8 shrink-0 text-right">{entry.label}</span>
                    <div className="flex-1 h-5 rounded-md overflow-hidden" style={{ background: '#f0e4d0' }}>
                      <div
                        className="h-full rounded-md transition-all"
                        style={{
                          width: `${Math.max(4, (entry.count / maxStateCount) * 100)}%`,
                          background: 'linear-gradient(90deg, #c8853a, #9b5e1a)',
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-coffee-600 w-6 shrink-0 text-right">{entry.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Countries + Loyalty stacked */}
          <div className="space-y-4">
            {/* Countries + Continents */}
            <div className="space-y-3">
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e8ddc8' }}>
                <div className="px-4 py-3" style={{ background: '#f7f0e6', borderBottom: '1px solid #e8ddc8' }}>
                  <p className="text-sm font-semibold text-coffee-800">🌍 Countries</p>
                </div>
                {loading ? (
                  <div className="p-4 space-y-2">
                    {[1,2,3].map(i => <div key={i} className="h-4 rounded animate-pulse" style={{ background: '#e8ddc8' }} />)}
                  </div>
                ) : countryBreakdown.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-coffee-400 text-center">No country data yet</p>
                ) : (
                  <div>
                    {countryBreakdown.map(c => (
                      <div key={c.label} className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid #f5ead8' }}>
                        <span className="text-sm text-coffee-700 truncate">{c.label}</span>
                        <span className="text-xs font-semibold text-coffee-500 shrink-0 ml-2">{c.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e8ddc8' }}>
                <div className="px-4 py-3" style={{ background: '#f7f0e6', borderBottom: '1px solid #e8ddc8' }}>
                  <p className="text-sm font-semibold text-coffee-800">🌐 Continents</p>
                </div>
                {loading ? (
                  <div className="p-4 space-y-2">
                    {[1,2].map(i => <div key={i} className="h-4 rounded animate-pulse" style={{ background: '#e8ddc8' }} />)}
                  </div>
                ) : continentBreakdown.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-coffee-400 text-center">No continent data yet</p>
                ) : (
                  <div>
                    {continentBreakdown.map(c => (
                      <div key={c.label} className="flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid #f5ead8' }}>
                        <span className="text-sm text-coffee-700 truncate">{c.label}</span>
                        <span className="text-xs font-semibold text-coffee-500 shrink-0 ml-2">{c.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Loyalty */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e8ddc8' }}>
              <div className="px-4 py-3" style={{ background: '#f7f0e6', borderBottom: '1px solid #e8ddc8' }}>
                <p className="text-sm font-semibold text-coffee-800">🎫 Loyalty Program</p>
              </div>
              <div className="divide-y" style={{ '--tw-divide-color': '#f5ead8' } as any}>
                {[
                  { label: 'Active Cards', value: stats?.activePunchCards },
                  { label: 'Redemptions', value: stats?.punchRedemptions },
                  { label: 'Founding Partners', value: stats?.foundingPartners },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid #f5ead8' }}>
                    <span className="text-sm text-coffee-600">{row.label}</span>
                    {loading ? <Skeleton w="w-8" h="h-4" /> : (
                      <span className="text-sm font-bold text-coffee-900">{row.value?.toLocaleString() ?? '—'}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
