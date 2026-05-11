import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Clock, Camera, Image as ImageIcon, Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import MugSwipeHint from '../shared/MugSwipeHint'

type Props = { shop: any; onClose: () => void; onComplete: () => void }

const VIBE_OPTIONS = [
  '☕ Cozy', '⚡ Energizing', '❤️ Loved', '📚 Quiet',
  '🎉 Social', '🌙 Date Night', '💻 Work-friendly', '✨ Aesthetic',
]
const TIME_OPTIONS = [
  'Early Morning (5–8am)', 'Morning (8–10am)', 'Mid-Morning (10–12pm)',
  'Lunch (12–2pm)', 'Afternoon (2–5pm)', 'Evening (5–8pm)', 'Night (8pm+)',
]

function getMugStyle(fill: number) {
  if (fill === 0)  return { liquid: 'transparent', crema: 'transparent', glow: 'none',                    label: 'Slide to rate',   sub: '' }
  if (fill <= 20)  return { liquid: '#b0c4d4',     crema: '#ccdde8',     glow: 'rgba(176,196,212,0.25)', label: 'Just a Sip',      sub: 'Not quite right' }
  if (fill <= 40)  return { liquid: '#c8924a',     crema: '#dba96a',     glow: 'rgba(200,146,74,0.3)',   label: 'Getting There',   sub: 'Room to improve' }
  if (fill <= 60)  return { liquid: '#a06428',     crema: '#c07c38',     glow: 'rgba(160,100,40,0.35)',  label: 'Half Cup',        sub: 'Decent visit' }
  if (fill <= 80)  return { liquid: '#7a3e10',     crema: '#9a5420',     glow: 'rgba(122,62,16,0.4)',    label: 'Good Pour',       sub: 'Really enjoyed it' }
  if (fill <= 95)  return { liquid: '#4e2008',     crema: '#6e3410',     glow: 'rgba(210,140,60,0.55)',  label: 'Almost Perfect',  sub: 'Loved it' }
  return             { liquid: '#2e1004',     crema: '#4e1808',     glow: 'rgba(255,180,80,0.65)',  label: '✨ Perfect Cup',   sub: 'Absolute favourite' }
}

const MUG = { BX: 20, BY: 30, BW: 160, BH: 130, IX: 25, IW: 150, IH: 126 }

// Check localStorage to know if user has interacted with the mug before
const HINT_KEY = 'sb_mug_hint_seen'
function hasSeenHint(): boolean {
  try { return localStorage.getItem(HINT_KEY) === '1' } catch { return false }
}
function markHintSeen() {
  try { localStorage.setItem(HINT_KEY, '1') } catch {}
}

