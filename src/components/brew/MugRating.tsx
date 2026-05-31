import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Clock, Camera, Image as ImageIcon, Zap } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import exifr from 'exifr'
import { notifyMention, notifyNewPost } from '../../lib/push'
import { isAffiliatedWithShop } from '../../lib/shopAffiliation'
import { useAuth } from '../../contexts/AuthContext'
import AnonymousFeedbackModal from '../shared/AnonymousFeedbackModal'
import MugSwipeHint from '../shared/MugSwipeHint'
import { compressImage } from '../../lib/compressImage'
import CreateStory from '../shared/CreateStory'
import { tryAwardPunch, type PunchAwardResult } from '../../lib/punchCard'

type Props = { shop: any; onClose: () => void; onComplete: () => void }

const VIBE_OPTIONS = [
  '☕ Cozy', '⚡ Energizing', '❤️ Loved', '📚 Quiet',
  '🎉 Social', '🌙 Date Night', '💻 Work-friendly', '✨ Aesthetic',
]

const TIME_OPTIONS = [
  'Early Morning (5–8am)', 'Morning (8–10am)', 'Mid-Morning (10am–12pm)',
  'Lunch (12–2pm)', 'Afternoon (2–5pm)', 'Evening (5–8pm)', 'Night (8pm+)',
]

// Original colour mapping — unchanged
function getMugStyle(fill: number) {
  if (fill === 0)  return { liquid: 'transparent', crema: 'transparent', glow: 'none',                    label: 'Slide to rate',   sub: '' }
  if (fill <= 20)  return { liquid: '#b0c4d4',     crema: '#ccdde8',     glow: 'rgba(176,196,212,0.25)', label: 'Just a Sip',      sub: 'Not quite right' }
  if (fill <= 40)  return { liquid: '#c8924a',     crema: '#dba96a',     glow: 'rgba(200,146,74,0.3)',   label: 'Getting There',   sub: 'Room to improve' }
  if (fill <= 60)  return { liquid: '#a06428',     crema: '#c07c38',     glow: 'rgba(160,100,40,0.38)',  label: 'Half Cup',        sub: 'Decent visit' }
  if (fill <= 80)  return { liquid: '#7a3e10',     crema: '#9a5420',     glow: 'rgba(122,62,16,0.45)',   label: 'Good Pour',       sub: 'Really enjoyed it' }
  if (fill <= 95)  return { liquid: '#4e2008',     crema: '#6e3410',     glow: 'rgba(210,140,60,0.6)',   label: 'Almost Perfect',  sub: 'Loved it' }
  return             { liquid: '#2e1004',     crema: '#4e2008',     glow: 'rgba(230,160,60,0.8)',   label: '✨ Perfect Brew',  sub: 'Absolute favorite' }
}

// localStorage hint key — shared with QuickSip
const HINT_KEY = 'sb_mug_hint_seen'
function hasSeenHint() { try { return localStorage.getItem(HINT_KEY) === '1' } catch { return false } }
function markHintSeen() { try { localStorage.setItem(HINT_KEY, '1') } catch {} }

