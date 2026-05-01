import { useState, useRef, useCallback, useEffect } from 'react'
import exifr from 'exifr'
import { X, Clock, Camera, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { resolveShopId } from '../../lib/shopUtils'
import { sendPushToUser } from '../../lib/push'
import { notifyMention } from '../../lib/push'
import { useAuth } from '../../contexts/AuthContext'

type Props = { shop: any; onClose: () => void; onComplete: (shopName?: string, wasFirst?: boolean) => void }

const VIBE_OPTIONS = ['☕ Cozy', '⚡ Energizing', '❤️ Loved', '📚 Quiet', '🎉 Social', '🌙 Date Night', '💻 Work-friendly', '✨ Aesthetic']
const TIME_OPTIONS = ['Early Morning (5–8am)', 'Morning (8–10am)', 'Mid-Morning (10–12pm)', 'Lunch (12–2pm)', 'Afternoon (2–5pm)', 'Evening (5–8pm)', 'Night (8pm+)']

function getMugStyle(fill: number) {
  // New colors only — wording unchanged from original
  if (fill === 0)   return { liquid: 'transparent', crema: 'transparent', glow: 'none',                  label: 'Slide to rate',    sub: '' }
  if (fill <= 59)   return { liquid: '#d4b896',      crema: '#e8d4bc',     glow: 'rgba(212,184,150,0.2)', label: 'Not My Cup',       sub: 'Did not vibe with it' }
  if (fill <= 69)   return { liquid: '#c49a6c',      crema: '#d9b48c',     glow: 'rgba(196,154,108,0.3)', label: 'Just a Sip',       sub: 'Something was missing' }
  if (fill <= 79)   return { liquid: '#b87333',      crema: '#d4894a',     glow: 'rgba(184,115,51,0.35)', label: 'Decent Pour',      sub: 'Nothing memorable' }
  if (fill <= 89)   return { liquid: '#9b5e1a',      crema: '#c07830',     glow: 'rgba(155,94,26,0.4)',   label: 'Good Brew',        sub: 'Solid — would return' }
  if (fill <= 99)   return { liquid: '#6b3410',      crema: '#9b5520',     glow: 'rgba(200,130,50,0.5)',  label: 'Loved It',         sub: 'One of the best' }
  return              { liquid: '#3d1a06',      crema: '#c8853a',     glow: 'rgba(220,160,60,0.7)',  label: '✨ Perfect Brew',  sub: 'Rare — truly exceptional' }
}

export default function MugRating({ shop, onClose, onComplete }: Props) {
  const { profile } = useAuth()
  const [fill, setFill] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedVibes, setSelectedVibes] = useState<string[]>([])
  const [drinkName, setDrinkName] = useState('')
  const [caption, setCaption] = useState('')
  const [visitTime, setVisitTime] = useState('')
  const [visitedAt, setVisitedAt] = useState<string>(new Date().toISOString().split('T')[0]) // defaults to today
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  // Keep single photo/photoPreview aliases for backward compat with upload logic
  const photo = photos[0] || null
  const photoPreview = photoPreviews[0] || null
  const [step, setStep] = useState<'rate' | 'details' | 'submitting' | 'done'>('rate')
  const [addToStory, setAddToStory] = useState(false)
  const mugRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const s = getMugStyle(fill)
  const showSteam = fill >= 65

  const isDraggingRef = useRef(false)

  const calculateFill = useCallback((clientY: number, snap = false) => {
    if (!mugRef.current) return
    const rect = mugRef.current.getBoundingClientRect()
    // Extend detection slightly beyond edges so 0 and 100 are reachable
    const raw = (1 - (clientY - rect.top) / rect.height) * 100
    const clamped = Math.max(0, Math.min(100, raw))
    // Only round on release for smooth dragging, integer on snap
    setFill(snap ? Math.round(clamped) : Math.round(clamped))
  }, [])

  const onMD = (e: React.MouseEvent) => { isDraggingRef.current = true; setIsDragging(true); calculateFill(e.clientY) }
  const onMM = (e: React.MouseEvent) => { if (isDraggingRef.current) calculateFill(e.clientY) }
  const onMU = () => { isDraggingRef.current = false; setIsDragging(false) }
  const onTS = (e: React.TouchEvent) => { isDraggingRef.current = true; setIsDragging(true); calculateFill(e.touches[0].clientY) }
  // onTM handled via native listener below to allow passive:false

  // Native touch listener with passive:false to prevent page scroll while dragging mug
  useEffect(() => {
    const el = mugRef.current
    if (!el) return
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return
      e.preventDefault() // stops page scroll — only works with passive:false
      calculateFill(e.touches[0].clientY)
    }
    const handleTouchEnd = () => { isDraggingRef.current = false; setIsDragging(false) }
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd)
    el.addEventListener('touchcancel', handleTouchEnd)
    return () => {
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [calculateFill])
  const toggleVibe = (v: string) => setSelectedVibes(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v].slice(0, 3))

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
    // Read EXIF from first new photo for date
    if (toAdd[0]) {
      try {
        const exif = await exifr.parse(toAdd[0], ['DateTimeOriginal', 'DateTime', 'CreateDate'])
        const exifDate = exif?.DateTimeOriginal || exif?.DateTime || exif?.CreateDate
        if (exifDate) {
          const d = exifDate instanceof Date ? exifDate : new Date(String(exifDate))
          if (!isNaN(d.getTime())) {
            const daysDiff = (Date.now() - d.getTime()) / 86400000
            if (daysDiff >= 0 && daysDiff <= 30) setVisitedAt(d.toISOString().split('T')[0])
          }
        }
      } catch {}
    }
  }

  function removePhoto(idx: number) {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (!profile) return
    setStep('submitting')
    // Upload all photos and collect URLs
    const uploadedUrls: string[] = []
    for (const p of photos) {
      const ext = p.name.split('.').pop() || 'jpg'
      const path = `moments/${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, p, { upsert: true })
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        uploadedUrls.push(publicUrl)
      }
    }
    const photoUrl = uploadedUrls[0] || null  // primary photo for backward compat

    const captionParts = [caption].filter(Boolean)

    // Resolve shop ID — auto-adds OSM shops to the database if not already there
    const shopId = await resolveShopId(shop)

    // Check if first rating for this shop
    let willBeFirst = false
    if (shopId) {
      const { count } = await supabase.from('ratings').select('id', { count: 'exact', head: true }).eq('shop_id', shopId)
      willBeFirst = (count || 0) === 0
    }

    const { error } = await supabase.from('ratings').insert({
      user_id: profile.id,
      shop_id: shopId,
      fill_level: fill,
      drink_name: drinkName || null,
      vibe_tags: selectedVibes,
      caption: captionParts.join(' · ') || null,
      photo_url: photoUrl,
      photo_urls: uploadedUrls,
      visit_time: visitTime || null,
      visited_at: visitedAt,
    })
    if (!error) {
      const { data: newRating } = await supabase
        .from('ratings')
        .select('id')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (newRating) {
        // Notify @mentions in caption
        if (caption) {
          const mentioned = caption.match(/@(\w+)/g)
          if (mentioned) {
            for (const handle of mentioned) {
              const username = handle.slice(1)
              const { data: mentionedUser } = await supabase.from('profiles').select('id').eq('username', username).single()
              if (mentionedUser?.id && mentionedUser.id !== profile.id) {
                notifyMention(mentionedUser.id, profile.username || 'Someone', caption)
              }
            }
          }
        }
      }
      setStep('done')

      // If user toggled "add to story", silently create it from the rating data
      if (addToStory) {
        await supabase.from('stories').insert({
          user_id: profile.id,
          shop_id: shopId,
          rating_id: newRating?.id || null,
          photo_url: photoUrl,
          caption: captionParts.join(' · ') || null,
          story_type: 'rating',
        })
        // Notify followers
        try {
          const { data: followers } = await supabase
            .from('follows').select('follower_id').eq('following_id', profile.id)
          if (followers && followers.length > 0) {
            await Promise.all(
              followers.map((f: any) =>
                sendPushToUser(
                  f.follower_id,
                  `${profile.username || 'Someone'} rated a visit`,
                  `${shop?.name || 'a coffee shop'}${captionParts.length ? ` — ${captionParts[0]}` : ''}`,
                  { type: 'story' }
                )
              )
            )
          }
        } catch {}
      }

      setTimeout(() => { onComplete(shop?.name, willBeFirst); onClose() }, willBeFirst ? 3000 : 1600)
    }
    else { setStep('details'); console.error('Rating insert error:', error); alert(`Error: ${error?.message || 'Something went wrong. Please try again.'}`) }
  }

  const VW = 200, VH = 220
  const BX = 30, BY = 35, BW = 110, BH = 105, BR = 12
  const IH = BH - 8
  const fillH = Math.round((fill / 100) * IH)
  const fillY = BY + BH - fillH

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(8,4,1,0.88)'}}>
      <div className="w-full max-w-sm rounded-t-3xl animate-slide-up overflow-hidden"
        style={{ maxHeight: '93vh', background: 'linear-gradient(160deg, #fdfaf5, #f5ead8)' }}>

        <div className="flex items-center justify-between p-5 pb-2">
          <div>
            <h2 className="text-coffee-800 font-display text-xl font-bold">
              {step === 'done' ? '☕ Brewed!' : step === 'submitting' ? 'Posting...' : 'How was it?'}
            </h2>
            <p className="text-coffee-400 text-sm">{shop?.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cream-200 flex items-center justify-center text-coffee-500">
            <X size={16} />
          </button>
        </div>

        {step === 'done' && (
          <div className="flex flex-col items-center py-14 animate-fade-in">
            <div className="text-6xl mb-4">☕</div>
            <p className="text-coffee-700 font-display text-xl">Posted!</p>
          </div>
        )}

        {step === 'rate' && (
          <div className="px-5 pb-6">
            <p className="text-coffee-400 text-xs text-center mb-3 tracking-widest uppercase">How was the drink?</p>
            <div className="flex flex-col items-center">
              <div ref={mugRef}
                onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onMU}
                onTouchStart={onTS}
                style={{ cursor: 'ns-resize', userSelect: 'none', touchAction: 'none', width: VW, height: VH }}>
                <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}
                  style={{ filter: fill > 0 ? `drop-shadow(0 0 12px ${s.glow})` : 'none', transition: 'filter 0.4s' }}>
                  <defs>
                    <clipPath id="mr-clip"><rect x={BX+4} y={BY+4} width={BW-8} height={BH-8} rx={BR-2} /></clipPath>
                    <linearGradient id="mr-ceramic" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#e8d8bc" /><stop offset="40%" stopColor="#f0e4cc" /><stop offset="100%" stopColor="#dcc8a8" />
                    </linearGradient>
                    <linearGradient id="mr-liquid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={s.crema} /><stop offset="15%" stopColor={s.liquid} /><stop offset="100%" stopColor={s.liquid} stopOpacity="0.9" />
                    </linearGradient>
                    <linearGradient id="mr-saucer" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e8d8bc" /><stop offset="100%" stopColor="#cbb898" />
                    </linearGradient>
                  </defs>
                  <ellipse cx={BX+BW/2} cy={BY+BH+18} rx={BW/2+16} ry={9} fill="url(#mr-saucer)" stroke="#c8b090" strokeWidth="1" />
                  <path d={`M ${BX+BW-2} ${BY+20} C ${BX+BW+36} ${BY+16} ${BX+BW+36} ${BY+BH-16} ${BX+BW-2} ${BY+BH-20}`}
                    stroke="#c8b090" strokeWidth="13" fill="none" strokeLinecap="round" />
                  <path d={`M ${BX+BW-2} ${BY+20} C ${BX+BW+24} ${BY+17} ${BX+BW+24} ${BY+BH-17} ${BX+BW-2} ${BY+BH-20}`}
                    stroke="#f0e4cc" strokeWidth="6" fill="none" strokeLinecap="round" />
                  <rect x={BX} y={BY} width={BW} height={BH} rx={BR} fill="url(#mr-ceramic)" stroke="#c8b090" strokeWidth="1.5" />
                  {fill > 0 && (
                    <g clipPath="url(#mr-clip)">
                      <rect x={BX+4} y={fillY} width={BW-8} height={fillH} fill="url(#mr-liquid)"
                        style={{ transition: isDragging ? 'none' : 'y 0.15s ease, height 0.15s ease' }} />
                      <ellipse cx={BX+BW/2} cy={fillY+1} rx={(BW-14)/2} ry={4} fill={s.crema} opacity={0.85}
                        style={{ transition: isDragging ? 'none' : 'cy 0.15s ease' }} />
                    </g>
                  )}
                  <rect x={BX-3} y={BY-6} width={BW+6} height={12} rx={6} fill="#e8d8bc" stroke="#c8b090" strokeWidth="1" />
                  <rect x={BX} y={BY-4} width={BW} height={7} rx={4} fill="#dcc8a8" />
                  <rect x={BX+8} y={BY+6} width={12} height={BH-16} rx={6} fill="rgba(255,255,255,0.25)" />
                  <rect x={BX+6} y={BY+BH-5} width={BW-12} height={9} rx={4} fill="#c8b090" />
                  {showSteam && [BX+28, BX+55, BX+82].map((x, i) => (
                    <path key={i} d={`M ${x} ${BY-8} Q ${x-7} ${BY-22} ${x+5} ${BY-36}`}
                      stroke="rgba(160,120,80,0.45)" strokeWidth="2.5" fill="none" strokeLinecap="round"
                      style={{ animation: `steamRise ${1.6 + i * 0.2}s ease-in-out infinite`, animationDelay: `${i * 0.35}s` }} />
                  ))}
                  <text x={BX+BW/2} y={BY+BH/2+5} textAnchor="middle" fill="#a08060" opacity="0.1"
                    fontSize="24" fontWeight="bold" fontFamily="Georgia, serif">SB</text>
                </svg>
              </div>
              <div className="text-center -mt-2" style={{ minHeight: 52 }}>
                <p className="font-display text-2xl font-bold text-coffee-700">{s.label}</p>
                {fill > 0 && <p className="text-coffee-400 text-sm mt-1">{fill}% · {s.sub}</p>}
              </div>
              <div className="w-full mt-2 h-1.5 bg-cream-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-150"
                  style={{ width: `${fill}%`, background: `linear-gradient(90deg, ${s.crema}, ${s.liquid})` }} />
              </div>
            </div>
            <button onClick={() => fill > 0 && setStep('details')} disabled={fill === 0}
              className="w-full mt-5 py-3.5 rounded-2xl font-semibold text-white transition-all duration-300 disabled:opacity-40"
              style={{ background: fill > 0 ? `linear-gradient(135deg, ${s.liquid}, ${s.crema})` : '#d4c4b0', boxShadow: fill > 0 ? `0 8px 28px ${s.glow}` : 'none' }}>
              {fill === 0 ? 'Slide the mug to rate' : 'Continue →'}
            </button>
          </div>
        )}

        {step === 'details' && (
          <div className="px-5 pb-6 overflow-y-auto" style={{ maxHeight: '72vh' }}>
            <div className="flex items-center gap-3 mb-5 bg-cream-200 rounded-xl p-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                style={{ background: s.crema }}><span>☕</span></div>
              <div>
                <p className="text-coffee-700 font-semibold text-sm">{s.label} · {fill}%</p>
                <p className="text-coffee-400 text-xs">{shop?.name}</p>
              </div>
              <button onClick={() => setStep('rate')} className="ml-auto text-caramel text-xs font-medium">Edit</button>
            </div>

            {/* Photos — up to 4 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-coffee-500 text-xs uppercase tracking-wider">Photos (optional · up to 4)</label>
                {photoPreviews.length > 0 && photoPreviews.length < 4 && (
                  <button onClick={() => fileRef.current?.click()} className="text-caramel text-xs font-semibold">+ Add more</button>
                )}
              </div>
              {photoPreviews.length > 0 ? (
                <div className={`grid gap-2 ${photoPreviews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                  {photoPreviews.map((preview, idx) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden" style={{ height: photoPreviews.length === 1 ? 160 : 100 }}>
                      <img src={preview} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removePhoto(idx)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                        <X size={11} className="text-white" />
                      </button>
                    </div>
                  ))}
                  {photoPreviews.length < 4 && (
                    <button onClick={() => fileRef.current?.click()}
                      className="rounded-xl border-2 border-dashed border-cream-300 flex flex-col items-center justify-center gap-1 bg-cream-50"
                      style={{ height: 100 }}>
                      <Camera size={16} className="text-coffee-300" />
                      <span className="text-coffee-400 text-xs">Add photo</span>
                    </button>
                  )}
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()}
                  className="w-full h-24 rounded-xl border-2 border-dashed border-cream-300 flex items-center justify-center gap-3 bg-cream-50 hover:bg-cream-100 transition-colors">
                  <Camera size={18} className="text-coffee-300" />
                  <span className="text-coffee-400 text-sm">Add up to 4 photos</span>
                  <ImageIcon size={16} className="text-coffee-300" />
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
            </div>

            {/* Drink name */}
            <div className="mb-4">
              <label className="text-coffee-500 text-xs uppercase tracking-wider mb-2 block">What did you order?</label>
              <input value={drinkName} onChange={e => setDrinkName(e.target.value)}
                placeholder="Vanilla latte, cold brew..."
                className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300" />
            </div>

            {/* Visit time */}
            <div className="mb-4">
              <label className="text-coffee-500 text-xs uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                <Clock size={11} className="inline" /> When did you go?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TIME_OPTIONS.map(time => (
                  <button key={time} onClick={() => setVisitTime(visitTime === time ? '' : time)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border text-left ${visitTime === time ? 'text-white border-transparent' : 'bg-cream-50 text-coffee-500 border-cream-200'}`}
                    style={visitTime === time ? { background: s.liquid } : {}}>
                    {time}
                  </button>
                ))}
              </div>
            </div>

            {/* Visit date */}
            <div className="mb-4">
              <label className="text-coffee-500 text-xs uppercase tracking-wider mb-2 block">When did you visit?</label>
              <div className="flex gap-2 mb-2">
                {[
                  { label: 'Today', val: new Date().toISOString().split('T')[0] },
                  { label: 'Yesterday', val: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
                ].map(opt => (
                  <button key={opt.label} onClick={() => setVisitedAt(opt.val)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${visitedAt === opt.val ? 'text-white border-transparent' : 'bg-cream-50 text-coffee-500 border-cream-200'}`}
                    style={visitedAt === opt.val ? { background: s.liquid } : {}}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={visitedAt}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => setVisitedAt(e.target.value)}
                className="w-full bg-cream-50 text-coffee-700 rounded-xl px-4 py-2.5 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
              />
            </div>

            {/* Vibes */}
            <div className="mb-4">
              <label className="text-coffee-500 text-xs uppercase tracking-wider mb-2 block">How was the vibe? (up to 3)</label>
              <div className="flex flex-wrap gap-2">
                {VIBE_OPTIONS.map(vibe => (
                  <button key={vibe} onClick={() => toggleVibe(vibe)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${selectedVibes.includes(vibe) ? 'text-white border-transparent' : 'bg-cream-50 text-coffee-500 border-cream-200'}`}
                    style={selectedVibes.includes(vibe) ? { background: s.liquid } : {}}>
                    {vibe}
                  </button>
                ))}
              </div>
            </div>

            {/* Add to story toggle */}
            <div className="mb-4 flex items-center justify-between bg-cream-50 rounded-xl px-4 py-3 border border-cream-200">
              <div>
                <p className="text-coffee-700 text-sm font-semibold">Also add to my story</p>
                <p className="text-coffee-400 text-xs">Disappears in 24 hours</p>
              </div>
              <button onClick={() => setAddToStory(a => !a)}
                className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${addToStory ? 'bg-caramel' : 'bg-cream-300'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${addToStory ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Caption */}
            <div className="mb-6">
              <label className="text-coffee-500 text-xs uppercase tracking-wider mb-2 block">Caption (optional)</label>
              <textarea value={caption} onChange={e => setCaption(e.target.value)}
                placeholder="Tell your friends about it..."
                rows={2}
                className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300 resize-none" />
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
            <p className="text-coffee-500 text-sm">Brewing your post...</p>
          </div>
        )}
      </div>
    </div>
  )
}
