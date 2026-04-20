import { useState } from 'react'
import { Coffee, Gift, Zap, Camera } from 'lucide-react'
import ShopSelector from './ShopSelector'
import MugRating from './MugRating'
import ShareMoment from './ShareMoment'
import QuickSip from './QuickSip'

type Props = {
  onPostCreated: (shopName?: string, wasFirst?: boolean) => void
  initialShop?: any | null
}
type BrewAction = 'rate' | 'share' | 'quicksip' | 'gift'

export default function BrewTab({ onPostCreated, initialShop }: Props) {
  const [action, setAction] = useState<BrewAction | null>(initialShop ? 'rate' : null)
  const [selectedShop, setSelectedShop] = useState<any>(initialShop || null)
  const [showShopSelector, setShowShopSelector] = useState(false)

  function handleAction(a: BrewAction) {
    if (a === 'gift') return
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
    {
      id: 'rate' as BrewAction,
      icon: Coffee,
      label: 'Rate a Visit',
      sub: 'Rate your drink & share the full experience',
      color: '#c8853a',
      available: true,
      badge: null,
    },
    {
      id: 'quicksip' as BrewAction,
      icon: Zap,
      label: 'Quick Sip',
      sub: 'Quick stop or drive-through? Log it fast',
      color: '#7ab0c8',
      available: true,
      badge: '⚡ Fast',
    },
    {
      id: 'gift' as BrewAction,
      icon: Gift,
      label: 'Gift a Drink',
      sub: 'Send a coffee to a friend',
      color: '#9b7a8a',
      available: false,
      badge: null,
    },
    {
      id: 'share' as BrewAction,
      icon: Camera,
      label: 'Share Moment',
      sub: 'Post a photo from your visit',
      color: '#6a8a6a',
      available: true,
      badge: null,
    },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(160deg, #fdfaf5 0%, #f5ead8 50%, #efe0c4 100%)' }}>

      <div className="text-center mb-10 animate-fade-in">
        <h1 className="font-display text-4xl font-bold text-coffee-700 tracking-tight">Brew</h1>
        <p className="text-coffee-400 text-sm mt-2">What would you like to do?</p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-sm animate-slide-up">
        {actions.map(({ id, icon: Icon, label, sub, color, available, badge }) => (
          <button key={id} onClick={() => handleAction(id)}
            className={`relative flex flex-col items-start p-5 rounded-2xl transition-all duration-300 text-left ${available ? 'hover:scale-105 active:scale-95' : 'opacity-50 cursor-default'}`}
            style={{
              background: 'rgba(255,255,255,0.85)',
              border: `1.5px solid ${available ? color + '55' : 'rgba(200,180,150,0.3)'}`,
              backdropFilter: 'blur(10px)',
              boxShadow: available ? `0 4px 20px ${color}22` : 'none',
            }}>

            {badge && (
              <div className="absolute top-2 right-2 rounded-full px-1.5 py-0.5"
                style={{ background: color + '22', border: `1px solid ${color}44` }}>
                <span className="text-xs font-semibold" style={{ color }}>{badge}</span>
              </div>
            )}
            {!available && (
              <div className="absolute top-2 right-2 bg-cream-200 rounded-full px-1.5 py-0.5">
                <span className="text-coffee-400 text-xs">Soon</span>
              </div>
            )}

            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: available ? `${color}22` : 'rgba(200,180,150,0.15)' }}>
              <Icon size={20} style={{ color: available ? color : '#b8a090' }} />
            </div>
            <p className="text-coffee-700 font-semibold text-sm leading-tight">{label}</p>
            <p className="text-coffee-400 text-xs mt-1 leading-snug">{sub}</p>
          </button>
        ))}
      </div>

      {showShopSelector && (
        <ShopSelector onSelect={handleShopSelect} onClose={handleClose} />
      )}
      {action === 'rate' && selectedShop && (
        <MugRating shop={selectedShop} onClose={handleClose} onComplete={(name, wasFirst) => onPostCreated(name, wasFirst)} />
      )}
      {action === 'quicksip' && (
        <QuickSip onClose={handleClose} onComplete={(name, wasFirst) => onPostCreated(name, wasFirst)} />
      )}
      {action === 'share' && (
        <ShareMoment onClose={handleClose} onComplete={onPostCreated} />
      )}
    </div>
  )
}
