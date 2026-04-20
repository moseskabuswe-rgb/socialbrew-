import { Home, Compass, TrendingUp, User, Coffee } from 'lucide-react'

type Tab = 'home' | 'discover' | 'brew' | 'trending' | 'profile'
type Props = {
  active: Tab
  onChange: (tab: Tab) => void
}

const tabs = [
  { id: 'home' as Tab, icon: Home, label: 'Home' },
  { id: 'discover' as Tab, icon: Compass, label: 'Discover' },
  { id: 'brew' as Tab, icon: Coffee, label: 'Brew', center: true },
  { id: 'trending' as Tab, icon: TrendingUp, label: 'Trending' },
  { id: 'profile' as Tab, icon: User, label: 'Profile' },
]

export default function BottomNav({ active, onChange }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center">
      <div className="w-full max-w-lg bg-white/95 backdrop-blur-md border-t border-cream-200 shadow-xl">
        <div className="flex items-center justify-around px-2 py-2 pb-safe">
          {tabs.map(({ id, icon: Icon, label, center }) => {
            const isActive = active === id
            if (center) {
              return (
                <button
                  key={id}
                  onClick={() => onChange(id)}
                  className="flex flex-col items-center -mt-5"
                >
                  {/* Circle with + badge */}
                  <div className="relative">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95"
                      style={{
                        background: isActive
                          ? 'linear-gradient(135deg, #c8853a, #9b5e25)'
                          : 'linear-gradient(135deg, #2a1f0e, #1a1208)',
                        boxShadow: isActive
                          ? '0 4px 20px rgba(200,133,58,0.5)'
                          : '0 4px 16px rgba(13,9,4,0.4)',
                      }}
                    >
                      <Icon size={24} className="text-white" />
                    </div>
                    {/* Plus badge */}
                    <div
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{
                        background: 'white',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: '#c8853a',
                          lineHeight: 1,
                          marginTop: -1,
                        }}
                      >
                        +
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs mt-1 font-medium ${isActive ? 'text-caramel' : 'text-coffee-400'}`}>
                    {label}
                  </span>
                </button>
              )
            }
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
                <span
                  className="text-xs mt-1 font-medium transition-colors duration-200"
                  style={{ color: isActive ? '#c8853a' : '#9b7a45' }}
                >
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