export default function MugRating({ shop, onClose, onComplete }: Props) {
  const { profile } = useAuth()
  const [fill, setFill] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const mugRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<'rate' | 'details' | 'submitting' | 'done'>('rate')
  const [drinkName, setDrinkName] = useState(shop?._prefillDrink || '')
  const [caption, setCaption] = useState('')
  const [selectedVibes, setSelectedVibes] = useState<string[]>([])
  const [visitTime, setVisitTime] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [showHint, setShowHint] = useState(!hasSeenHint())

  const s = getMugStyle(fill)
  const showSteam = fill >= 60
  const { BX, BY, BW, BH, IX, IW, IH } = MUG
  const fillY = BY + BH - Math.round((fill / 100) * IH)

  // Dismiss hint on first touch
  function dismissHint() {
    if (showHint) { setShowHint(false); markHintSeen() }
  }

  const calculateFill = useCallback((clientY: number) => {
    if (!mugRef.current) return
    const rect = mugRef.current.getBoundingClientRect()
    const raw = Math.max(0, Math.min(100, Math.round((1 - (clientY - rect.top) / rect.height) * 100)))
    setFill(raw)
  }, [])

  // Mouse handlers
  const onMD = (e: React.MouseEvent) => {
    dismissHint()
    isDraggingRef.current = true
    setIsDragging(true)
    calculateFill(e.clientY)
  }
  const onMM = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return
    calculateFill(e.clientY)
  }, [calculateFill])
  const onMU = useCallback(() => {
    isDraggingRef.current = false
    setIsDragging(false)
  }, [])

  // Touch handlers — native listener for passive:false scroll prevention
  const onTS = (e: React.TouchEvent) => {
    dismissHint()
    isDraggingRef.current = true
    setIsDragging(true)
    calculateFill(e.touches[0].clientY)
  }
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

  function toggleVibe(v: string) {
    setSelectedVibes((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  }

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function resolveShopId(shopData: any): Promise<string | null> {
    if (shopData.id && !String(shopData.id).startsWith('osm-')) return shopData.id
    const { data: existing } = await supabase
      .from('coffee_shops')
      .select('id')
      .ilike('name', shopData.name)
      .limit(1)
      .single()
    if (existing) return existing.id
    const { data: inserted } = await supabase
      .from('coffee_shops')
      .insert({
        name: shopData.name,
        address: shopData.address || null,
        city: shopData.city || null,
        state: shopData.state || null,
        lat: shopData.lat || null,
        lng: shopData.lng || null,
        is_active: true,
        is_certified: false,
        is_verified: false,
      })
      .select('id')
      .single()
    return inserted?.id ?? null
  }

  async function handleSubmit() {
    if (!profile || fill === 0) return
    setStep('submitting')
    try {
      const shopId = await resolveShopId(shop)
      if (!shopId) throw new Error('Could not resolve shop')

      let photoUrl: string | null = null
      if (photo) {
        const ext = photo.name.split('.').pop()
        const path = `ratings/${profile.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('photos').upload(path, photo)
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
          photoUrl = urlData?.publicUrl ?? null
        }
      }

      await supabase.from('ratings').insert({
        user_id: profile.id,
        shop_id: shopId,
        fill_level: fill,
        drink_name: drinkName.trim() || null,
        caption: caption.trim() || null,
        vibes: selectedVibes,
        visit_time: visitTime || null,
        photo_url: photoUrl,
        is_quick_sip: false,
      })

      // Update shop stats
      await supabase.rpc('increment_shop_visit', { shop_id_input: shopId })

      setStep('done')
      setTimeout(() => { onComplete(); onClose() }, 1400)
    } catch (err) {
      console.error(err)
      setStep('rate')
    }
  }

  // ── DONE ──
  if (step === 'done') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(13,9,4,0.95)' }}>
        <div className="text-center animate-bounce-in">
          <div className="text-6xl mb-4">☕</div>
          <p className="text-white font-display text-2xl font-bold">Posted!</p>
          <p className="text-amber-400 text-sm mt-2">{s.label}</p>
        </div>
      </div>
    )
  }

  // ── SUBMITTING ──
  if (step === 'submitting') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(13,9,4,0.95)' }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-amber-300 text-sm">Brewing your post...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(13,9,4,0.95)' }}>
      <div
        className="w-full max-w-sm rounded-t-3xl flex flex-col animate-slide-up"
        style={{ background: 'linear-gradient(160deg,#fdfaf5,#f0e0c0)', maxHeight: '92vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2 flex-shrink-0">
          <div>
            <h2 className="font-display text-xl font-bold text-stone-800">{shop.name}</h2>
            <p className="text-stone-500 text-xs">{[shop.city, shop.state].filter(Boolean).join(', ')}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-500">
            <X size={16} />
          </button>
        </div>

        {/* Step tabs */}
        <div className="flex gap-2 px-5 mb-4 flex-shrink-0">
          {(['rate', 'details'] as const).map((s2) => (
            <div
              key={s2}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{ background: step === s2 || (s2 === 'rate' && step === 'rate') ? '#c8853a' : '#e5d5c0' }}
            />
          ))}
        </div>

        {/* ── RATE STEP ── */}
        {step === 'rate' && (
          <div className="px-5 pb-6">
            {/* Mug */}
            <div
              ref={mugRef}
              className="relative mx-auto cursor-grab active:cursor-grabbing select-none"
              style={{ width: 200, height: 200, touchAction: 'none' }}
              onMouseDown={onMD}
              onTouchStart={onTS}
              onTouchEnd={onTEnd}
            >
              <svg width="200" height="200" viewBox="0 0 200 200">
                <defs>
                  <linearGradient id="mugBody" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#c4a882" />
                    <stop offset="100%" stopColor="#e8d4b8" />
                  </linearGradient>
                  <linearGradient id="mugShine" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="white" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                  </linearGradient>
                  <clipPath id="mugClip">
                    <rect x={IX} y={BY} width={IW} height={IH} rx="4" />
                  </clipPath>
                </defs>

                {/* Body */}
                <rect x={BX} y={BY} width={BW} height={BH} rx="10" fill="url(#mugBody)" stroke="#a07840" strokeWidth="1.5" />

                {/* Handle */}
                <path d={`M ${BX + BW} ${BY + 20} Q ${BX + BW + 35} ${BY + 30} ${BX + BW + 35} ${BY + BH / 2} Q ${BX + BW + 35} ${BY + BH - 30} ${BX + BW} ${BY + BH - 20}`}
                  fill="none" stroke="#a07840" strokeWidth="12" strokeLinecap="round" />
                <path d={`M ${BX + BW} ${BY + 24} Q ${BX + BW + 26} ${BY + 34} ${BX + BW + 26} ${BY + BH / 2} Q ${BX + BW + 26} ${BY + BH - 34} ${BX + BW} ${BY + BH - 24}`}
                  fill="none" stroke="#c4a882" strokeWidth="6" strokeLinecap="round" />

                {/* Liquid fill */}
                {fill > 0 && (
                  <g clipPath="url(#mugClip)">
                    <rect
                      x={IX} y={fillY} width={IW} height={IH - (fillY - BY)}
                      fill={`url(#liquidGrad)`}
                      style={{ transition: isDragging ? 'none' : 'y 0.18s ease-out, height 0.18s ease-out' }}
                    />
                    <defs>
                      <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.crema} />
                        <stop offset="30%" stopColor={s.liquid} />
                        <stop offset="100%" stopColor={s.liquid} stopOpacity="0.85" />
                      </linearGradient>
                    </defs>
                    {/* Surface wave */}
                    <ellipse cx={IX + IW / 2} cy={fillY} rx={IW / 2} ry="4"
                      fill={s.crema} opacity="0.7"
                      style={{ transition: isDragging ? 'none' : 'cy 0.18s ease-out' }} />
                  </g>
                )}

                {/* Rim */}
                <rect x={BX - 3} y={BY - 6} width={BW + 6} height={13} rx={7} fill="#8a6232" stroke="#a07848" strokeWidth="1" />

                {/* Shine */}
                <rect x={BX + 10} y={BY + 8} width={14} height={BH - 20} rx={7} fill="url(#mugShine)" />

                {/* Base */}
                <rect x={BX + 6} y={BY + BH - 6} width={BW - 12} height={10} rx={5} fill="#5a3818" stroke="#3d2814" strokeWidth="1" />

                {/* Steam */}
                {showSteam && [
                  { x: BX + 28, delay: '0s', dur: '1.6s' },
                  { x: BX + 55, delay: '0.4s', dur: '1.9s' },
                  { x: BX + 82, delay: '0.2s', dur: '1.7s' },
                ].map((steam, i) => (
                  <path key={i}
                    d={`M ${steam.x} ${BY - 8} Q ${steam.x - 8} ${BY - 22} ${steam.x + 5} ${BY - 38}`}
                    stroke="rgba(200,180,160,0.5)" strokeWidth="2.5" fill="none" strokeLinecap="round"
                    style={{ animation: `steamRise ${steam.dur} ease-in-out infinite`, animationDelay: steam.delay }}
                  />
                ))}
              </svg>

              {/* Swipe hint overlay */}
              <MugSwipeHint visible={showHint && fill === 0} />
            </div>

            {/* Rating label */}
            <div className="text-center mt-2 mb-6" style={{ minHeight: 56 }}>
              <p className="font-display text-2xl font-bold transition-all duration-300"
                style={{ color: fill >= 80 ? '#c8853a' : fill > 0 ? '#7a5030' : '#c4b090' }}>
                {s.label}
              </p>
              {s.sub && <p className="text-stone-400 text-sm mt-1">{s.sub}</p>}
              {fill > 0 && (
                <p className="text-stone-300 text-xs mt-1 font-mono">{fill}%</p>
              )}
            </div>

            <button
              onClick={() => fill > 0 && setStep('details')}
              className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all duration-300"
              style={{
                background: fill > 0
                  ? `linear-gradient(135deg, ${s.liquid}, #9b5e1a)`
                  : '#d4c4b0',
                boxShadow: fill > 0 ? `0 8px 30px ${s.glow}` : 'none',
                opacity: fill > 0 ? 1 : 0.6,
              }}
            >
              {fill === 0 ? 'Swipe mug to rate first' : 'Add Details →'}
            </button>
          </div>
        )}

        {/* ── DETAILS STEP ── */}
        {step === 'details' && (
          <div className="px-5 pb-8">
            {/* Drink name — pre-filled if user came via drink search */}
            <div className="mb-5">
              <label className="text-stone-500 text-xs uppercase tracking-wider mb-2 block">
                What did you drink? <span className="text-stone-400 normal-case">(optional)</span>
              </label>
              <input
                value={drinkName}
                onChange={(e) => setDrinkName(e.target.value)}
                placeholder="e.g. Oat Milk Latte, Cold Brew..."
                className="w-full bg-white rounded-xl px-4 py-3 text-sm text-stone-800 border border-stone-200 focus:border-amber-400 focus:outline-none placeholder-stone-300"
              />
            </div>

            {/* Visit time */}
            <div className="mb-5">
              <label className="text-stone-500 text-xs uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                <Clock size={12} /> When did you visit?
              </label>
              <div className="flex flex-wrap gap-2">
                {TIME_OPTIONS.map((t) => (
                  <button key={t} onClick={() => setVisitTime(t === visitTime ? '' : t)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={visitTime === t
                      ? { background: '#c8853a', color: '#fff' }
                      : { background: '#f0e8d8', color: '#7a5030' }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Vibes */}
            <div className="mb-5">
              <label className="text-stone-500 text-xs uppercase tracking-wider mb-2 block">Vibes</label>
              <div className="flex flex-wrap gap-2">
                {VIBE_OPTIONS.map((vibe) => (
                  <button key={vibe} onClick={() => toggleVibe(vibe)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={selectedVibes.includes(vibe)
                      ? { background: '#c8853a', color: '#fff' }
                      : { background: '#f0e8d8', color: '#7a5030' }}>
                    {vibe}
                  </button>
                ))}
              </div>
            </div>

            {/* Caption */}
            <div className="mb-5">
              <label className="text-stone-500 text-xs uppercase tracking-wider mb-2 block">Caption</label>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)}
                placeholder="Tell your friends about it..."
                rows={2}
                className="w-full bg-white rounded-xl px-4 py-3 text-sm text-stone-800 border border-stone-200 focus:border-amber-400 focus:outline-none placeholder-stone-300 resize-none" />
            </div>

            {/* Photo */}
            <div className="mb-6">
              <label className="text-stone-500 text-xs uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                <Camera size={12} /> Add a photo
              </label>
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="preview" className="w-full h-32 object-cover rounded-xl" />
                  <button onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full h-20 border-2 border-dashed border-stone-300 rounded-xl flex items-center justify-center gap-2 text-stone-400 text-sm transition-colors hover:border-amber-400 hover:text-amber-500">
                  <ImageIcon size={16} /> Choose photo
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </div>

            <button onClick={handleSubmit}
              className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all duration-300"
              style={{ background: `linear-gradient(135deg, ${getMugStyle(fill).liquid}, #9b5e1a)`, boxShadow: `0 8px 30px ${getMugStyle(fill).glow}` }}>
              <Zap size={16} className="inline mr-1.5" />
              Share to Feed
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
