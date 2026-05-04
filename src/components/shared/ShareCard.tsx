/**
 * ShareCard.tsx — Instagram Stories share card
 *
 * Renders the EXACT feed card in a hidden div (same JSX as HomeTab),
 * captures it with dom-to-image-more, wraps it with a Social Brew
 * header and footer, and shares as a PNG.
 *
 * The result looks like a screenshot of the actual app post.
 *
 * Share paths:
 * 1. Web Share API with file (iOS 15+ / Android Chrome)
 * 2. Instagram Stories URL scheme (iOS)
 * 3. Download PNG + instructions (fallback)
 */

import { useEffect, useRef, useState } from 'react'
import { X, Download, Share2 } from 'lucide-react'

interface Rating {
  id: string
  fill_level: number
  caption?: string | null
  drink_name?: string | null
  vibe_tags?: string[]
  photo_url?: string | null
  photo_urls?: string[]
  visit_time?: string | null
  visited_at?: string | null
  is_quick_sip?: boolean
  coffee_shops?: {
    name: string
    city?: string | null
    state?: string | null
    photo_url?: string | null
  }
  profiles?: {
    username: string
    avatar_url?: string | null
    badge?: string | null
  }
}

interface Props {
  rating: Rating
  onClose: () => void
}

function getFillLabel(fill: number): string {
  if (fill === 100) return '✨ Perfect Brew'
  if (fill >= 90) return 'Loved It'
  if (fill >= 80) return 'Good Brew'
  if (fill >= 70) return 'Decent Pour'
  if (fill >= 60) return 'Just a Sip'
  return 'Not My Cup'
}

function getMugStyle(fill: number) {
  if (fill === 0)   return { liquid: 'transparent', crema: 'transparent' }
  if (fill <= 59)   return { liquid: '#d4b896', crema: '#e8d4bc' }
  if (fill <= 69)   return { liquid: '#c49a6c', crema: '#d9b48c' }
  if (fill <= 79)   return { liquid: '#b87333', crema: '#d4894a' }
  if (fill <= 89)   return { liquid: '#9b5e1a', crema: '#c07830' }
  if (fill <= 99)   return { liquid: '#6b3410', crema: '#9b5520' }
  return              { liquid: '#3d1a06', crema: '#c8853a' }
}

