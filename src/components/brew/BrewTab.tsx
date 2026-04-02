import { useState } from 'react'
import { Coffee, Gift, ShoppingBag, Camera } from 'lucide-react'
import ShopSelector from './ShopSelector'
import MugRating from './MugRating'
import ShareMoment from './ShareMoment'
import type { CoffeeShop } from '../../lib/supabase'

type Props = { onPostCreated: () => void }

type BrewAction = 'rate' | 'share' | 'gift' | 'order'

export default function BrewTab({ onPostCreated }: Props) {
  const [action, setAction] = useState<BrewAction | null>(null)
  const [selectedShop, setSelectedShop] = useState<CoffeeShop | null>(null)
  const [showShopSelector, setShowShopSelector] = useState(false)

  function handleAction(a: BrewAction) {
    if (a === 'gift' || a === 'order') return // coming soon
    setAction(a)
    if (a === 'rate') setShowShopSelector(true)
  }

  function handleShopSelect(shop: CoffeeShop) {
    setSelectedShop(shop)
    setShowShopSelector(false)
  }

  function handleClose() {
    setAction(null)
    setSelectedShop(null)
    setShowShopSelector(false)
  }

  const actions = [
    { id: 'rate' as BrewAction, icon: Coffee, label: 'Rate a Visit', sub: 'Log your sip', color: '#c8853a', available: true },
    { id: 'gift' as BrewAction, icon: Gift, label: 'Gift a Drink', sub: 'Coming soon', color: '#9b5e88', available: false },
    { id: 'order' as BrewAction, icon: ShoppingBag, label: 'Order Ahead', sub: 'Coming soon', color: '#4a7a9b', available: false },
    { id: 'share' as BrewAction, icon: Camera, label: 'Share Moment', sub: 'Post a photo', color: '#5a8a5a', available: true },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'radial-gradient(ellipse at top, #2a1f0e 0%, #0d0904 100%)' }}>

      <div className="text-center mb-12 animate-fade-in">
        <h1 className="text-white font-display text-4xl font-bold tracking-tight">Brew</h1>
        <p className="text-coffee-300 text-sm mt-2 tracking-wide">Create your coffee experience</p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-sm animate-slide-up">
        {actions.map(({ id, icon: Icon, label, sub, color, available }) => (
          <button key={id} onClick={() => handleAction(id)}
            className={`relative flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-300 ${available ? 'hover:scale-105 active:scale-95' : 'opacity-50 cursor-default'}`}
            style={{ background: available ? `linear-gradient(135deg, ${color}22, ${color}11)` : '#1a1208', border: `1px solid ${available ? color + '44' : '#3d2f18'}` }}>

            {!available && (
              <div className="absolute top-2 right-2 bg-coffee-600 rounded-full px-1.5 py-0.5">
                <span className="text-coffee-300 text-xs">Soon</span>
              </div>
            )}

            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: available ? `${color}33` : '#2a1f0e' }}>
              <Icon size={22} style={{ color: available ? color : '#5c4a2a' }} />
            </div>
            <p className="text-white font-semibold text-sm">{label}</p>
            <p className="text-coffee-400 text-xs mt-0.5">{sub}</p>
          </button>
        ))}
      </div>

      {/* Shop selector */}
      {showShopSelector && (
        <ShopSelector onSelect={handleShopSelect} onClose={handleClose} />
      )}

      {/* Mug rating flow */}
      {action === 'rate' && selectedShop && (
        <MugRating shop={selectedShop} onClose={handleClose} onComplete={onPostCreated} />
      )}

      {/* Share moment flow */}
      {action === 'share' && (
        <ShareMoment onClose={handleClose} onComplete={onPostCreated} />
      )}
    </div>
  )
}
