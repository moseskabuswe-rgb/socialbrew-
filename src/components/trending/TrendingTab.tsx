import { useState, useEffect } from 'react'
import { TrendingUp, Zap, Crown, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { CoffeeShop } from '../../lib/supabase'

export default function TrendingTab() {
  const [shops, setShops] = useState<CoffeeShop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('coffee_shops')
        .select('*')
        .eq('is_active', true)
        .order('weekly_visits', { ascending: false })
        .limit(10)
      if (data) setShops(data)
      setLoading(false)
    }
    load()
  }, [])

  const spotlight = shops[0]
  const movers = shops.slice(1, 4)
  const rest = shops.slice(4)

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-cream-100/95 backdrop-blur-sm border-b border-cream-200 px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-coffee-800">City Pulse</h1>
          <p className="text-coffee-400 text-xs mt-0.5">What's moving the coffee scene</p>
        </div>
        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-3 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-600 text-xs font-semibold">LIVE</span>
        </div>
      </div>

      <div className="pb-28">
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && shops.length === 0 && (
          <div className="text-center py-16 px-8">
            <div className="text-5xl mb-3">📈</div>
            <p className="text-coffee-700 font-display text-xl">No trends yet</p>
            <p className="text-coffee-400 text-sm mt-1">Start rating visits to build the pulse</p>
          </div>
        )}

        {/* Spotlight card */}
        {spotlight && (
          <div className="mx-4 mt-4 mb-5">
            <div className="relative rounded-2xl overflow-hidden shadow-lg" style={{ height: 220 }}>
              {spotlight.photo_url ? (
                <img src={spotlight.photo_url} alt={spotlight.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-coffee-600 to-coffee-800" />
              )}

              {/* Dark overlay */}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(13,9,4,0.92) 0%, rgba(13,9,4,0.2) 60%, transparent 100%)' }} />

              {/* Spotlight badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-caramel rounded-full px-3 py-1">
                <Crown size={11} className="text-white" />
                <span className="text-white text-xs font-bold tracking-wide">SPOTLIGHT</span>
              </div>

              {/* Content */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-caramel text-white text-xs font-bold px-2 py-0.5 rounded">TRENDING #1</span>
                  <span className="text-cream-200 text-xs flex items-center gap-1">
                    <Zap size={10} className="text-yellow-400" />
                    {spotlight.weekly_visits.toLocaleString()} visits this week
                  </span>
                </div>
                <h2 className="text-white font-display text-2xl font-bold leading-tight">{spotlight.name}</h2>
                {spotlight.description && (
                  <p className="text-cream-200 text-xs mt-1 line-clamp-1">{spotlight.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-white/80 text-xs font-medium">🔥 {spotlight.weekly_visits} visits this week</span>
                  <span className="text-caramel text-xs font-semibold">Trending now</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Movers & Shakers */}
        {movers.length > 0 && (
          <div className="px-4 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-caramel" />
              <h2 className="text-coffee-800 font-display font-bold text-lg">Movers & Shakers</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1">
              {movers.map((shop, i) => (
                <div key={shop.id} className="flex-shrink-0 w-36 bg-white rounded-2xl overflow-hidden shadow-sm border border-cream-200">
                  <div className="relative h-24 bg-coffee-200">
                    {shop.photo_url ? (
                      <img src={shop.photo_url} alt={shop.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-3xl opacity-30">☕</span>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-coffee-800/80 rounded-full w-5 h-5 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">#{i + 2}</span>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="text-coffee-800 font-semibold text-xs leading-tight line-clamp-2">{shop.name}</p>
                    <p className="text-caramel text-xs mt-1 flex items-center gap-0.5">
                      <Zap size={9} />{shop.weekly_visits} this week
                    </p>
                    {shop.weekly_visits > 50 && (
                      <p className="text-red-500 text-xs font-bold mt-0.5">🔥 Hot</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full rankings */}
        {rest.length > 0 && (
          <div className="px-4">
            <h2 className="text-coffee-800 font-display font-bold text-lg mb-3">This Week's Rankings</h2>
            <div className="space-y-2">
              {rest.map((shop, i) => (
                <div key={shop.id} className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-cream-200">
                  <div className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-coffee-500 font-bold text-sm">#{i + 5}</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-coffee-200">
                    {shop.photo_url && (
                      <img src={shop.photo_url} alt={shop.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-coffee-800 font-semibold text-sm truncate">{shop.name}</p>
                    <p className="text-coffee-400 text-xs">{shop.city}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-coffee-800 font-bold text-sm">{shop.weekly_visits}</p>
                    <p className="text-coffee-400 text-xs">this week</p>
                    {i === 0 && <p className="text-orange-500 text-xs font-bold">↑ rising</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
