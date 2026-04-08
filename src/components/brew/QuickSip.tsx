import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { trackEvent } from '../../lib/analytics'

type Props = { onClose: () => void; onComplete: () => void }

function getMugStyle(fill: number) {
  if (fill === 0)  return { liquid: 'transparent', crema: 'transparent', glow: 'none', label: 'Slide to rate', color: '#9b7a45' }
  if (fill <= 25)  return { liquid: '#b0c4d4', crema: '#ccdde8', glow: 'rgba(176,196,212,0.3)', label: 'Just a Sip', color: '#7a9ab0' }
  if (fill <= 50)  return { liquid: '#c8924a', crema: '#dba96a', glow: 'rgba(200,146,74,0.35)', label: 'Getting There', color: '#c8924a' }
  if (fill <= 75)  return { liquid: '#a06428', crema: '#c07c38', glow: 'rgba(160,100,40,0.4)', label: 'Good Pour', color: '#a06428' }
  return             { liquid: '#4e2008', crema: '#7a3a12', glow: 'rgba(210,140,60,0.6)', label: '✨ Loved it', color: '#c8853a' }
}

export default function QuickSip({ onClose, onComplete }: Props) {
  const { profile } = useAuth()
  const [fill, setFill] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [shop, setShop] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const mugRef = useRef<HTMLDivElement>(null)
  const s = getMugStyle(fill)
  const showSteam = fill >= 60

  // Auto-load last visited shop
  useEffect(() => {
    if (!profile) return
    async function loadLastShop() {
      const { data } = await supabase
        .from('user_shop_visits')
        .select('*, coffee_shops(*)')
        .eq('user_id', profile!.id)
        .order('last_visited', { ascending: false })
        .limit(1)
        .single()
      if (data?.coffee_shops) setShop(data.coffee_shops)
    }
    loadLastShop()
  }, [profile])

  const calculateFill = useCallback((clientY: number) => {
    if (!mugRef.current) return
    const rect = mugRef.current.getBoundingClientRect()
    setFill(Math.max(0, Math.min(100, Math.round((1 - (clientY - rect.top) / rect.height) * 100))))
  }, [])

  const onMD = (e: React.MouseEvent) => { setIsDragging(true); calculateFill(e.clientY) }
  const onMM = (e: React.MouseEvent) => { if (isDragging) calculateFill(e.clientY) }
  const onMU = () => setIsDragging(false)
  const onTS = (e: React.TouchEvent) => { setIsDragging(true); calculateFill(e.touches[0].clientY) }
  const onTM = (e: React.TouchEvent) => { e.preventDefault(); if (isDragging) calculateFill(e.touches[0].clientY) }

  async function handleSubmit() {
    if (!profile || fill === 0) return
    setSubmitting(true)
    await supabase.from('ratings').insert({
      user_id: profile.id,
      shop_id: shop?.id || null,
      fill_level: fill,
      is_quick_sip: true,
      vibe_tags: [],
    })
    trackEvent('quick_sip_posted', { fill_level: fill, shop: shop?.name })
    setDone(true)
    setTimeout(() => { onComplete(); onClose() }, 1400)
  }

  // SVG mug — slightly smaller, cleaner
  const W = 160, H = 180
  const BX = 22, BY = 28, BW = 96, BH = 94, BR = 10
  const IH = BH - 6
  const fillH = Math.round((fill / 100) * IH)
  const fillY = BY + BH - fillH

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.92)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-sm rounded-t-3xl animate-slide-up overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #f5ead8, #efe0c4)', maxHeight: '80vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-caramel flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <div>
              <h2 className="text-coffee-800 font-display text-lg font-bold leading-none">Quick Sip</h2>
              <p className="text-coffee-400 text-xs mt-0.5">Rate in seconds, no details needed</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cream-200 flex items-center justify-center text-coffee-500">
            <X size={15} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center py-10 animate-fade-in">
            <div className="text-5xl mb-3">⚡</div>
            <p className="text-coffee-700 font-display text-xl font-bold">Sip logged!</p>
            <p className="text-coffee-400 text-sm mt-1">{shop?.name || 'Your coffee moment'} · {fill}%</p>
          </div>
        ) : (
          <div className="px-5 pb-6">
            {/* Shop chip */}
            {shop ? (
              <div className="flex items-center gap-2 mb-4 bg-white rounded-xl px-3 py-2 border border-cream-200 shadow-sm">
                <div className="w-7 h-7 rounded-lg overflow-hidden bg-coffee-100 flex-shrink-0">
                  {shop.photo_url
                    ? <img src={shop.photo_url} alt={shop.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-sm">☕</div>}
                </div>
                <p className="text-coffee-700 font-semibold text-sm flex-1 truncate">{shop.name}</p>
                <button onClick={() => setShop(null)} className="text-coffee-300 text-xs">change</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-4 bg-white/60 rounded-xl px-3 py-2 border border-cream-200 border-dashed">
                <span className="text-coffee-300 text-sm">☕</span>
                <p className="text-coffee-400 text-sm italic">No recent shop — still counts!</p>
              </div>
            )}

            {/* Mug */}
            <div className="flex flex-col items-center">
              <div ref={mugRef}
                onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
                onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onMU}
                style={{ cursor: 'ns-resize', userSelect: 'none', width: W, height: H }}>
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
                  style={{ filter: fill > 0 ? `drop-shadow(0 0 16px ${s.glow})` : 'none', transition: 'filter 0.3s' }}>
                  <defs>
                    <clipPath id="qs-clip"><rect x={BX+3} y={BY+3} width={BW-6} height={BH-6} rx={BR-2} /></clipPath>
                    <linearGradient id="qs-ceramic" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#e8d8bc" /><stop offset="50%" stopColor="#f0e4cc" /><stop offset="100%" stopColor="#dcc8a8" />
                    </linearGradient>
                    <linearGradient id="qs-liquid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.crema} /><stop offset="18%" stopColor={s.liquid} /><stop offset="100%" stopColor={s.liquid} stopOpacity="0.9" />
                    </linearGradient>
                  </defs>
                  {/* Saucer */}
                  <ellipse cx={BX+BW/2} cy={BY+BH+14} rx={BW/2+14} ry={8} fill="#dcc8a8" stroke="#c8b090" strokeWidth="1" />
                  {/* Handle */}
                  <path d={`M ${BX+BW-1} ${BY+18} C ${BX+BW+28} ${BY+16} ${BX+BW+28} ${BY+BH-16} ${BX+BW-1} ${BY+BH-18}`}
                    stroke="#c8b090" strokeWidth="11" fill="none" strokeLinecap="round" />
                  <path d={`M ${BX+BW-1} ${BY+18} C ${BX+BW+18} ${BY+17} ${BX+BW+18} ${BY+BH-17} ${BX+BW-1} ${BY+BH-18}`}
                    stroke="white" strokeWidth="5" fill="none" strokeLinecap="round" />
                  {/* Body */}
                  <rect x={BX} y={BY} width={BW} height={BH} rx={BR} fill="url(#qs-ceramic)" stroke="#c8b090" strokeWidth="1.5" />
                  {/* Liquid */}
                  {fill > 0 && (
                    <g clipPath="url(#qs-clip)">
                      <rect x={BX+3} y={fillY} width={BW-6} height={fillH} fill="url(#qs-liquid)"
                        style={{ transition: isDragging ? 'none' : 'y 0.15s ease, height 0.15s ease' }} />
                      <ellipse cx={BX+BW/2} cy={fillY+1} rx={(BW-10)/2} ry={3.5} fill={s.crema} opacity={0.85}
                        style={{ transition: isDragging ? 'none' : 'cy 0.15s ease' }} />
                    </g>
                  )}
                  {/* Rim */}
                  <rect x={BX-2} y={BY-5} width={BW+4} height={10} rx={5} fill="#dcc8a8" stroke="#c8b090" strokeWidth="1" />
                  {/* Base */}
                  <rect x={BX+6} y={BY+BH-4} width={BW-12} height={8} rx={4} fill="#c8b090" />
                  {/* Steam */}
                  {showSteam && [BX+22, BX+46, BX+70].map((x, i) => (
                    <path key={i}
                      d={`M ${x} ${BY-6} Q ${x-6} ${BY-18} ${x+4} ${BY-30}`}
                      stroke="rgba(160,120,80,0.4)" strokeWidth="2" fill="none" strokeLinecap="round"
                      style={{ animation: `steamRise ${1.5 + i * 0.2}s ease-in-out infinite`, animationDelay: `${i * 0.3}s` }} />
                  ))}
                </svg>
              </div>

              {/* Label */}
              <div className="text-center -mt-2" style={{ minHeight: 44 }}>
                <p className="font-display text-xl font-bold" style={{ color: s.color }}>{s.label}</p>
                {fill > 0 && <p className="text-coffee-400 text-sm mt-0.5">{fill}%</p>}
              </div>

              {/* Bar */}
              <div className="w-full mt-2 h-1.5 bg-cream-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-150"
                  style={{ width: `${fill}%`, background: `linear-gradient(90deg, ${s.crema}, ${s.liquid})` }} />
              </div>
            </div>

            {/* Submit */}
            <button onClick={handleSubmit} disabled={fill === 0 || submitting}
              className="w-full mt-5 py-3.5 rounded-2xl font-bold text-white text-base transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-40"
              style={{
                background: fill > 0 ? `linear-gradient(135deg, ${s.liquid}, ${s.crema})` : '#d4c4b0',
                boxShadow: fill > 0 ? `0 6px 24px ${s.glow}` : 'none'
              }}>
              {submitting ? 'Logging...' : fill === 0 ? 'Slide to rate first' : <><Zap size={16} /> Log Sip</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
