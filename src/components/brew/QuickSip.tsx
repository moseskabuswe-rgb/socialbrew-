import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Zap, Search, CheckCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import MugSwipeHint from '../shared/MugSwipeHint'
import AnonymousFeedbackModal from '../shared/AnonymousFeedbackModal'

type Props = { onClose: () => void; onComplete: () => void }

function getMugStyle(fill: number) {
  if (fill === 0)  return { liquid: 'transparent', crema: 'transparent', glow: 'none',                    label: 'Slide to rate',  color: '#c4b090' }
  if (fill <= 25)  return { liquid: '#b0c4d4',     crema: '#ccdde8',     glow: 'rgba(176,196,212,0.3)',   label: 'Just a Sip',     color: '#7a9aac' }
  if (fill <= 50)  return { liquid: '#c8924a',     crema: '#dba96a',     glow: 'rgba(200,146,74,0.35)',   label: 'Getting There',  color: '#c8924a' }
  if (fill <= 75)  return { liquid: '#a06428',     crema: '#c07c38',     glow: 'rgba(160,100,40,0.4)',    label: 'Good Pour',      color: '#a06428' }
  return             { liquid: '#4e2008',     crema: '#7a3a12',     glow: 'rgba(210,140,60,0.6)',    label: '✨ Loved it',    color: '#c8853a' }
}

const MUG = { BX: 20, BY: 24, BW: 140, BH: 110, IX: 24, IW: 132, IH: 106 }

const HINT_KEY = 'sb_mug_hint_seen'
function hasSeenHint(): boolean {
  try { return localStorage.getItem(HINT_KEY) === '1' } catch { return false }
}
function markHintSeen() {
  try { localStorage.setItem(HINT_KEY, '1') } catch {}
}