// Inline mug SVG — matches the app exactly
function MugInline({ fill, size = 56 }: { fill: number; size?: number }) {
  const s = getMugStyle(fill)
  const VW = size, VH = size * 1.15
  const BX = VW * 0.08, BY = VH * 0.1
  const BW = VW * 0.72, BH = VH * 0.78
  const BR = VW * 0.12
  const fillH = (fill / 100) * BH
  const fillY = BY + BH - fillH
  const showSteam = fill >= 65

  return (
    <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`} style={{ display: 'block' }}>
      <rect x={BX} y={BY} width={BW} height={BH} rx={BR} fill="#f5ead8" stroke="#d4b896" strokeWidth="1.5" />
      {fill > 0 && (
        <clipPath id={`mc-${fill}`}>
          <rect x={BX + 2} y={BY + 2} width={BW - 4} height={BH - 4} rx={BR - 1} />
        </clipPath>
      )}
      {fill > 0 && <rect x={BX} y={fillY} width={BW} height={fillH + 4} fill={s.liquid} clipPath={`url(#mc-${fill})`} />}
      {fill > 0 && <rect x={BX} y={fillY} width={BW} height={Math.max(2, fillH * 0.06)} fill={s.crema} clipPath={`url(#mc-${fill})`} opacity="0.7" />}
      <path d={`M${BX + BW},${BY + BH * 0.22} Q${BX + BW + VW * 0.2},${BY + BH * 0.22} ${BX + BW + VW * 0.2},${BY + BH * 0.5} Q${BX + BW + VW * 0.2},${BY + BH * 0.78} ${BX + BW},${BY + BH * 0.78}`}
        fill="none" stroke="#d4b896" strokeWidth="2.5" strokeLinecap="round" />
      {showSteam && [0.2, 0.45, 0.7].map((x, i) => (
        <path key={i}
          d={`M${BX + BW * x},${BY - VH * 0.04} Q${BX + BW * x + 4},${BY - VH * 0.09} ${BX + BW * x},${BY - VH * 0.16}`}
          fill="none" stroke={s.liquid} strokeWidth="1.3" strokeLinecap="round" />
      ))}
    </svg>
  )
}

const APP_URL = 'https://socialbrew-ani.pages.dev'

export default function ShareCard({ rating, onClose }: Props) {
  const captureRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [sharing, setSharing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)


  const shop = rating.coffee_shops
  const user = rating.profiles
  const fill = rating.fill_level || 0
  const fillLabel = getFillLabel(fill)
  const mugStyle = getMugStyle(fill)
  const isQuickSip = rating.is_quick_sip === true
  const isVibePost = fill === 0 && !isQuickSip
  const photos = (rating.photo_urls?.length ? rating.photo_urls : rating.photo_url ? [rating.photo_url] : []).filter(Boolean) as string[]

  // Kick off capture after a short delay — html2canvas handles CORS natively
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!captureRef.current) { setGenerating(false); return }
      try {
        const html2canvas = (await import('html2canvas')).default
        const node = captureRef.current

        // Append to DOM so layout computes correctly
        const wasDetached = !document.body.contains(node)
        if (wasDetached) {
          node.style.position = 'fixed'
          node.style.left = '-9999px'
          node.style.top = '0px'
          document.body.appendChild(node)
        }

        // Wait for all img elements to load (critical for base64 images)
        const imgs = Array.from(node.querySelectorAll('img'))
        await Promise.all(imgs.map(img =>
          img.complete ? Promise.resolve() : new Promise<void>(r => {
            img.onload = () => r()
            img.onerror = () => r()
            setTimeout(r, 3000)
          })
        ))

        // Extra paint frame
        await new Promise(r => setTimeout(r, 200))

        // Hard timeout — if html2canvas hangs, bail after 10s
        const canvas = await Promise.race([
          html2canvas(node, {
          scale: 3,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#fdfaf5',
          logging: false,
          imageTimeout: 8000,
          onclone: (_doc: Document, el: HTMLElement) => {
            el.style.left = '0px'
            el.style.top = '0px'
          }
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('html2canvas timeout')), 10000))
        ]) as HTMLCanvasElement

        // Remove from DOM
        if (wasDetached && document.body.contains(node)) {
          document.body.removeChild(node)
        }

        const b = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            blob => blob ? resolve(blob) : reject(new Error('toBlob failed')),
            'image/png', 0.95
          )
        )
        setBlob(b)
        setPreviewUrl(URL.createObjectURL(b))
      } catch (err) {
        console.error('Capture failed:', err)
        setStatus('Could not generate card — try again')
      }
      setGenerating(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [])

  async function share() {
    if (!blob) return
    setSharing(true)
    setStatus(null)
    const file = new File([blob], 'social-brew-post.png', { type: 'image/png' })

    // Path 1: Web Share API (iOS 15+, Android Chrome)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${shop?.name} on Social Brew` })
        setSharing(false)
        return
      } catch (e: any) {
        if (e.name === 'AbortError') { setSharing(false); return }
      }
    }

    // Path 2: Instagram Stories URL scheme (iOS)
    if (/iphone|ipad/i.test(navigator.userAgent)) {
      download()
      window.location.href = 'instagram-stories://share'
      setTimeout(() => {
        setStatus('Image saved — open Instagram → tap + → Story → select from Photos')
        setSharing(false)
      }, 1500)
      return
    }

    // Path 3: Download (Android / desktop)
    download()
    setStatus('Image saved — open Instagram, tap + → Story → select from gallery')
    setSharing(false)
  }

  function download() {
    if (!previewUrl) return
    const a = document.createElement('a')
    a.href = previewUrl
    a.download = `social-brew-${(shop?.name || 'post').replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-end"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl pb-8"
        onClick={e => e.stopPropagation()}>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="font-bold text-coffee-800 text-base">Share to Instagram Stories</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center">
            <X size={15} className="text-coffee-500" />
          </button>
        </div>

        {/* Preview */}
        <div className="mx-5 mb-4 rounded-2xl overflow-hidden border border-cream-200 bg-cream-50"
          style={{ height: 260 }}>
          {generating ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
              <p className="text-coffee-400 text-xs">Capturing your post...</p>
            </div>
          ) : previewUrl ? (
            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-coffee-300 text-xs">Preview unavailable</p>
            </div>
          )}
        </div>

        {status && (
          <p className="mx-5 mb-3 text-coffee-500 text-xs text-center leading-relaxed bg-cream-50 rounded-xl px-3 py-2">{status}</p>
        )}

        <div className="px-5 flex flex-col gap-2">
          <button onClick={share} disabled={generating || sharing || !blob}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}>
            <Share2 size={17} />
            {sharing ? 'Opening...' : 'Share to Instagram Stories'}
          </button>
          <button onClick={download} disabled={generating || !blob}
            className="w-full py-3 rounded-2xl bg-cream-100 text-coffee-700 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40">
            <Download size={15} />
            Save image instead
          </button>
        </div>

        <p className="px-5 pt-3 text-coffee-300 text-xs text-center">
          Your followers can tap the link to join Social Brew ☕
        </p>
      </div>

      {/* ── Offscreen capture div — exact post card + branded frame ── */}
      <div
        ref={captureRef}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: 390,           // iPhone 15 Pro width — standard Stories canvas
          background: '#fdfaf5',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>

        {/* Social Brew header */}
        <div style={{
          background: 'linear-gradient(135deg, #1c0a02, #3d1a06)',
          padding: '20px 20px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 40, height: 40,
            background: '#c8853a',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20,
          }}>☕</div>
          <div>
            <p style={{ color: 'white', fontWeight: 'bold', fontSize: 18, margin: 0 }}>Social Brew</p>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, margin: 0 }}>Independent coffee only</p>
          </div>
        </div>

        {/* THE ACTUAL POST CARD — mirrors feed exactly */}
        <div style={{
          background: 'white',
          margin: '0 16px',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 2px 16px rgba(28,10,2,0.08)',
          border: '1px solid #e8d4b0',
        }}>
          {/* Card header: avatar + username + time + shop */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px' }}>
            {/* Avatar */}
            <div style={{
              width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
              background: `linear-gradient(135deg, ${mugStyle.liquid || '#c8853a'}, #9b5e1a)`,
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                  {user?.username?.[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '700', fontSize: 14, color: '#1c0a02' }}>{user?.username}</span>
                {user?.badge && (
                  <span style={{ fontSize: 11, color: '#9b7a55', background: '#f5ead8', padding: '2px 8px', borderRadius: 20, border: '1px solid #e8d4b0' }}>
                    {user.badge}
                  </span>
                )}
                {rating.visit_time && (
                  <span style={{ fontSize: 11, color: '#9b7a55', background: '#f5f5f5', padding: '2px 8px', borderRadius: 20 }}>
                    🕐 {rating.visit_time}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Drink name pill */}
          {rating.drink_name && (
            <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: '#9b7a55' }}>ordered</span>
              <span style={{
                fontSize: 13, color: '#1c0a02', background: '#f5f5f5',
                padding: '4px 12px', borderRadius: 20, fontWeight: '500',
              }}>{rating.drink_name}</span>
            </div>
          )}

          {/* Mug + fill level (not for vibe posts) */}
          {!isVibePost && fill > 0 && (
            <div style={{ padding: '6px 16px 10px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <MugInline fill={fill} size={56} />
              <div>
                <p style={{ fontWeight: '700', fontSize: 18, color: '#1c0a02', margin: 0 }}>{fillLabel}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <div style={{ width: 100, height: 6, background: '#f0e4d0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${fill}%`, height: '100%', background: mugStyle.liquid, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#9b7a55', fontWeight: '600' }}>{fill}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Quick sip badge */}
          {isQuickSip && (
            <div style={{ padding: '0 16px 8px' }}>
              <span style={{ fontSize: 11, background: '#eff6ff', color: '#3b82f6', padding: '3px 10px', borderRadius: 20, fontWeight: '600' }}>⚡ Quick Sip</span>
            </div>
          )}

          {/* Vibe check badge */}
          {isVibePost && (
            <div style={{ padding: '0 16px 8px' }}>
              <span style={{ fontSize: 11, background: '#f5e6d0', color: '#c8853a', padding: '3px 10px', borderRadius: 20, fontWeight: '600' }}>✨ Vibe Check</span>
            </div>
          )}

          {/* Photos collage */}
          {photos.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: photos.length === 1 ? '1fr' : '1fr 1fr',
              gap: 2,
            }}>
              {photos.map((url, i) => (
                <img key={i} src={url} alt="" crossOrigin="anonymous"
                  style={{
                    width: '100%',
                    height: photos.length === 1 ? 280 : photos.length === 3 && i === 0 ? 200 : 140,
                    objectFit: 'cover',
                    gridColumn: photos.length === 3 && i === 0 ? '1 / -1' : 'auto',
                    display: 'block',
                  }} />
              ))}
            </div>
          )}

          {/* Vibe tags */}
          {rating.vibe_tags && rating.vibe_tags.length > 0 && (
            <div style={{ padding: '10px 16px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {rating.vibe_tags.map((v, i) => (
                <span key={i} style={{
                  fontSize: 12, color: '#7a5c3a', background: '#f5ead8',
                  padding: '4px 10px', borderRadius: 20, border: '1px solid #e8d4b0',
                }}>{v}</span>
              ))}
            </div>
          )}

          {/* Caption */}
          {rating.caption && (
            <div style={{ padding: '10px 16px' }}>
              <p style={{ fontSize: 13, color: '#3d2010', lineHeight: 1.5, margin: 0 }}>{rating.caption}</p>
            </div>
          )}

          {/* Shop card */}
          {shop && (
            <div style={{
              margin: '8px 16px 14px',
              background: '#fdfaf5',
              border: '1px solid #e8d4b0',
              borderRadius: 14,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <p style={{ fontWeight: '700', fontSize: 14, color: '#1c0a02', margin: 0 }}>{shop.name}</p>
                {shop.city && <p style={{ fontSize: 12, color: '#9b7a55', margin: '2px 0 0' }}>{shop.city}{shop.state ? `, ${shop.state}` : ''}</p>}
              </div>
              <span style={{ fontSize: 12, color: '#c8853a', fontWeight: '600' }}>View →</span>
            </div>
          )}
        </div>

        {/* Social Brew CTA footer */}
        <div style={{
          padding: '16px 20px 20px',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: 13, color: '#9b7a55', margin: '0 0 4px' }}>
            Discover independent coffee shops
          </p>
          <p style={{
            fontSize: 15, fontWeight: 'bold', color: '#c8853a', margin: 0,
            textDecoration: 'underline',
          }}>
            {APP_URL}
          </p>
        </div>
      </div>
    </div>
  )
}
