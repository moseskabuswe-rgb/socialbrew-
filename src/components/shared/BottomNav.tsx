import { Home, Compass, TrendingUp, User } from 'lucide-react'

type Tab = 'home' | 'discover' | 'brew' | 'trending' | 'profile'
type Props = {
  active: Tab
  onChange: (tab: Tab) => void
}

const sidebarTabs = [
  { id: 'home' as Tab, icon: Home, label: 'Home' },
  { id: 'discover' as Tab, icon: Compass, label: 'Discover' },
  { id: 'trending' as Tab, icon: TrendingUp, label: 'Trending' },
  { id: 'profile' as Tab, icon: User, label: 'Profile' },
]

export default function BottomNav({ active, onChange }: Props) {
  const isBrewActive = active === 'brew'

  return (
    // will-change + translateZ keep the nav on its own GPU layer, preventing
    // scroll-triggered compositing repaints from flashing against other layers
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center"
      style={{ willChange: 'transform', transform: 'translateZ(0)' }}
    >
      {/* Solid white — backdrop-blur removed, it triggers expensive repaints on every scroll frame on iOS */}
      <div className="w-full max-w-lg bg-white border-t border-cream-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-around px-2 py-2 pb-safe">

          {/* Home + Discover */}
          {sidebarTabs.slice(0, 2).map(({ id, icon: Icon, label }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                onClick={() => onChange(id)}
                className="flex flex-col items-center py-1 px-3 transition-all duration-200 active:scale-95 min-w-0"
              >
                <Icon
                  size={22}
                  className="transition-colors duration-200"
                  style={{ color: isActive ? '#c8853a' : '#9b7a45' }}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <span className="text-xs mt-1 font-medium transition-colors duration-200" style={{ color: isActive ? '#c8853a' : '#9b7a45' }}>
                  {label}
                </span>
              </button>
            )
          })}

          {/* Brew — centre raised button. mix-blend-mode:multiply blends the PNG's white
              background away against the button surface, leaving just the mug + steam. */}
          <button onClick={() => onChange('brew')} className="flex flex-col items-center -mt-5">
            <div className="relative" style={{ isolation: 'isolate' }}>
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95"
                style={{
                  background: isBrewActive ? '#fdecd4' : 'white',
                  boxShadow: isBrewActive
                    ? '0 4px 20px rgba(200,133,58,0.55)'
                    : '0 4px 16px rgba(0,0,0,0.18)',
                }}
              >
                <img
                  src="/icon-512.png"
                  alt="Brew"
                  width={40}
                  height={40}
                  style={{ display: 'block', mixBlendMode: 'multiply' }}
                />
              </div>
              {/* Plus badge */}
              <div
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}
              >
                <span style={{ fontSize: 13, fontWeight: 800, color: '#c8853a', lineHeight: 1, marginTop: -1 }}>
                  +
                </span>
              </div>
            </div>
            <span className={`text-xs mt-1 font-medium ${isBrewActive ? 'text-caramel' : 'text-coffee-400'}`}>
              Brew
            </span>
          </button>

          {/* Trending + Profile */}
          {sidebarTabs.slice(2).map(({ id, icon: Icon, label }) => {
            const isActive = active === id
            return (
              <button
                key={id}
                onClick={() => onChange(id)}
                className="flex flex-col items-center py-1 px-3 transition-all duration-200 active:scale-95 min-w-0"
              >
                <Icon
                  size={22}
                  className="transition-colors duration-200"
                  style={{ color: isActive ? '#c8853a' : '#9b7a45' }}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <span className="text-xs mt-1 font-medium transition-colors duration-200" style={{ color: isActive ? '#c8853a' : '#9b7a45' }}>
                  {label}
                </span>
              </button>
            )
          })}

        </div>
      </div>
    </div>
  )
}