export default function QuickSip({ onClose, onComplete }: Props) {
  const { profile } = useAuth()
  const [fill, setFill] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const [shop, setShop] = useState<any>(null)
  const [showShopPicker, setShowShopPicker] = useState(false)
  const [shopSearch, setShopSearch] = useState('')
  const [shopList, setShopList] = useState<any[]>([])
  const [shopListFiltered, setShopListFiltered] = useState<any[]>([])
  const [loadingShops, setLoadingShops] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [submittedShop, setSubmittedShop] = useState<any>(null)
  const mugRef = useRef<HTMLDivElement>(null)
  const [showHint, setShowHint] = useState(!hasSeenHint())

  const s = getMugStyle(fill)
  const { BX, BY, BW, BH, IX, IW, IH } = MUG
  const fillY = BY + BH - Math.round((fill / 100) * IH)
  const showSteam = fill >= 60

  // Auto-load last visited shop
  useEffect(() => {
    if (!profile) return
    async function loadLastShop() {
      const { data } = await supabase
        .from('ratings')
        .select('shop_id, coffee_shops(id, name, city, state, lat, lng, is_certified, is_active)')
        .eq('user_id', profile!.id)
        .eq('coffee_shops.is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if ((data as any)?.coffee_shops) setShop((data as any).coffee_shops)
    }
    loadLastShop()
  }, [profile])

  // Load shops for picker
  useEffect(() => {
    if (!showShopPicker || shopList.length > 0) return
    setLoadingShops(true)
    supabase
      .from('coffee_shops')
      .select('id, name, city, state, is_certified, is_active, lat, lng')
      .eq('is_active', true)
      .order('total_ratings', { ascending: false })
      .then(({ data }) => {
        setShopList(data || [])
        setShopListFiltered(data || [])
        setLoadingShops(false)
      })
  }, [showShopPicker])

  // Filter shops in picker
  useEffect(() => {
    const q = shopSearch.toLowerCase()
    setShopListFiltered(
      shopList.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.city || '').toLowerCase().includes(q)
      )
    )
  }, [shopSearch, shopList])

  function dismissHint() {
    if (showHint) { setShowHint(false); markHintSeen() }
  }

  const calculateFill = useCallback((clientY: number) => {
    if (!mugRef.current) return
    const rect = mugRef.current.getBoundingClientRect()
    setFill(Math.max(0, Math.min(100, Math.round((1 - (clientY - rect.top) / rect.height) * 100))))
  }, [])

  const onMD = (e: React.MouseEvent) => { dismissHint(); isDraggingRef.current = true; setIsDragging(true); calculateFill(e.clientY) }
  const onMM = useCallback((e: MouseEvent) => { if (!isDraggingRef.current) return; calculateFill(e.clientY) }, [calculateFill])
  const onMU = useCallback(() => { isDraggingRef.current = false; setIsDragging(false) }, [])
  const onTS = (e: React.TouchEvent) => { dismissHint(); isDraggingRef.current = true; setIsDragging(true); calculateFill(e.touches[0].clientY) }
  const onTEnd = () => { isDraggingRef.current = false; setIsDragging(false) }

  useEffect(() => {
    const el = mugRef.current
    if (!el) return
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return
      e.preventDefault()
      calculateFill(e.touches[0].clientY)
    }
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('mousemove', onMM)
    window.addEventListener('mouseup', onMU)
    return () => {
      el.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('mousemove', onMM)
      window.removeEventListener('mouseup', onMU)
    }
  }, [calculateFill, onMM, onMU])

  async function handleSubmit() {
    if (!profile || fill === 0 || !shop) return
    setSubmitting(true)
    try {
      let shopId = shop.id
      if (String(shopId).startsWith('osm-')) {
        const { data: ins } = await supabase
          .from('coffee_shops')
          .insert({ name: shop.name, city: shop.city, state: shop.state, lat: shop.lat, lng: shop.lng, is_active: true, is_certified: false, is_verified: false })
          .select('id').single()
        shopId = ins?.id
      }
      if (!shopId) throw new Error('No shop id')

      await supabase.from('ratings').insert({
        user_id: profile.id,
        shop_id: shopId,
        fill_level: fill,
        is_quick_sip: true,
        drink_name: null,
        caption: null,
        vibes: [],
        visit_time: null,
        photo_url: null,
      })

      await supabase.rpc('increment_shop_visit', { shop_id_input: shopId })

      setDone(true)
      setTimeout(() => {
        onComplete()
        if (fill <= 50) {
          setSubmittedShop(shop)
          setShowFeedback(true)
        } else {
          onClose()
        }
      }, 1200)
    } catch (err) {
      console.error(err)
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(13,9,4,0.95)' }}>
        <div className="text-center animate-bounce-in">
          <div className="text-5xl mb-3">⚡</div>
          <p className="text-white font-display text-xl font-bold">Sip Logged!</p>
          <p className="text-amber-400 text-sm mt-1">{s.label}</p>
        </div>
      </div>
    )
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(13,9,4,0.95)' }}>
      <div
        className="w-full max-w-sm rounded-t-3xl animate-slide-up"
        style={{ background: 'linear-gradient(160deg,#fdfaf5,#f0e0c0)', maxHeight: '80vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="font-display text-xl font-bold text-stone-800 flex items-center gap-1.5">
              <Zap size={18} className="text-amber-500" /> Quick Sip
            </h2>
            <p className="text-stone-500 text-xs mt-0.5">Log a visit in seconds</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-500">
            <X size={16} />
          </button>
        </div>

        {/* Shop selector pill */}
        <div className="px-5 mb-4">
          <button
            onClick={() => setShowShopPicker(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all active:scale-98"
            style={{ background: shop ? 'rgba(200,133,58,0.08)' : 'rgba(255,255,255,0.7)', borderColor: shop ? '#c8853a55' : '#e5d5c0' }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: shop ? 'linear-gradient(135deg,#c8853a,#9b5e1a)' : '#e5d5c0' }}>
              <span className="text-lg">{shop ? '☕' : '+'}</span>
            </div>
            <div className="text-left flex-1 min-w-0">
              {shop ? (
                <>
                  <p className="text-stone-800 text-sm font-semibold truncate flex items-center gap-1">
                    {shop.name}
                    {shop.is_certified && <CheckCircle size={11} className="text-amber-500 flex-shrink-0" />}
                  </p>
                  <p className="text-stone-400 text-xs truncate">
                    {[shop.city, shop.state].filter(Boolean).join(', ')} · Tap to change
                  </p>
                </>
              ) : (
                <p className="text-stone-400 text-sm">Pick a coffee shop</p>
              )}
            </div>
          </button>
        </div>

        {/* Mug */}
        <div className="px-5 pb-2">
          <div
            ref={mugRef}
            className="relative mx-auto cursor-grab active:cursor-grabbing select-none"
            style={{ width: 180, height: 165, touchAction: 'none' }}
            onMouseDown={onMD}
            onTouchStart={onTS}
            onTouchEnd={onTEnd}
          >
            <svg width="180" height="165" viewBox="0 0 180 165">
              <defs>
                <linearGradient id="qsMugBody" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#c4a882" />
                  <stop offset="100%" stopColor="#e8d4b8" />
                </linearGradient>
                <linearGradient id="qsShine" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="white" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
                <clipPath id="qsMugClip">
                  <rect x={IX} y={BY} width={IW} height={IH} rx="4" />
                </clipPath>
              </defs>

              <rect x={BX} y={BY} width={BW} height={BH} rx="10" fill="url(#qsMugBody)" stroke="#a07840" strokeWidth="1.5" />
              <path d={`M ${BX + BW} ${BY + 16} Q ${BX + BW + 28} ${BY + 24} ${BX + BW + 28} ${BY + BH / 2} Q ${BX + BW + 28} ${BY + BH - 24} ${BX + BW} ${BY + BH - 16}`}
                fill="none" stroke="#a07840" strokeWidth="10" strokeLinecap="round" />

              {fill > 0 && (
                <g clipPath="url(#qsMugClip)">
                  <defs>
                    <linearGradient id="qsLiquid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.crema} />
                      <stop offset="30%" stopColor={s.liquid} />
                      <stop offset="100%" stopColor={s.liquid} stopOpacity="0.85" />
                    </linearGradient>
                  </defs>
                  <rect x={IX} y={fillY} width={IW} height={IH - (fillY - BY)}
                    fill="url(#qsLiquid)"
                    style={{ transition: isDragging ? 'none' : 'y 0.18s ease-out, height 0.18s ease-out' }} />
                  <ellipse cx={IX + IW / 2} cy={fillY} rx={IW / 2} ry="3.5"
                    fill={s.crema} opacity="0.7"
                    style={{ transition: isDragging ? 'none' : 'cy 0.18s ease-out' }} />
                </g>
              )}

              <rect x={BX - 3} y={BY - 5} width={BW + 6} height={11} rx={6} fill="#8a6232" stroke="#a07848" strokeWidth="1" />
              <rect x={BX + 8} y={BY + 6} width={12} height={BH - 16} rx={6} fill="url(#qsShine)" />
              <rect x={BX + 5} y={BY + BH - 5} width={BW - 10} height={9} rx={4} fill="#5a3818" />

              {showSteam && [
                { x: BX + 24, delay: '0s', dur: '1.6s' },
                { x: BX + 46, delay: '0.4s', dur: '1.9s' },
                { x: BX + 68, delay: '0.2s', dur: '1.7s' },
              ].map((steam, i) => (
                <path key={i}
                  d={`M ${steam.x} ${BY - 6} Q ${steam.x - 6} ${BY - 18} ${steam.x + 4} ${BY - 30}`}
                  stroke="rgba(200,180,160,0.45)" strokeWidth="2" fill="none" strokeLinecap="round"
                  style={{ animation: `steamRise ${steam.dur} ease-in-out infinite`, animationDelay: steam.delay }} />
              ))}
            </svg>

            {/* Swipe hint — first use only */}
            <MugSwipeHint visible={showHint && fill === 0} />

            {/* Swipe arrows — shows after hint dismissed, until first fill */}
            {fill === 0 && !showHint && (
              <div
                className="absolute bottom-1 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none"
                style={{ animation: 'bounceUp 1.4s ease-in-out infinite' }}
              >
                {[0.3, 0.6, 1].map((opacity, i) => (
                  <svg key={i} width="18" height="11" viewBox="0 0 18 11" style={{ opacity }}>
                    <polyline points="2,9 9,2 16,9"
                      fill="none" stroke="#9b7a45" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ))}
                <p className="text-xs mt-0.5 font-medium" style={{ color: '#9b7a45' }}>Swipe up</p>
              </div>
            )}
          </div>

          {/* Rating label */}
          <div className="text-center mt-1 mb-5" style={{ minHeight: 48 }}>
            <p className="font-display text-xl font-bold transition-all duration-300"
              style={{ color: s.color }}>
              {s.label}
            </p>
            {fill > 0 && <p className="text-stone-400 text-xs mt-1 font-mono">{fill}%</p>}
          </div>

          <button
            onClick={handleSubmit}
            disabled={fill === 0 || !shop || submitting}
            className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all duration-300 flex items-center justify-center gap-2"
            style={{
              background: fill > 0 && shop
                ? `linear-gradient(135deg, ${s.liquid}, #7a4010)`
                : '#d4c4b0',
              boxShadow: fill > 0 && shop ? `0 6px 24px ${s.glow}` : 'none',
              opacity: fill > 0 && shop && !submitting ? 1 : 0.55,
            }}
          >
            {submitting ? 'Logging...' : fill === 0 ? 'Swipe mug to rate first' : !shop ? 'Pick a shop above' : <><Zap size={16} /> Log Sip</>}
          </button>
        </div>

        {/* Mini shop picker overlay */}
        {showShopPicker && (
          <div className="fixed inset-0 z-60 flex items-end justify-center" style={{ background: 'rgba(13,9,4,0.92)' }}>
            <div className="w-full max-w-sm rounded-t-3xl flex flex-col" style={{ background: '#2c1a0e', maxHeight: '75vh' }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
                <h3 className="text-white font-display text-lg font-bold">Pick a Shop</h3>
                <button onClick={() => setShowShopPicker(false)} className="text-stone-400"><X size={18} /></button>
              </div>
              <div className="px-5 mb-3 flex-shrink-0">
                <div className="flex items-center px-4 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Search size={14} className="text-amber-400 mr-2 flex-shrink-0" />
                  <input
                    value={shopSearch}
                    onChange={(e) => setShopSearch(e.target.value)}
                    placeholder="Search shops..."
                    className="flex-1 bg-transparent text-white text-sm placeholder-stone-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 px-5 pb-6">
                {loadingShops ? (
                  <div className="flex justify-center py-6">
                    <div className="w-5 h-5 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                  </div>
                ) : shopListFiltered.map((s2) => (
                  <button
                    key={s2.id}
                    onClick={() => { setShop(s2); setShowShopPicker(false); setShopSearch('') }}
                    className="w-full flex items-center gap-3 py-3 border-b text-left"
                    style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(200,133,58,0.15)' }}>
                      <span className="text-base">☕</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate flex items-center gap-1">
                        {s2.name}
                        {s2.is_certified && <CheckCircle size={11} className="text-amber-400" />}
                      </p>
                      <p className="text-stone-500 text-xs truncate">{[s2.city, s2.state].filter(Boolean).join(', ')}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Anonymous feedback modal — appears after low-rating submit */}
    {showFeedback && submittedShop && (
      <AnonymousFeedbackModal
        shopId={submittedShop.id || ''}
        shopName={submittedShop.name || 'this shop'}
        fillLevel={fill}
        onSkip={onClose}
        onSent={onClose}
      />
    )}
    </>
  )
}
