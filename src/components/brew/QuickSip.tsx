import { useState, useRef, useCallback, useEffect } from 'react'
import { X, MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { CoffeeShop } from '../../lib/supabase'
import BoostToast from './BoostToast'

// Quick Sip — 1-tap rating. No shop selector if recent shop exists.
// Fill the mug, done. The daily habit mechanic.

function getMugStyle(fill: number) {
  if (fill === 0)  return { liquid: 'transparent', crema: 'transparent', glow: 'none', label: 'Tap & drag to rate', color: '#b8935a' }
  if (fill <= 20)  return { liquid: '#b0c4d4', crema: '#ccdde8', glow: 'rgba(176,196,212,0.3)', label: 'Just a Sip', color: '#8ca8c5' }
  if (fill <= 40)  return { liquid: '#c8924a', crema: '#dba96a', glow: 'rgba(200,146,74,0.3)', label: 'Getting There', color: '#c8924a' }
  if (fill <= 60)  return { liquid: '#a06428', crema: '#c07c38', glow: 'rgba(160,100,40,0.4)', label: 'Half Cup', color: '#a06428' }
  if (fill <= 80)  return { liquid: '#7a3e10', crema: '#9a5420', glow: 'rgba(122,62,16,0.5)', label: 'Good Pour', color: '#c4853a' }
  if (fill <= 95)  return { liquid: '#4e2008', crema: '#6e3410', glow: 'rgba(210,140,60,0.6)', label: 'Almost Perfect', color: '#d4a060' }
  return             { liquid: '#2e1004', crema: '#4e2008', glow: 'rgba(230,160,60,0.8)', label: '✨ Perfect Brew', color: '#e8b870' }
}

interface Props {
  onClose: () => void
  onComplete: () => void
}

export default function QuickSip({ onClose, onComplete }: Props) {
  const { profile } = useAuth()
  const [fill, setFill] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [recentShops, setRecentShops] = useState<CoffeeShop[]>([])
  const [selectedShop, setSelectedShop] = useState<CoffeeShop | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showBoost, setShowBoost] = useState(false)
  const mugRef = useRef<HTMLDivElement>(null)
  const s = getMugStyle(fill)

  useEffect(() => {
    if (!profile) return
    // Load the user's 3 most recently visited shops for quick selection
    supabase
      .from('user_shop_visits')
      .select('*, coffee_shops(*)')
      .eq('user_id', profile.id)
      .order('last_visited', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        if (data?.length) {
          const shops = data.map((d: any) => d.coffee_shops).filter(Boolean)
          setRecentShops(shops)
          setSelectedShop(shops[0]) // auto-select most recent
        }
      })
  }, [profile])

  const calculateFill = useCallback((clientY: number) => {
    if (!mugRef.current) return
    const rect = mugRef.current.getBoundingClientRect()
    setFill(Math.max(0, Math.min(100, Math.round((1 - (clientY - rect.top) / rect.height) * 100))))
  }, [])

  async function handleSubmit() {
    if (!profile || !selectedShop || fill === 0) return
    setSubmitting(true)
    await supabase.from('ratings').insert({
      user_id: profile.id,
      shop_id: selectedShop.id,
      fill_level: fill,
      drink_name: null,
      vibe_tags: [],
      caption: null,
    })
    setShowBoost(true)
    setSubmitting(false)
  }

  // Mini mug dimensions
  const VW = 160, VH = 190
  const BX = 24, BY = 32, BW = 90, BH = 88, BR = 10
  const IX = BX + 4, IY = BY + 4, IW = BW - 8, IH = BH - 8
  const fillH = Math.round((fill / 100) * (IH - 2))
  const fillY = IY + IH - fillH

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.94)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-sm bg-coffee-700 rounded-t-3xl animate-slide-up overflow-hidden pb-8">

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="text-white font-display text-xl font-bold">Quick Sip</h2>
            <p className="text-coffee-300 text-sm">Rate in one tap — no details needed</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-coffee-600 flex items-center justify-center text-coffee-300">
            <X size={16} />
          </button>
        </div>

        {/* Shop selector — compact, shows recent shops */}
        <div className="px-5 mb-4">
          {recentShops.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {recentShops.map(shop => (
                <button
                  key={shop.id}
                  onClick={() => setSelectedShop(shop)}
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
                  style={{
                    background: selectedShop?.id === shop.id ? 'rgba(200,133,58,0.3)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${selectedShop?.id === shop.id ? 'rgba(200,133,58,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    color: selectedShop?.id === shop.id ? '#f5e6c8' : '#9b7a55',
                  }}
                >
                  <MapPin size={11} />
                  <span className="font-medium max-w-24 truncate">{shop.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-coffee-800 rounded-xl px-4 py-3 text-coffee-400 text-sm text-center">
              Rate a visit first to enable Quick Sip
            </div>
          )}
        </div>

        {/* Mug */}
        <div className="flex flex-col items-center px-5">
          <div
            ref={mugRef}
            style={{ cursor: 'ns-resize', userSelect: 'none', width: VW, height: VH }}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            onMouseMove={e => { if (isDragging) calculateFill(e.clientY) }}
            onTouchStart={() => setIsDragging(true)}
            onTouchEnd={() => setIsDragging(false)}
            onTouchMove={e => { e.preventDefault(); calculateFill(e.touches[0].clientY) }}
          >
            <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}
              style={{ filter: fill > 0 ? `drop-shadow(0 0 16px ${s.glow})` : 'none', transition: 'filter 0.3s' }}>
              <defs>
                <clipPath id="qs-inner"><rect x={IX} y={IY} width={IW} height={IH} rx={BR - 2} /></clipPath>
                <linearGradient id="qs-ceramic" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#1e1408" /><stop offset="50%" stopColor="#4a3318" /><stop offset="100%" stopColor="#1a1006" />
                </linearGradient>
                <linearGradient id="qs-liquid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.crema} /><stop offset="15%" stopColor={s.liquid} /><stop offset="100%" stopColor={s.liquid} stopOpacity="0.9" />
                </linearGradient>
              </defs>
              {/* Saucer */}
              <ellipse cx={BX + BW/2} cy={BY + BH + 18} rx={BW/2 + 14} ry={9} fill="#2a1a08" stroke="#6b4c20" strokeWidth="1" />
              {/* Handle */}
              <path d={`M ${BX+BW-2} ${BY+18} C ${BX+BW+28} ${BY+14} ${BX+BW+28} ${BY+BH-14} ${BX+BW-2} ${BY+BH-18}`} stroke="#5c3e18" strokeWidth="11" fill="none" strokeLinecap="round" />
              <path d={`M ${BX+BW-2} ${BY+24} C ${BX+BW+16} ${BY+21} ${BX+BW+16} ${BY+BH-21} ${BX+BW-2} ${BY+BH-24}`} stroke="#2a1a08" strokeWidth="5" fill="none" strokeLinecap="round" />
              {/* Body */}
              <rect x={BX} y={BY} width={BW} height={BH} rx={BR} fill="url(#qs-ceramic)" stroke="#7a5428" strokeWidth="1.5" />
              {/* Liquid */}
              {fill > 0 && (
                <g clipPath="url(#qs-inner)">
                  <rect x={IX} y={fillY} width={IW} height={fillH} fill="url(#qs-liquid)" style={{ transition: isDragging ? 'none' : 'y 0.15s, height 0.15s' }} />
                  <ellipse cx={IX + IW/2} cy={fillY + 1} rx={IW/2 - 1} ry={3} fill={s.crema} opacity={0.8} />
                </g>
              )}
              {/* Rim */}
              <rect x={BX - 2} y={BY - 5} width={BW + 4} height={10} rx={5} fill="#6b4c20" stroke="#8a6232" strokeWidth="1" />
              {/* SB emboss */}
              <text x={BX + BW/2} y={BY + BH/2 + 5} textAnchor="middle" fill="white" opacity="0.07" fontSize="22" fontWeight="bold" fontFamily="Georgia, serif">SB</text>
            </svg>
          </div>

          {/* Label */}
          <div className="text-center -mt-2 mb-4" style={{ minHeight: 48 }}>
            <p className="font-display text-xl font-bold" style={{ color: fill >= 80 ? '#d4a060' : 'white' }}>{s.label}</p>
            {fill > 0 && <p className="text-coffee-300 text-sm mt-0.5">{fill}%</p>}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={fill === 0 || !selectedShop || submitting}
            className="w-full py-4 rounded-2xl font-bold text-white text-lg transition-all disabled:opacity-40"
            style={{
              background: fill > 0 ? `linear-gradient(135deg, ${s.liquid}, ${s.crema})` : '#3d2f18',
              boxShadow: fill > 0 ? `0 6px 24px ${s.glow}` : 'none',
            }}
          >
            {submitting ? 'Posting...' : fill === 0 ? 'Drag the mug to rate' : `Post Quick Sip ☕`}
          </button>
        </div>
      </div>

      {showBoost && selectedShop && (
        <BoostToast
          shopId={selectedShop.id}
          shopName={selectedShop.name}
          onDone={() => { setShowBoost(false); onComplete(); onClose() }}
        />
      )}
    </div>
  )
}
