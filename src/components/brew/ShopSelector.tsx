import { useState, useEffect } from 'react'
import { Search, X, MapPin, CheckCircle } from 'lucide-react'
import { supabase, CoffeeShop } from '../../lib/supabase'
import AddShopForm from '../shared/AddShopForm'

type Props = {
  onSelect: (shop: CoffeeShop) => void
  onClose: () => void
}

export default function ShopSelector({ onSelect, onClose }: Props) {
  const [shops, setShops] = useState<CoffeeShop[]>([])
  const [filtered, setFiltered] = useState<CoffeeShop[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddShop, setShowAddShop] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('coffee_shops')
        .select('*')
        .eq('is_active', true)
        .order('weekly_visits', { ascending: false })
      if (data) { setShops(data); setFiltered(data) }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(shops.filter(s =>
      s.name.toLowerCase().includes(q) || s.city.toLowerCase().includes(q)
    ))
  }, [search, shops])

  function handleShopCreated(shop: any) {
    // Add to local list and select it immediately
    setShops(prev => [shop, ...prev])
    setShowAddShop(false)
    onSelect(shop)
  }

  const showEmpty = !loading && filtered.length === 0

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: 'rgba(13,9,4,0.92)' }}
      >
        <div className="w-full max-w-sm bg-coffee-700 rounded-t-3xl animate-slide-up" style={{ maxHeight: '85vh' }}>
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="text-white font-display text-xl font-bold">Where did you go?</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-coffee-600 flex items-center justify-center text-coffee-300">
              <X size={16} />
            </button>
          </div>

          <div className="px-5 mb-3">
            <div className="flex items-center bg-coffee-800 rounded-xl px-4 py-3 border border-coffee-600">
              <Search size={16} className="text-coffee-400 mr-3" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search coffee shops..."
                className="flex-1 bg-transparent text-white text-sm placeholder-coffee-400 focus:outline-none"
              />
              {search.length > 0 && (
                <button onClick={() => setSearch('')} className="text-coffee-400 ml-2">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: '60vh' }}>
            {loading && (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
              </div>
            )}

            {!loading && filtered.map(shop => (
              <button
                key={shop.id}
                onClick={() => onSelect(shop)}
                className="w-full text-left flex items-center gap-4 py-3 border-b border-coffee-600/40 hover:bg-coffee-600/30 rounded-xl px-2 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-coffee-800">
                  {shop.photo_url && <img src={shop.photo_url} alt={shop.name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-white font-semibold text-sm truncate">{shop.name}</p>
                    {shop.is_certified || (shop as any).is_verified
                      ? <CheckCircle size={12} className="text-caramel flex-shrink-0" />
                      : <span className="text-xs">🌱</span>
                    }
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={10} className="text-coffee-400" />
                    <p className="text-coffee-400 text-xs truncate">{shop.city}{shop.state ? `, ${shop.state}` : ''}</p>
                  </div>
                  {shop.avg_rating > 0 && (
                    <p className="text-caramel text-xs mt-0.5">★ {shop.avg_rating} · {shop.total_ratings} ratings</p>
                  )}
                </div>
              </button>
            ))}

            {/* Empty state — show Add a Shop */}
            {showEmpty && (
              <div className="text-center py-8">
                <p className="text-coffee-400 text-sm">
                  {search ? `No shops found for "${search}"` : 'No shops found'}
                </p>
                <p className="text-coffee-500 text-xs mt-1 mb-4">Only independent coffee shops are listed</p>
                <button
                  onClick={() => setShowAddShop(true)}
                  className="px-5 py-2.5 rounded-xl text-white text-sm font-semibold active:scale-95 transition-all"
                  style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
                >
                  + Add {search ? `"${search}"` : 'a Shop'}
                </button>
              </div>
            )}

            {/* Always show Add button at bottom when there are results */}
            {!loading && filtered.length > 0 && (
              <button
                onClick={() => setShowAddShop(true)}
                className="w-full mt-4 py-3 rounded-xl border border-coffee-500 text-coffee-300 text-sm font-medium flex items-center justify-center gap-2 active:bg-coffee-600/30 transition-colors"
              >
                + Can't find your shop? Add it
              </button>
            )}
          </div>
        </div>
      </div>

      {showAddShop && (
        <AddShopForm
          initialName={search}
          onClose={() => setShowAddShop(false)}
          onShopCreated={handleShopCreated}
        />
      )}
    </>
  )
}
