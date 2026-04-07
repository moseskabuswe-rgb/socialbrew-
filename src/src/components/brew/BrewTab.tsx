import { useState } from 'react'
import { Coffee, Gift, ShoppingBag, Camera } from 'lucide-react'
import ShopSelector from './ShopSelector'
import MugRating from './MugRating'
import ShareMoment from './ShareMoment'

type Props = { onPostCreated: () => void }
type BrewAction = 'rate' | 'share' | 'gift' | 'order'

export default function BrewTab({ onPostCreated }: Props) {
  const [action, setAction] = useState<BrewAction | null>(null)
  const [selectedShop, setSelectedShop] = useState<any>(null)
  const [showShopSelector, setShowShopSelector] = useState(false)

  function handleAction(a: BrewAction) {
    if (a === 'gift' || a === 'order') return
    setAction(a)
    if (a === 'rate') setShowShopSelector(true)
  }

  function handleShopSelect(shop: any) {
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
    { id: 'gift' as BrewAction, icon: Gift, label: 'Gift a Drink', sub: 'Coming soon', color: '#9b7a8a', available: false },
    { id: 'order' as BrewAction, icon: ShoppingBag, label: 'Order Ahead', sub: 'Coming soon', color: '#7a8a9b', available: false },
    { id: 'share' as BrewAction, icon: Camera, label: 'Share Moment', sub: 'Post a photo', color: '#6a8a6a', available: true },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(160deg, #f5ead8 0%, #efe0c4 50%, #e8d5b0 100%)' }}>

      <div className="text-center mb-12 animate-fade-in">
        <h1 className="font-display text-4xl font-bold text-coffee-700 tracking-tight">Brew</h1>
        <p className="text-coffee-400 text-sm mt-2 tracking-wide">Create your coffee experience</p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-sm animate-slide-up">
        {actions.map(({ id, icon: Icon, label, sub, color, available }) => (
          <button key={id} onClick={() => handleAction(id)}
            className={`relative flex flex-col items-center justify-center p-6 rounded-2xl transition-all duration-300 ${available ? 'hover:scale-105 active:scale-95' : 'opacity-60 cursor-default'}`}
            style={{
              background: available ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)',
              border: `1.5px solid ${available ? color + '44' : 'rgba(200,180,150,0.3)'}`,
              backdropFilter: 'blur(10px)',
              boxShadow: available ? '0 4px 20px rgba(0,0,0,0.06)' : 'none',
            }}>

            {!available && (
              <div className="absolute top-2 right-2 bg-latte rounded-full px-1.5 py-0.5">
                <span className="text-coffee-400 text-xs">Soon</span>
              </div>
            )}

            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: available ? `${color}22` : 'rgba(200,180,150,0.15)' }}>
              <Icon size={22} style={{ color: available ? color : '#b8a090' }} />
            </div>
            <p className="text-coffee-700 font-semibold text-sm">{label}</p>
            <p className="text-coffee-400 text-xs mt-0.5">{sub}</p>
          </button>
        ))}
      </div>

      {showShopSelector && (
        <ShopSelector onSelect={handleShopSelect} onClose={handleClose} />
      )}

      {action === 'rate' && selectedShop && (
        <MugRating shop={selectedShop} onClose={handleClose} onComplete={onPostCreated} />
      )}

      {action === 'share' && (
        <ShareMoment onClose={handleClose} onComplete={onPostCreated} />
      )}
    </div>
  )
}
