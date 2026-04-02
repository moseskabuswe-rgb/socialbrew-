import { useState, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { CoffeeShop } from '../../lib/supabase'

type Props = { shop: CoffeeShop; onClose: () => void; onComplete: () => void }

const VIBE_OPTIONS = ['☕ Cozy', '⚡ Energizing', '❤️ Loved', '📚 Quiet', '🎉 Social', '🌙 Date Night', '💻 Work-friendly', '✨ Aesthetic']

function getMugStyle(fill: number) {
  if (fill === 0)  return { liquid: 'transparent', crema: 'transparent', glow: 'none',              label: 'Slide to rate',  sub: '' }
  if (fill <= 20)  return { liquid: '#b0c4d4',     crema: '#ccdde8',      glow: 'rgba(176,196,212,0.25)', label: 'Just a Sip',    sub: 'Not quite right' }
  if (fill <= 40)  return { liquid: '#c8924a',     crema: '#dba96a',      glow: 'rgba(200,146,74,0.3)',   label: 'Getting There', sub: 'Room to improve' }
  if (fill <= 60)  return { liquid: '#a06428',     crema: '#c07c38',      glow: 'rgba(160,100,40,0.38)',  label: 'Half Cup',      sub: 'Decent visit' }
  if (fill <= 80)  return { liquid: '#7a3e10',     crema: '#9a5420',      glow: 'rgba(122,62,16,0.45)',   label: 'Good Pour',     sub: 'Really enjoyed it' }
  if (fill <= 95)  return { liquid: '#4e2008',     crema: '#6e3410',      glow: 'rgba(210,140,60,0.6)',   label: 'Almost Perfect',sub: 'Loved it' }
  return             { liquid: '#2e1004',     crema: '#4e2008',      glow: 'rgba(230,160,60,0.8)',   label: '✨ Perfect Brew', sub: 'Absolute favorite' }
}

export default function MugRating({ shop, onClose, onComplete }: Props) {
  const { profile } = useAuth()
  const [fill, setFill] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedVibes, setSelectedVibes] = useState<string[]>([])
  const [drinkName, setDrinkName] = useState('')
  const [caption, setCaption] = useState('')
  const [step, setStep] = useState<'rate' | 'details' | 'submitting' | 'done'>('rate')
  const mugRef = useRef<HTMLDivElement>(null)
  const s = getMugStyle(fill)
  const showSteam = fill >= 65

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
  const toggleVibe = (v: string) => setSelectedVibes(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v].slice(0, 3))

  async function handleSubmit() {
    if (!profile) return
    setStep('submitting')
    const { error } = await supabase.from('ratings').insert({
      user_id: profile.id, shop_id: shop.id, fill_level: fill,
      drink_name: drinkName || null, vibe_tags: selectedVibes, caption: caption || null,
    })
    if (!error) { setStep('done'); setTimeout(() => { onComplete(); onClose() }, 1600) }
    else { setStep('details'); alert('Something went wrong. Please try again.') }
  }

  // Coffee mug SVG — wide, short, clearly a coffee mug with saucer
  // Viewbox: 200 x 240
  const VW = 200, VH = 240
  // Mug body: wide and short (coffee mug proportions)
  const BX = 30, BY = 40, BW = 110, BH = 110, BR = 12
  // Inner clip area for liquid
  const IX = BX + 4, IY = BY + 4, IW = BW - 8, IH = BH - 8
  const maxFillH = IH - 2
  const fillH = Math.round((fill / 100) * maxFillH)
  const fillY = IY + IH - fillH

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.94)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-sm bg-coffee-700 rounded-t-3xl animate-slide-up overflow-hidden" style={{ maxHeight: '93vh' }}>

        <div className="flex items-center justify-between p-5 pb-2">
          <div>
            <h2 className="text-white font-display text-xl font-bold">
              {step === 'done' ? '☕ Brewed!' : step === 'submitting' ? 'Posting...' : 'How was it?'}
            </h2>
            <p className="text-coffee-300 text-sm">{shop.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-coffee-600 flex items-center justify-center text-coffee-300 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {step === 'done' && (
          <div className="flex flex-col items-center py-14 animate-fade-in">
            <div className="text-6xl mb-4">☕</div>
            <p className="text-white font-display text-xl">Posted to your feed!</p>
            <p className="text-coffee-300 text-sm mt-1">+10 tokens earned</p>
          </div>
        )}

        {step === 'rate' && (
          <div className="px-5 pb-6">
            <p className="text-coffee-400 text-xs text-center mb-3 tracking-widest uppercase">Drag up to fill</p>

            <div className="flex flex-col items-center">
              {/* Mug drag zone */}
              <div ref={mugRef}
                onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
                onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onMU}
                style={{ cursor: 'ns-resize', userSelect: 'none', width: VW, height: VH }}>

                <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}
                  style={{
                    filter: fill > 0 ? `drop-shadow(0 0 20px ${s.glow})` : 'none',
                    transition: 'filter 0.4s ease'
                  }}>
                  <defs>
                    <clipPath id="mugInner">
                      <rect x={IX} y={IY} width={IW} height={IH} rx={BR - 2} />
                    </clipPath>
                    <linearGradient id="mugCeramic" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="#1e1408" />
                      <stop offset="25%"  stopColor="#3d2a14" />
                      <stop offset="55%"  stopColor="#4a3318" />
                      <stop offset="80%"  stopColor="#342210" />
                      <stop offset="100%" stopColor="#1a1006" />
                    </linearGradient>
                    <linearGradient id="mugShine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor="white" stopOpacity="0.14" />
                      <stop offset="50%"  stopColor="white" stopOpacity="0.05" />
                      <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="liquidFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={s.crema} />
                      <stop offset="12%"  stopColor={s.liquid} />
                      <stop offset="100%" stopColor={s.liquid} stopOpacity="0.9" />
                    </linearGradient>
                    <linearGradient id="saucerGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#4a3318" />
                      <stop offset="100%" stopColor="#2a1a08" />
                    </linearGradient>
                    <radialGradient id="saucerSheen" cx="50%" cy="30%" r="60%">
                      <stop offset="0%"   stopColor="white" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* ── SAUCER ── */}
                  <ellipse cx={BX + BW/2} cy={BY + BH + 22} rx={BW/2 + 18} ry={11}
                    fill="url(#saucerGrad)" stroke="#6b4c20" strokeWidth="1" />
                  <ellipse cx={BX + BW/2} cy={BY + BH + 22} rx={BW/2 + 18} ry={11}
                    fill="url(#saucerSheen)" />
                  {/* Saucer rim groove */}
                  <ellipse cx={BX + BW/2} cy={BY + BH + 22} rx={BW/2 + 8} ry={7}
                    fill="none" stroke="#5a3c14" strokeWidth="1" opacity="0.5" />

                  {/* ── HANDLE ── small, coffee-mug style, on the right ── */}
                  {/* Outer handle shape */}
                  <path
                    d={`M ${BX+BW-2} ${BY+22} C ${BX+BW+36} ${BY+18} ${BX+BW+36} ${BY+BH-18} ${BX+BW-2} ${BY+BH-22}`}
                    stroke="#5c3e18" strokeWidth="14" fill="none" strokeLinecap="round"
                  />
                  {/* Inner handle cutout */}
                  <path
                    d={`M ${BX+BW-2} ${BY+28} C ${BX+BW+22} ${BY+25} ${BX+BW+22} ${BY+BH-25} ${BX+BW-2} ${BY+BH-28}`}
                    stroke="#2a1a08" strokeWidth="6" fill="none" strokeLinecap="round"
                  />

                  {/* ── MUG BODY ── */}
                  <rect x={BX} y={BY} width={BW} height={BH} rx={BR}
                    fill="url(#mugCeramic)" stroke="#7a5428" strokeWidth="1.5" />

                  {/* ── LIQUID FILL ── */}
                  {fill > 0 && (
                    <g clipPath="url(#mugInner)">
                      <rect
                        x={IX} y={fillY} width={IW} height={fillH}
                        fill="url(#liquidFill)"
                        style={{ transition: isDragging ? 'none' : 'y 0.18s ease-out, height 0.18s ease-out' }}
                      />
                      {/* Crema surface */}
                      <ellipse
                        cx={IX + IW/2} cy={fillY + 1}
                        rx={IW/2 - 1} ry={4}
                        fill={s.crema} opacity={0.85}
                        style={{ transition: isDragging ? 'none' : 'cy 0.18s ease-out' }}
                      />
                      {/* Crema texture dots */}
                      {fill > 30 && [0.3, 0.55, 0.75].map((x, i) => (
                        <circle key={i}
                          cx={IX + IW * x} cy={fillY + 2}
                          r={2 + i}
                          fill={s.liquid} opacity={0.3}
                          style={{ transition: isDragging ? 'none' : 'cy 0.18s ease-out' }}
                        />
                      ))}
                    </g>
                  )}

                  {/* ── RIM ── */}
                  <rect x={BX - 3} y={BY - 6} width={BW + 6} height={13} rx={7}
                    fill="#6b4c20" stroke="#8a6232" strokeWidth="1" />
                  <rect x={BX} y={BY - 4} width={BW} height={8} rx={5}
                    fill="#4a3318" />

                  {/* ── CERAMIC SHINE ── */}
                  <rect x={BX + 10} y={BY + 8} width={14} height={BH - 20} rx={7}
                    fill="url(#mugShine)" />

                  {/* ── MUG BOTTOM ── */}
                  <rect x={BX + 6} y={BY + BH - 6} width={BW - 12} height={10} rx={5}
                    fill="#1e1408" stroke="#3d2a14" strokeWidth="1" />

                  {/* ── STEAM ── */}
                  {showSteam && (
                    <>
                      {[
                        { x: BX + 28, delay: '0s',    dur: '1.6s' },
                        { x: BX + 55, delay: '0.4s',  dur: '1.9s' },
                        { x: BX + 82, delay: '0.2s',  dur: '1.7s' },
                      ].map((steam, i) => (
                        <path key={i}
                          d={`M ${steam.x} ${BY - 8} Q ${steam.x - 8} ${BY - 22} ${steam.x + 5} ${BY - 38}`}
                          stroke="rgba(225,208,190,0.5)" strokeWidth="2.5" fill="none" strokeLinecap="round"
                          style={{
                            animation: `steamRise ${steam.dur} ease-in-out infinite`,
                            animationDelay: steam.delay
                          }}
                        />
                      ))}
                    </>
                  )}

                  {/* ── LOGO / EMBOSS on mug ── subtle "SB" text */}
                  <text x={BX + BW/2} y={BY + BH/2 + 5}
                    textAnchor="middle" fill="white" opacity="0.06"
                    fontSize="28" fontWeight="bold" fontFamily="Georgia, serif">
                    SB
                  </text>
                </svg>
              </div>

              {/* Rating label */}
              <div className="text-center -mt-4" style={{ minHeight: 56 }}>
                <p className="font-display text-2xl font-bold transition-all duration-300"
                  style={{ color: fill >= 80 ? '#d4a060' : 'white' }}>
                  {s.label}
                </p>
                {fill > 0 && <p className="text-coffee-300 text-sm mt-1">{fill}% · {s.sub}</p>}
              </div>

              {/* Progress strip */}
              <div className="w-full mt-2 h-1.5 bg-coffee-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-150"
                  style={{ width: `${fill}%`, background: `linear-gradient(90deg, ${s.crema}, ${s.liquid})` }} />
              </div>
            </div>

            <button onClick={() => fill > 0 && setStep('details')} disabled={fill === 0}
              className="w-full mt-5 py-3.5 rounded-2xl font-semibold text-white transition-all duration-300"
              style={{
                background: fill > 0 ? `linear-gradient(135deg, ${s.liquid}, ${s.crema})` : '#3d2f18',
                opacity: fill === 0 ? 0.4 : 1,
                boxShadow: fill > 0 ? `0 8px 28px ${s.glow}` : 'none'
              }}>
              {fill === 0 ? 'Slide the mug to rate' : 'Continue →'}
            </button>
          </div>
        )}

        {step === 'details' && (
          <div className="px-5 pb-6 overflow-y-auto" style={{ maxHeight: '72vh' }}>
            <div className="flex items-center gap-3 mb-5 bg-coffee-800 rounded-xl p-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: s.liquid }}>☕</div>
              <div>
                <p className="text-white font-semibold text-sm">{s.label}</p>
                <p className="text-coffee-300 text-xs">{fill}% · {shop.name}</p>
              </div>
              <button onClick={() => setStep('rate')} className="ml-auto text-caramel text-xs font-medium">Edit</button>
            </div>

            <div className="mb-4">
              <label className="text-coffee-300 text-xs uppercase tracking-wider mb-2 block">What did you order?</label>
              <input value={drinkName} onChange={e => setDrinkName(e.target.value)}
                placeholder="Vanilla latte, cold brew, espresso..."
                className="w-full bg-coffee-800 text-white rounded-xl px-4 py-3 text-sm border border-coffee-600 focus:border-caramel focus:outline-none placeholder-coffee-400" />
            </div>

            <div className="mb-4">
              <label className="text-coffee-300 text-xs uppercase tracking-wider mb-2 block">Vibes (up to 3)</label>
              <div className="flex flex-wrap gap-2">
                {VIBE_OPTIONS.map(vibe => (
                  <button key={vibe} onClick={() => toggleVibe(vibe)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${selectedVibes.includes(vibe) ? 'text-white border-transparent' : 'bg-coffee-800 text-coffee-300 border-coffee-600'}`}
                    style={selectedVibes.includes(vibe) ? { background: s.liquid } : {}}>
                    {vibe}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-coffee-300 text-xs uppercase tracking-wider mb-2 block">Caption (optional)</label>
              <textarea value={caption} onChange={e => setCaption(e.target.value)}
                placeholder="Tell your friends about it..."
                rows={2}
                className="w-full bg-coffee-800 text-white rounded-xl px-4 py-3 text-sm border border-coffee-600 focus:border-caramel focus:outline-none placeholder-coffee-400 resize-none" />
            </div>

            <button onClick={handleSubmit}
              className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all duration-300"
              style={{ background: `linear-gradient(135deg, ${s.liquid}, ${s.crema})`, boxShadow: `0 8px 28px ${s.glow}` }}>
              Share to Feed ☕
            </button>
          </div>
        )}

        {step === 'submitting' && (
          <div className="flex flex-col items-center py-14">
            <div className="w-10 h-10 rounded-full border-2 border-caramel border-t-transparent animate-spin mb-4" />
            <p className="text-coffee-300 text-sm">Brewing your post...</p>
          </div>
        )}
      </div>
    </div>
  )
}