export default function MugRating({ shop, onClose, onComplete }: Props) {
  const { profile } = useAuth()
  const [fill, setFill] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedVibes, setSelectedVibes] = useState<string[]>([])
  // Pre-fill drink name if user came via drink search in Discover
  const [drinkName, setDrinkName] = useState(shop?._prefillDrink || '')
  const [caption, setCaption] = useState('')
  const [visitTime, setVisitTime] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [visitedAt, setVisitedAt] = useState<string>(new Date().toISOString().split('T')[0])
  // Price fields — same as QuickSip
  const [drinkPrice, setDrinkPrice] = useState('')
  const [pricePerception, setPricePerception] = useState('')
  const [showPriceOnPost, setShowPriceOnPost] = useState(true)
  const [addToStory, setAddToStory] = useState(false)
  const [createdRatingId, setCreatedRatingId] = useState<string | null>(null)
  const [showStoryCreate, setShowStoryCreate] = useState(false)
  const [punchResult, setPunchResult] = useState<PunchAwardResult | null>(null)
  // Steps: rate → (feedback if low) → details → price → submitting → done
  const [step, setStep] = useState<'rate' | 'details' | 'price' | 'submitting' | 'done'>('rate')
  const [showFeedback, setShowFeedback] = useState(false)
  const mugRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [showHint, setShowHint] = useState(!hasSeenHint())

  // Revoke blob URLs when previews change or component unmounts to avoid memory leak
  useEffect(() => {
    return () => { photoPreviews.forEach(url => URL.revokeObjectURL(url)) }
  }, [photoPreviews])

  const s = getMugStyle(fill)
  const showSteam = fill >= 65

  // ── Original fill calculation — unchanged ──
  const calculateFill = useCallback((clientY: number) => {
    if (!mugRef.current) return
    const rect = mugRef.current.getBoundingClientRect()
    setFill(Math.max(0, Math.min(100, Math.round((1 - (clientY - rect.top) / rect.height) * 100))))
  }, [])

  // ── Original mouse handlers — unchanged ──
  const onMD = (e: React.MouseEvent) => { dismissHint(); setIsDragging(true); calculateFill(e.clientY) }
  const onMM = (e: React.MouseEvent) => { if (isDragging) calculateFill(e.clientY) }
  const onMU = () => setIsDragging(false)

  // ── Original touch handlers — unchanged (onTM uses e.preventDefault inline) ──
  const onTS = (e: React.TouchEvent) => { dismissHint(); setIsDragging(true); calculateFill(e.touches[0].clientY) }
  const onTM = (e: React.TouchEvent) => { e.preventDefault(); if (isDragging) calculateFill(e.touches[0].clientY) }
  const onTEnd = () => setIsDragging(false)

  const toggleVibe = (v: string) =>
    setSelectedVibes(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v].slice(0, 3))

  // ── Addition: dismiss hint on first interaction ──
  function dismissHint() {
    if (showHint) { setShowHint(false); markHintSeen() }
  }

    async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const remaining = 4 - photos.length
    const toAdd = files.slice(0, remaining)
    for (const file of toAdd) {
      if (file.size > 10 * 1024 * 1024) { alert('Each image must be under 10MB'); return }
    }
    setPhotos(prev => [...prev, ...toAdd])
    setPhotoPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))])
    // EXIF date from first photo
    if (toAdd[0]) {
      try {
        const exif = await exifr.parse(toAdd[0], ['DateTimeOriginal', 'DateTime', 'CreateDate'])
        const exifDate = exif?.DateTimeOriginal || exif?.DateTime || exif?.CreateDate
        if (exifDate) {
          const d = exifDate instanceof Date ? exifDate : new Date(String(exifDate))
          if (!isNaN(d.getTime())) {
            const daysDiff = (Date.now() - d.getTime()) / 86400000
            if (daysDiff >= 0 && daysDiff <= 365) setVisitedAt(d.toISOString().split('T')[0])
          }
        }
      } catch { /* EXIF unavailable — keep today */ }
    }
  }

  // ── Addition: resolveShopId for OSM shops not yet in DB ──
  async function resolveShopId(shopData: any): Promise<string | null> {
    const rawId = String(shopData.id || '')
    if (rawId && !rawId.startsWith('osm-') && !rawId.startsWith('fb-')) return shopData.id

    // Check if it already exists by name
    const { data: existing } = await supabase
      .from('coffee_shops')
      .select('id')
      .ilike('name', shopData.name)
      .limit(1)
      .maybeSingle()
    if (existing) return existing.id

    // Insert it
    const { data: inserted, error: insertErr } = await supabase
      .from('coffee_shops')
      .insert({
        name: shopData.name,
        address: shopData.address || null,
        city: shopData.city || null,
        state: shopData.state || null,
        lat: shopData.lat || null,
        lng: shopData.lng || null,
        status: 'active',
        is_active: true,
        is_certified: false,
        is_verified: false,
        vibes: [],
        avg_rating: 0,
        total_ratings: 0,
        weekly_visits: 0,
      })
      .select('id')
      .maybeSingle()
    if (insertErr) console.error('resolveShopId insert error:', insertErr)
    return inserted?.id ?? null
  }

  // ── Submit — correct columns, proper error surfacing, price fields, RPC non-blocking ──
  async function handleSubmit() {
    if (!profile) return
    setStep('submitting')

    // Upload up to 4 photos (compressed before upload)
    const photoUrls: string[] = []
    for (const photo of photos) {
      const path = `moments/${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
      const compressed = await compressImage(photo).catch(() => photo)
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' })
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        photoUrls.push(publicUrl)
      } else {
        console.warn('Photo upload failed (non-fatal):', uploadErr.message)
      }
    }
    const photoUrl = photoUrls[0] || null

    const shopId = await resolveShopId(shop)
    if (!shopId) { setStep('details'); alert('Something went wrong finding the shop. Please try again.'); return }

    if (isAffiliatedWithShop(profile, shopId)) {
      setStep('details')
      alert("You can't rate your own shop — but we'd love to hear what your customers think! Share Social Brew with them. ☕")
      return
    }

    const priceValue = drinkPrice ? parseFloat(drinkPrice) : null

    const { error: insertError } = await supabase.from('ratings').insert({
      user_id: profile.id,
      shop_id: shopId,
      fill_level: fill,
      drink_name: drinkName.trim() || null,
      vibe_tags: selectedVibes,
      caption: caption.trim() || null,
      visit_time: visitTime || null,
      photo_url: photoUrl,
      photo_urls: photoUrls.length > 0 ? photoUrls : null,
      visited_at: visitedAt,
      drink_price: priceValue,
      price_perception: pricePerception || null,
      show_price: showPriceOnPost,
    })

    if (insertError) {
      console.error('MugRating insert error:', insertError)
      alert(`Could not post: ${insertError.message}`)
      setStep('price')
      return
    }

    // Notify followers and process @mentions — fire and forget
    supabase
      .from('ratings')
      .select('id')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data: newRating }) => {
        if (!newRating) return
        // Notify all followers of new post via notifications table
        const { data: followers } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', profile.id)
        if (followers && followers.length > 0) {
          await supabase.from('notifications').insert(
            followers.map((f: any) => ({
              user_id: f.follower_id,
              actor_id: profile.id,
              type: 'new_post',
              rating_id: newRating.id,
            }))
          )
          notifyNewPost(followers.map((f: any) => f.follower_id), profile.username || 'Someone', shop.name, false, selectedVibes.length > 0, newRating.id)
        }
        // Process @mentions in caption
        if (caption.trim()) {
          const mentions = caption.match(/@([a-z0-9_.]+)/gi) || []
          for (const handle of mentions) {
            const username = handle.slice(1)
            const { data: mentioned } = await supabase
              .from('profiles').select('id').eq('username', username).maybeSingle()
            if (mentioned?.id && mentioned.id !== profile.id) {
              notifyMention(mentioned.id, profile.username || 'Someone', caption)
            }
          }
        }
      })

    // Capture new rating ID for story creation
    const { data: newRatingForStory } = await supabase
      .from('ratings')
      .select('id')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (newRatingForStory) setCreatedRatingId(newRatingForStory.id)

    // Award punch — non-blocking, fire and forget
    if (shopId) {
      tryAwardPunch(String(shopId), profile.id)
        .then(r => { if (r.awarded) setPunchResult(r) })
        .catch(() => {})
    }

    setStep('done')
    setTimeout(() => {
      // onComplete() must come LAST — it triggers setActiveTab('home') in the parent,
      // which unmounts BrewTab (and this component) before story/feedback can render.
      // Each branch below calls onComplete() + onClose() once its own flow is done.
      if (fill <= 50) setShowFeedback(true)
      else if (addToStory && newRatingForStory?.id) setShowStoryCreate(true)
      else { onComplete(); onClose() }
    }, 1600)
  }

  // ── DONE + optional feedback ──
  if (step === 'done') {
    return (
      <>
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(13,9,4,0.95)' }}>
          <div className="text-center animate-bounce-in px-6">
            <div className="text-6xl mb-4">☕</div>
            <p className="text-white font-display text-2xl font-bold">Brewed!</p>
            <p className="text-amber-300 text-sm mt-2">{s.label}</p>
            {punchResult?.awarded && (
              <div className="mt-5">
                {punchResult.rewardEarned ? (
                  <div className="bg-amber-500/20 rounded-xl px-4 py-3 border border-amber-500/40">
                    <p className="text-amber-300 font-bold text-sm">🎉 Reward earned!</p>
                    <p className="text-amber-200/70 text-xs mt-0.5">
                      {punchResult.newCount}/{punchResult.required} punches — redeem in your profile
                    </p>
                  </div>
                ) : (
                  <div className="bg-amber-500/10 rounded-xl px-4 py-2 border border-amber-500/20">
                    <p className="text-amber-400 text-sm">+1 punch earned! ☕ {punchResult.newCount}/{punchResult.required}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {showFeedback && (
          <AnonymousFeedbackModal
            shopId={String(shop?.id || '')}
            shopName={shop?.name || 'this shop'}
            fillLevel={fill}
            onSkip={() => { onComplete(); onClose() }}
            onSent={() => { onComplete(); onClose() }}
          />
        )}
        {showStoryCreate && createdRatingId && (
          <CreateStory
            prefillRatingId={createdRatingId}
            prefillShopId={typeof shop?.id === 'string' && !shop.id.startsWith('osm-') ? shop.id : undefined}
            onClose={() => { setShowStoryCreate(false); onComplete(); onClose() }}
            onCreated={() => { setShowStoryCreate(false); onComplete(); onClose() }}
          />
        )}
      </>
    )
  }

  if (step === 'submitting') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(13,9,4,0.95)' }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-amber-300 text-sm">Posting your brew...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(13,9,4,0.95)' }}>
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
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-stone-500">
            <X size={16} />
          </button>
        </div>

        {/* ── RATE STEP ── */}
        {step === 'rate' && (
          <div className="px-5 pb-6">
            <p className="text-center text-stone-400 text-xs uppercase tracking-wider mb-3">How was the drink?</p>
            {/* Mug — original SVG + original touch handlers preserved */}
            <div
              ref={mugRef}
              className="relative mx-auto select-none"
              style={{ width: 200, height: 210, cursor: 'ns-resize', touchAction: 'none' }}
              onMouseDown={onMD}
              onMouseMove={onMM}
              onMouseUp={onMU}
              onMouseLeave={onMU}
              onTouchStart={onTS}
              onTouchMove={onTM}
              onTouchEnd={onTEnd}
            >
              {/* Original SVG mug */}
              <svg width="200" height="210" viewBox="0 0 200 210">
                <defs>
                  <linearGradient id="ceramicGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#e8d8bc" />
                    <stop offset="50%" stopColor="#f0e4cc" />
                    <stop offset="100%" stopColor="#dcc8a8" />
                  </linearGradient>
                  <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.crema} />
                    <stop offset="20%" stopColor={s.liquid} />
                    <stop offset="100%" stopColor={s.liquid} />
                  </linearGradient>
                  <linearGradient id="shineGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="white" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                  </linearGradient>
                  <clipPath id="mugClip">
                    <rect x="27" y="35" width="130" height="130" rx="8" />
                  </clipPath>
                </defs>

                {/* Mug body */}
                <rect x="22" y="30" width="140" height="140" rx="12"
                  fill="url(#ceramicGrad)" stroke="#c8a878" strokeWidth="1.5" />

                {/* Handle */}
                <path d="M162 60 Q195 75 195 100 Q195 125 162 140"
                  fill="none" stroke="#c8a878" strokeWidth="14" strokeLinecap="round" />
                <path d="M162 62 Q188 76 188 100 Q188 124 162 138"
                  fill="none" stroke="#e8d4b0" strokeWidth="7" strokeLinecap="round" />

                {/* Liquid fill */}
                {fill > 0 && (
                  <g clipPath="url(#mugClip)">
                    <rect
                      x="27"
                      y={35 + 130 - Math.round((fill / 100) * 130)}
                      width="130"
                      height={Math.round((fill / 100) * 130)}
                      fill="url(#liquidGrad)"
                      style={{ transition: isDragging ? 'none' : 'y 0.15s ease-out, height 0.15s ease-out' }}
                    />
                    {/* Crema surface */}
                    <ellipse
                      cx="92"
                      cy={35 + 130 - Math.round((fill / 100) * 130)}
                      rx="65" ry="5"
                      fill={s.crema}
                      opacity="0.8"
                      style={{ transition: isDragging ? 'none' : 'cy 0.15s ease-out' }}
                    />
                  </g>
                )}

                {/* Rim */}
                <rect x="18" y="24" width="148" height="16" rx="8"
                  fill="#8a6840" stroke="#a07848" strokeWidth="1" />

                {/* Shine overlay */}
                <rect x="32" y="36" width="18" height="118" rx="9"
                  fill="url(#shineGrad)" />

                {/* Base */}
                <rect x="30" y="164" width="124" height="12" rx="6"
                  fill="#6a4828" stroke="#4a3018" strokeWidth="1" />

                {/* Steam — original logic: show at >= 65% */}
                {showSteam && (
                  <>
                    {[
                      { x1: 65, y1: 22, x2: 58, y2: 2, x3: 68, y3: -12, delay: '0s', dur: '1.8s' },
                      { x1: 92, y1: 22, x2: 85, y2: 2, x3: 95, y3: -12, delay: '0.5s', dur: '2.1s' },
                      { x1: 119, y1: 22, x2: 112, y2: 2, x3: 122, y3: -12, delay: '0.25s', dur: '1.9s' },
                    ].map((s2, i) => (
                      <path key={i}
                        d={`M${s2.x1},${s2.y1} Q${s2.x2},${s2.y2} ${s2.x3},${s2.y3}`}
                        stroke="rgba(200,180,160,0.5)" strokeWidth="2.5" fill="none" strokeLinecap="round"
                        style={{ animation: `steamRise ${s2.dur} ease-in-out infinite`, animationDelay: s2.delay }}
                      />
                    ))}
                  </>
                )}
              </svg>

              {/* ── ADDITION: Swipe hint (only shows until first interaction) ── */}
              <MugSwipeHint visible={showHint && fill === 0} />

              {/* ── ADDITION: Swipe up arrows — visible when fill === 0 and hint has been seen ── */}
              {fill === 0 && !showHint && (
                <div
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 pointer-events-none"
                  style={{ animation: 'bounceUp 1.4s ease-in-out infinite' }}
                >
                  {[0.3, 0.6, 1].map((opacity, i) => (
                    <svg key={i} width="20" height="12" viewBox="0 0 20 12" style={{ opacity }}>
                      <polyline points="2,10 10,2 18,10"
                        fill="none" stroke="#9b7a45" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ))}
                  <p className="text-coffee-400 text-xs mt-0.5 font-medium">Swipe up</p>
                </div>
              )}
            </div>

            {/* Rating label */}
            <div className="text-center mt-3 mb-6" style={{ minHeight: 56 }}>
              <p className="font-display text-2xl font-bold transition-all duration-300"
                style={{ color: fill > 0 ? '#7a5030' : '#c4a878' }}>
                {s.label}
              </p>
              {s.sub && <p className="text-stone-400 text-sm mt-1">{s.sub}</p>}
              {fill > 0 && <p className="text-stone-300 text-xs mt-1 font-mono">{fill}%</p>}
            </div>

            <button
              onClick={() => { if (fill > 0) setStep('details') }}
              disabled={fill === 0}
              className="w-full py-3.5 rounded-2xl font-semibold text-white transition-all duration-300"
              style={{
                background: fill > 0 ? `linear-gradient(135deg, ${s.liquid}, #9b5e1a)` : '#d4c4b0',
                boxShadow: fill > 0 ? `0 8px 30px ${s.glow}` : 'none',
                opacity: fill > 0 ? 1 : 0.6,
              }}
            >
              {fill === 0 ? 'Swipe up to rate first' : 'Add Details →'}
            </button>
          </div>
        )}

        {/* ── DETAILS STEP — original, with additions: photo, visitTime, drinkName pre-fill ── */}
        {step === 'details' && (
          <div className="px-5 pb-8">
            {/* Drink name */}
            <div className="mb-4">
              <label className="text-stone-500 text-xs uppercase tracking-wider mb-2 block">
                What did you drink? <span className="text-stone-400 normal-case">(optional)</span>
              </label>
              <input
                value={drinkName}
                onChange={e => setDrinkName(e.target.value)}
                placeholder="e.g. Oat Milk Latte, Cold Brew..."
                className="w-full bg-white rounded-xl px-4 py-3 text-sm text-stone-800 border border-stone-200 focus:border-amber-400 focus:outline-none placeholder-stone-300"
              />
            </div>

            {/* Visit time */}
            <div className="mb-4">
              <label className="text-stone-500 text-xs uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                <Clock size={11} /> When?
              </label>
              <div className="flex flex-wrap gap-2">
                {TIME_OPTIONS.map(t => (
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

            {/* Vibes — original: max 3 */}
            <div className="mb-4">
              <label className="text-stone-500 text-xs uppercase tracking-wider mb-2 block">
                Vibes <span className="text-stone-400 normal-case">(up to 3)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {VIBE_OPTIONS.map(vibe => (
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
            <div className="mb-4">
              <label className="text-stone-500 text-xs uppercase tracking-wider mb-2 block">Caption</label>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="Tell your friends about it..."
                rows={2}
                className="w-full bg-white rounded-xl px-4 py-3 text-sm text-stone-800 border border-stone-200 focus:border-amber-400 focus:outline-none placeholder-stone-300 resize-none"
              />
            </div>

            {/* Add to story toggle */}
            <div className="flex items-center justify-between px-1 py-3 mb-4 border-t border-stone-200">
              <div>
                <p className="text-stone-700 text-sm font-semibold">Add to my story</p>
                <p className="text-stone-400 text-xs">Share this brew as a 24hr story</p>
              </div>
              <button
                onClick={() => setAddToStory(v => !v)}
                className="w-12 h-6 rounded-full relative transition-all flex-shrink-0"
                style={{ background: addToStory ? '#c8853a' : '#d4c4b0' }}
              >
                <div
                  className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow-sm"
                  style={{ left: addToStory ? '26px' : '2px' }}
                />
              </button>
            </div>

            {/* Visit Date */}
            <div className="mb-4">
              <label className="text-stone-500 text-xs uppercase tracking-wider mb-2 block">When did you visit?</label>
              <div className="flex gap-2 mb-2">
                {[
                  { label: 'Today', val: new Date().toISOString().split('T')[0] },
                  { label: 'Yesterday', val: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
                ].map(opt => (
                  <button key={opt.label} onClick={() => setVisitedAt(opt.val)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
                    style={visitedAt === opt.val
                      ? { background: s.liquid, color: '#fff', borderColor: 'transparent' }
                      : { background: '#f0e8d8', color: '#7a5030', borderColor: '#e5d5c0' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={visitedAt}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setVisitedAt(e.target.value)}
                className="w-full bg-white rounded-xl px-4 py-2.5 text-sm text-stone-800 border border-stone-200 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {/* Photos — up to 4 */}
            <div className="mb-6">
              <label className="text-stone-500 text-xs uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                <Camera size={11} /> Add photos {photos.length > 0 && `(${photos.length}/4)`}
              </label>
              {photoPreviews.length > 0 && (
                <div className={`grid gap-2 mb-2 ${photoPreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {photoPreviews.map((preview, i) => (
                    <div key={i} className="relative">
                      <img src={preview} alt={`photo ${i+1}`} className="w-full h-24 object-cover rounded-xl" />
                      <button
                        onClick={() => {
                          setPhotos(prev => prev.filter((_, idx) => idx !== i))
                          setPhotoPreviews(prev => prev.filter((_, idx) => idx !== i))
                        }}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {photos.length < 4 && (
                <button onClick={() => { if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click() } }}
                  className="w-full h-16 border-2 border-dashed border-stone-300 rounded-xl flex items-center justify-center gap-2 text-stone-400 text-sm transition-colors hover:border-amber-400 hover:text-amber-500">
                  <ImageIcon size={16} />
                  {photos.length === 0 ? 'Add photos' : 'Add more'}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
            </div>

            <button onClick={() => setStep('price')}
              className="w-full py-3.5 rounded-2xl font-semibold text-white"
              style={{ background: `linear-gradient(135deg, ${s.liquid}, #9b5e1a)`, boxShadow: `0 8px 30px ${s.glow}` }}>
              <Zap size={16} className="inline mr-1.5" />
              Next →
            </button>
          </div>
        )}

        {/* ── PRICE STEP ── */}
        {step === 'price' && (
          <div className="px-5 pb-8">
            {/* Price — inline, no separate component needed */}
            <div className="mb-5">
              <p className="text-stone-500 text-xs uppercase tracking-wider mb-3">
                💰 What did you pay? <span className="normal-case text-stone-400">(optional)</span>
              </p>
              <div className="flex items-center bg-white rounded-xl px-4 py-3 border border-stone-200 mb-3 gap-2">
                <span className="text-stone-400 font-semibold">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={drinkPrice}
                  onChange={e => setDrinkPrice(e.target.value)}
                  className="flex-1 bg-transparent text-stone-800 text-sm focus:outline-none"
                />
              </div>
              <div className="flex gap-2 mb-3">
                {[
                  { key: 'steal', label: '🤑 Steal' },
                  { key: 'worth_it', label: '✅ Worth it' },
                  { key: 'overpriced', label: '😬 Overpriced' },
                ].map(opt => (
                  <button key={opt.key}
                    onClick={() => setPricePerception(pricePerception === opt.key ? '' : opt.key)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold border transition-all"
                    style={pricePerception === opt.key
                      ? { background: '#c8853a', color: '#fff', borderColor: '#c8853a' }
                      : { background: '#f5ead8', color: '#7a5030', borderColor: '#e5d5c0' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {(drinkPrice || pricePerception) && (
                <div className="flex items-center justify-between bg-stone-50 rounded-xl px-4 py-3 border border-stone-100">
                  <div>
                    <p className="text-stone-700 text-xs font-semibold">Show on my post</p>
                    <p className="text-stone-400 text-xs">Others can see the price &amp; value</p>
                  </div>
                  <button
                    onClick={() => setShowPriceOnPost(v => !v)}
                    className="w-10 h-6 rounded-full relative transition-all flex-shrink-0"
                    style={{ background: showPriceOnPost ? '#c8853a' : '#d4c4b0' }}>
                    <div className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all"
                      style={{ left: showPriceOnPost ? '22px' : '2px' }} />
                  </button>
                </div>
              )}
            </div>
            <button onClick={handleSubmit}
              className="w-full py-3.5 rounded-2xl font-semibold text-white mt-4 flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${s.liquid}, #9b5e1a)`, boxShadow: `0 8px 30px ${s.glow}` }}>
              <Zap size={16} /> Share to Feed
            </button>
            <button onClick={handleSubmit}
              className="w-full py-2 mt-2 text-stone-400 text-sm">
              Skip & post now
            </button>
          </div>
        )}
      </div>
      {showStoryCreate && createdRatingId && (
        <CreateStory
          prefillRatingId={createdRatingId}
          prefillShopId={typeof shop?.id === 'string' && !shop.id.startsWith('osm-') ? shop.id : undefined}
          onClose={() => { setShowStoryCreate(false); onClose() }}
          onCreated={() => { setShowStoryCreate(false); onClose() }}
        />
      )}
    </div>
  )
}
