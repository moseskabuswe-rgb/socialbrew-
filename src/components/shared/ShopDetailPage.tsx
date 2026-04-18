import { useState, useEffect } from 'react'
import { ArrowLeft, MapPin, Users, Coffee } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { CoffeeShop } from '../../lib/supabase'

type Props = {
  shop: Partial<CoffeeShop> & { id: string; name: string }
  onBack: () => void
  onNavigateToBrew?: (shop: any) => void
}

type Tab = 'overview' | 'my-brews' | 'friends'

function parseOpeningHours(raw: string | null): string | null {
  if (!raw) return null
  // If already human-readable (contains full words like "Monday"), return as-is
  if (/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(raw)) return raw
  const dayMap: Record<string, string> = {
    'Mo': 'Mon', 'Tu': 'Tue', 'We': 'Wed', 'Th': 'Thu',
    'Fr': 'Fri', 'Sa': 'Sat', 'Su': 'Sun'
  }
  function to12h(time: string): string {
    const [h, m] = time.split(':').map(Number)
    const ampm = h >= 12 ? 'pm' : 'am'
    const h12 = h % 12 || 12
    return m === 0 ? `${h12}${ampm}` : `${h12}:${m.toString().padStart(2, '0')}${ampm}`
  }
  try {
    return raw.split(';').map(segment => {
      segment = segment.trim()
      const match = segment.match(/^([A-Za-z,\- ]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/)
      if (!match) return segment
      let days = match[1].trim()
      Object.entries(dayMap).forEach(([k, v]) => { days = days.replace(new RegExp(k, 'g'), v) })
      return `${days} ${to12h(match[2])}–${to12h(match[3])}`
    }).join(' · ')
  } catch {
    return raw
  }
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

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

function MiniMug({ fill, size = 40 }: { fill: number; size?: number }) {
  const color = getMugColor(fill)
  const id = `mug-${fill}-${size}-${Math.random().toString(36).slice(2)}`
  return (
    <svg viewBox="0 0 56 68" width={size} height={size * 1.2} style={{ flexShrink: 0 }}>
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

function RatingCard({ r }: { r: any }) {
  const user = r.profiles as any
  return (
    <div className="bg-white rounded-2xl p-4 border border-cream-200 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-coffee-200 flex-shrink-0">
          {user?.avatar_url
            ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center bg-caramel">
                <span className="text-white text-xs font-bold">{user?.username?.[0]?.toUpperCase()}</span>
              </div>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-coffee-700 font-semibold text-sm">{user?.username}</p>
          <p className="text-coffee-400 text-xs">{timeAgo(r.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <MiniMug fill={r.fill_level} size={32} />
          <div className="text-right">
            <p className="text-coffee-700 font-bold text-sm">{r.fill_level}%</p>
            <p className="text-coffee-400 text-xs" style={{ fontSize: 9 }}>{getFillLabel(r.fill_level)}</p>
          </div>
        </div>
      </div>
      {r.drink_name && <p className="text-coffee-500 text-xs">☕ {r.drink_name}</p>}
      {r.visit_time && <p className="text-coffee-400 text-xs mt-0.5">🕐 {r.visit_time}</p>}
      {r.vibe_tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {r.vibe_tags.map((v: string) => (
            <span key={v} className="bg-cream-100 text-coffee-500 px-2 py-0.5 rounded-full text-xs border border-cream-200">{v}</span>
          ))}
        </div>
      )}
      {r.caption && (
        <p className="text-coffee-600 text-sm mt-2 italic">"{r.caption.split('🕐')[0].trim()}"</p>
      )}
    </div>
  )
}

export default function ShopDetailPage({ shop, onBack, onNavigateToBrew }: Props) {
  const { profile } = useAuth()
  const [tab, setTab] = useState<Tab>('overview')
  const [allRatings, setAllRatings] = useState<any[]>([])
  const [myRatings, setMyRatings] = useState<any[]>([])
  const [friendRatings, setFriendRatings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [imgError, setImgError] = useState(false)
  const [resolvedShop, setResolvedShop] = useState<any>(shop)

  const isInDb = !String(shop.id).startsWith('osm-') &&
    !String(shop.id).startsWith('fsq-') &&
    !String(shop.id).startsWith('gpl-')

  useEffect(() => {
    async function load() {
      // Resolve shop ID — look up by name if from OSM
      let shopId = isInDb ? shop.id : null
      if (!isInDb && shop.name) {
        const { data: dbMatch } = await supabase
          .from('coffee_shops').select('*')
          .ilike('name', shop.name).eq('is_active', true).maybeSingle()
        if (dbMatch) {
          shopId = dbMatch.id
          setResolvedShop(dbMatch)
        }
      } else if (isInDb) {
        const { data: dbShop } = await supabase
          .from('coffee_shops').select('*').eq('id', shop.id).single()
        if (dbShop) setResolvedShop(dbShop)
      }

      if (!shopId) { setLoading(false); return }

      const { data: ratings } = await supabase
        .from('ratings')
        .select('*, profiles!ratings_user_id_fkey(id, username, avatar_url)')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (ratings) {
        setAllRatings(ratings)
        if (profile?.id) {
          setMyRatings(ratings.filter((r: any) => r.user_id === profile.id))
          const { data: follows } = await supabase
            .from('follows').select('following_id').eq('follower_id', profile.id)
          const followingIds = new Set((follows || []).map((f: any) => f.following_id))
          setFriendRatings(ratings.filter((r: any) => followingIds.has(r.user_id)))
        }
      }
      setLoading(false)
    }
    load()
  }, [shop.id, shop.name, isInDb, profile])

  const avgFill = allRatings.length > 0
    ? Math.round(allRatings.reduce((s, r) => s + r.fill_level, 0) / allRatings.length)
    : (resolvedShop.avg_fill ?? 0)

  const tabs = [
    { key: 'overview' as Tab, icon: <span className="text-sm">☕</span>, label: `All${allRatings.length > 0 ? ` (${allRatings.length})` : ''}` },
    { key: 'my-brews' as Tab, icon: <Coffee size={13} />, label: `Mine${myRatings.length > 0 ? ` (${myRatings.length})` : ''}` },
    { key: 'friends' as Tab, icon: <Users size={13} />, label: `Friends${friendRatings.length > 0 ? ` (${friendRatings.length})` : ''}` },
  ]

  const activeList = tab === 'overview' ? allRatings : tab === 'my-brews' ? myRatings : friendRatings

  return (
    <div
      className="fixed inset-0 z-50 bg-cream-100 flex flex-col"
      onTouchStart={e => { (e.currentTarget as any)._swipeX = e.touches[0].clientX }}
      onTouchEnd={e => { const dx = e.changedTouches[0].clientX - ((e.currentTarget as any)._swipeX || 0); if (dx > 80) onBack() }}
    >
      {/* Hero image with back button */}
      <div className="relative flex-shrink-0" style={{ height: 220 }}>
        {resolvedShop.photo_url && !imgError ? (
          <img src={resolvedShop.photo_url} alt={resolvedShop.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)} />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-coffee-600 to-coffee-900 flex items-center justify-center">
            <span className="text-8xl opacity-20">☕</span>
          </div>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(10,5,1,0.9) 0%, rgba(10,5,1,0.1) 60%, transparent 100%)' }} />
        {/* Back button */}
        <button onClick={onBack}
          className="absolute top-safe-top top-4 left-4 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
          <ArrowLeft size={20} />
        </button>
        {/* Shop name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {resolvedShop.is_certified && (
            <span className="bg-caramel text-white text-xs font-bold px-2 py-0.5 rounded-full mb-1.5 inline-block">✓ Certified Independent</span>
          )}
          <h1 className="text-white font-display font-bold text-2xl leading-tight">{resolvedShop.name}</h1>
          {(resolvedShop.address || resolvedShop.city) && (
            <p className="text-cream-300 text-sm flex items-center gap-1 mt-1">
              <MapPin size={12} />
              {[resolvedShop.address, resolvedShop.city, resolvedShop.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-cream-200 px-4 py-3 flex items-center gap-4 flex-shrink-0">
        {avgFill > 0 ? (
          <div className="flex items-center gap-2">
            <MiniMug fill={avgFill} size={32} />
            <div>
              <p className="text-coffee-700 font-bold text-sm">{getFillLabel(avgFill)}</p>
              <p className="text-coffee-400 text-xs">{avgFill}% avg · {allRatings.length} review{allRatings.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        ) : (
          <p className="text-coffee-400 text-sm">No reviews yet — be the first!</p>
        )}
        {resolvedShop.vibes && (resolvedShop.vibes as any[]).length > 0 && (
          <div className="flex flex-wrap gap-1 ml-auto">
            {(resolvedShop.vibes as any[]).slice(0, 2).map((v: string) => (
              <span key={v} className="bg-cream-100 text-coffee-500 px-2 py-0.5 rounded-full text-xs border border-cream-200">{v}</span>
            ))}
          </div>
        )}
      </div>

      {/* Hours and website */}
      {((resolvedShop as any).opening_hours || (resolvedShop as any).website) && (
        <div className="bg-white border-b border-cream-200 px-4 py-2.5 flex flex-wrap gap-3 flex-shrink-0">
          {(resolvedShop as any).opening_hours && (
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🕐</span>
              <p className="text-coffee-600 text-xs">{parseOpeningHours((resolvedShop as any).opening_hours)}</p>
            </div>
          )}
          {(resolvedShop as any).website && (
            <a
              href={(resolvedShop as any).website.startsWith('http') ? (resolvedShop as any).website : `https://${(resolvedShop as any).website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5"
            >
              <span className="text-sm">🌐</span>
              <p className="text-caramel text-xs underline">Visit website</p>
            </a>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-white border-b border-cream-200 flex-shrink-0">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-3 text-xs font-medium transition-colors border-b-2 ${
              tab === t.key ? 'border-caramel text-caramel' : 'border-transparent text-coffee-400'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-8">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
          </div>
        )}

        {!loading && (
          <div className="px-4 pt-4 space-y-3">
            {activeList.length === 0 && (
              <div className="text-center py-16">
                <p className="text-4xl mb-3">
                  {tab === 'overview' ? '☕' : tab === 'my-brews' ? '☕' : '👥'}
                </p>
                <p className="text-coffee-500 font-display text-lg">
                  {tab === 'overview' ? 'No brews here yet' : tab === 'my-brews' ? "You haven't brewed here yet" : 'No friends here yet'}
                </p>
                <p className="text-coffee-400 text-sm mt-1">
                  {tab === 'overview' ? 'Be the first to rate a visit!' : tab === 'my-brews' ? 'Rate a visit to see your history' : 'Follow people to see their brews'}
                </p>
                {(tab === 'overview' || tab === 'my-brews') && onNavigateToBrew && (
                  <button
                    onClick={() => onNavigateToBrew(shop)}
                    className="mt-4 px-5 py-2.5 bg-caramel text-white rounded-full text-sm font-semibold"
                  >
                    Rate {shop.name} ☕
                  </button>
                )}
              </div>
            )}
            {activeList.map(r => <RatingCard key={r.id} r={r} />)}
          </div>
        )}
      </div>

      {/* Directions button + Rate button */}
      <div className="px-4 py-3 bg-white border-t border-cream-200 flex-shrink-0 flex gap-2">
        {(resolvedShop.lat && resolvedShop.lng) && (
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${resolvedShop.lat},${resolvedShop.lng}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-cream-100 border border-cream-300 text-coffee-700 rounded-xl py-3 font-semibold text-sm px-4">
            <MapPin size={16} /> Directions
          </a>
        )}
        {onNavigateToBrew && (
          <button
            onClick={() => onNavigateToBrew(shop)}
            className="flex-1 flex items-center justify-center gap-2 text-white rounded-xl py-3 font-semibold text-sm"
            style={{ background: '#c8853a' }}>
            ☕ Rate a Visit
          </button>
        )}
        {!onNavigateToBrew && (resolvedShop.lat && resolvedShop.lng) && null}
      </div>
    </div>
  )
}
