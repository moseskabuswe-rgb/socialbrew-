/**
 * ShareCard.tsx — Redesigned Instagram Stories share card
 *
 * Renders an offscreen div that mirrors the feed card exactly,
 * then uses dom-to-image-more to convert to PNG.
 *
 * Share paths (in priority order):
 * 1. Web Share API with file (iOS 15+ / Android Chrome) → native share sheet
 * 2. Instagram Stories URL scheme (ios-app://instagram) → direct to Stories
 * 3. Download PNG + manual instructions
 *
 * UTM tags: ?utm_source=instagram_stories&utm_medium=share&utm_campaign=user_share
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
  visited_at?: string | null
  coffee_shops?: { name: string; city?: string | null; state?: string | null }
  profiles?: { username: string; avatar_url?: string | null; badge?: string | null }
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

function getMugColors(fill: number) {
  if (fill >= 90) return { liquid: '#3d1a06', crema: '#c8853a', glow: 'rgba(220,160,60,0.7)' }
  if (fill >= 80) return { liquid: '#6b3410', crema: '#9b5520', glow: 'rgba(200,130,50,0.5)' }
  if (fill >= 70) return { liquid: '#b87333', crema: '#d4894a', glow: 'rgba(184,115,51,0.35)' }
  if (fill >= 60) return { liquid: '#c49a6c', crema: '#d9b48c', glow: 'rgba(196,154,108,0.3)' }
  return { liquid: '#d4b896', crema: '#e8d4bc', glow: 'rgba(212,184,150,0.2)' }
}

// Inline SVG mug — mirrors the app's actual mug SVG exactly
function MugSVG({ fill, size = 80 }: { fill: number; size?: number }) {
  const { liquid, crema } = getMugColors(fill)
  const VW = size, VH = size * 1.15
  const BX = VW * 0.08, BY = VH * 0.1
  const BW = VW * 0.72, BH = VH * 0.78
  const BR = VW * 0.12
  const fillPct = fill / 100
  const liquidH = BH * fillPct
  const liquidY = BY + BH - liquidH
  const showSteam = fill >= 65

  return (
    <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}>
      <defs>
        <clipPath id="sc-clip">
          <rect x={BX + 3} y={BY + 3} width={BW - 6} height={BH - 6} rx={BR - 2} />
        </clipPath>
      </defs>
      {/* Mug body */}
      <rect x={BX} y={BY} width={BW} height={BH} rx={BR} fill="#f5ead8" stroke="#d4b896" strokeWidth="2" />
      {/* Liquid fill */}
      <rect x={BX} y={liquidY} width={BW} height={liquidH + 4} fill={liquid} clipPath="url(#sc-clip)" />
      {/* Crema */}
      {fill > 0 && <rect x={BX} y={liquidY} width={BW} height={Math.max(3, liquidH * 0.08)} fill={crema} clipPath="url(#sc-clip)" opacity="0.7" />}
      {/* Handle */}
      <path d={`M${BX + BW},${BY + BH * 0.22} Q${BX + BW + VW * 0.22},${BY + BH * 0.22} ${BX + BW + VW * 0.22},${BY + BH * 0.5} Q${BX + BW + VW * 0.22},${BY + BH * 0.78} ${BX + BW},${BY + BH * 0.78}`}
        fill="none" stroke="#d4b896" strokeWidth="3.5" strokeLinecap="round" />
      {/* Steam */}
      {showSteam && [0.2, 0.45, 0.7].map((x, i) => (
        <path key={i}
          d={`M${BX + BW * x},${BY - VH * 0.04} Q${BX + BW * x + 5},${BY - VH * 0.1} ${BX + BW * x},${BY - VH * 0.17}`}
          fill="none" stroke={liquid} strokeWidth="1.8" strokeLinecap="round" />
      ))}
    </svg>
  )
}

const APP_URL = 'https://socialbrew-ani.pages.dev'
const UTM = '?utm_source=instagram_stories&utm_medium=share&utm_campaign=user_share'

export default function ShareCard({ rating, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(true)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)
  const [sharing, setSharing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const shop = rating.coffee_shops
  const profile = rating.profiles
  const fill = rating.fill_level || 0
  const label = getFillLabel(fill)
  const { liquid } = getMugColors(fill)
  const photos = (rating.photo_urls?.length ? rating.photo_urls : rating.photo_url ? [rating.photo_url] : []).filter(Boolean)
  const shareUrl = `${APP_URL}${UTM}`

  useEffect(() => {
    // Small delay to ensure the offscreen card is painted before capture
    const timer = setTimeout(async () => {
      if (!cardRef.current) { setGenerating(false); return }
      try {
        // @ts-ignore — dom-to-image-more loaded dynamically to avoid SSR issues
        const domtoimage = await import('dom-to-image-more')
        const blob = await domtoimage.default.toBlob(cardRef.current, {
          width: 1080,
          height: 1920,
          style: { transform: 'scale(1)', transformOrigin: 'top left' },
          quality: 0.95,
        })
        setImageBlob(blob)
        setImageUrl(URL.createObjectURL(blob))
      } catch (err) {
        console.error('Card generation failed:', err)
        setStatus('Could not generate card — try again')
      }
      setGenerating(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  async function share() {
    if (!imageBlob) return
    setSharing(true)
    setStatus(null)

    const file = new File([imageBlob], 'social-brew.png', { type: 'image/png' })

    // Path 1: Web Share API with file (iOS 15+, Android Chrome)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${shop?.name} on Social Brew` })
        setSharing(false)
        return
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          // Fall through to next method
        } else {
          setSharing(false)
          return
        }
      }
    }

    // Path 2: Instagram Stories URL scheme (iOS only)
    const ua = navigator.userAgent.toLowerCase()
    if (/iphone|ipad/.test(ua)) {
      window.location.href = 'instagram-stories://share'
      // Download as fallback after 1.5s if Instagram didn't open
      setTimeout(() => {
        download()
        setStatus('Save the image then open Instagram → Stories → add from camera roll')
        setSharing(false)
      }, 1500)
      return
    }

    // Path 3: Download + instructions (Android or desktop)
    download()
    setStatus('Image saved — open Instagram, tap + → Story → select from gallery')
    setSharing(false)
  }

  function download() {
    if (!imageUrl) return
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = `social-brew-${(shop?.name || 'post').replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-end"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl pb-safe"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="font-bold text-coffee-800 text-base">Share to Instagram Stories</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center">
            <X size={15} className="text-coffee-500" />
          </button>
        </div>

        {/* Preview */}
        <div className="mx-5 mb-4 rounded-2xl overflow-hidden border border-cream-200 bg-cream-50"
          style={{ height: 240 }}>
          {generating ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
              <p className="text-coffee-400 text-xs">Generating card...</p>
            </div>
          ) : imageUrl ? (
            <img src={imageUrl} alt="Share preview"
              className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-coffee-300 text-xs">Preview unavailable</p>
            </div>
          )}
        </div>

        {status && (
          <p className="mx-5 mb-3 text-coffee-500 text-xs text-center leading-relaxed bg-cream-50 rounded-xl px-3 py-2">
            {status}
          </p>
        )}

        {/* Share button */}
        <div className="px-5 pb-3 flex flex-col gap-2">
          <button
            onClick={share}
            disabled={generating || sharing || !imageBlob}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%)' }}>
            <Share2 size={17} />
            {sharing ? 'Opening...' : 'Share to Instagram Stories'}
          </button>
          <button onClick={download} disabled={generating || !imageBlob}
            className="w-full py-3 rounded-2xl bg-cream-100 text-coffee-700 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40">
            <Download size={15} />
            Save image instead
          </button>
        </div>

        <p className="px-5 pb-5 text-coffee-300 text-xs text-center">
          Includes a link so your followers can join Social Brew ☕
        </p>
      </div>

      {/* ── Offscreen card — rendered at Stories dimensions, captured by dom-to-image ── */}
      <div
        ref={cardRef}
        style={{
          position: 'fixed',
          top: 0,
          left: '-9999px',
          width: 1080,
          height: 1920,
          background: 'linear-gradient(160deg, #fdfaf5 0%, #f5ead8 55%, #efe0c4 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          fontFamily: 'Georgia, serif',
          overflow: 'hidden',
        }}>

        {/* Top brand */}
        <div style={{ paddingTop: 90, paddingBottom: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 52, fontWeight: 'bold', color: '#1c0a02', letterSpacing: 2, margin: 0 }}>Social Brew</p>
          <p style={{ fontSize: 26, color: '#b8956a', letterSpacing: 6, margin: '8px 0 0', fontFamily: 'sans-serif', textTransform: 'uppercase' }}>Independent Coffee</p>
        </div>

        {/* Thin divider */}
        <div style={{ width: 900, height: 1, background: '#e8d4b0', marginBottom: 40 }} />

        {/* User avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 40 }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt=""
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #e8d4b0' }} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: `linear-gradient(135deg, ${liquid}, #9b5e1a)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontWeight: 'bold', fontSize: 32 }}>{profile?.username?.[0]?.toUpperCase()}</span>
            </div>
          )}
          <div>
            <p style={{ fontSize: 40, fontWeight: 'bold', color: '#1c0a02', margin: 0 }}>@{profile?.username}</p>
            {profile?.badge && (
              <p style={{ fontSize: 26, color: '#b8956a', margin: '4px 0 0', fontFamily: 'sans-serif' }}>{profile.badge}</p>
            )}
          </div>
        </div>

        {/* White card */}
        <div style={{
          width: 940,
          background: 'rgba(255,255,255,0.92)',
          borderRadius: 40,
          padding: '60px 60px 50px',
          boxShadow: '0 20px 60px rgba(28,10,2,0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          {/* Mug */}
          <MugSVG fill={fill} size={200} />

          {/* Fill % */}
          <p style={{ fontSize: 96, fontWeight: 'bold', color: liquid, margin: '12px 0 0', lineHeight: 1 }}>
            {fill}%
          </p>

          {/* Label */}
          <p style={{ fontSize: 52, fontWeight: 'bold', color: '#1c0a02', margin: '8px 0 24px' }}>
            {label}
          </p>

          {/* Divider */}
          <div style={{ width: '100%', height: 1, background: '#e8d4b0', marginBottom: 28 }} />

          {/* Drink name */}
          {rating.drink_name && (
            <p style={{ fontSize: 36, color: '#c8853a', fontFamily: 'sans-serif', margin: '0 0 16px', textAlign: 'center' }}>
              {rating.drink_name}
            </p>
          )}

          {/* Shop */}
          <p style={{ fontSize: 48, fontWeight: 'bold', color: '#1c0a02', margin: 0, textAlign: 'center' }}>
            {shop?.name}
          </p>
          {shop?.city && (
            <p style={{ fontSize: 32, color: '#9b7a55', margin: '8px 0 0', fontFamily: 'sans-serif' }}>
              {shop.city}{shop.state ? `, ${shop.state}` : ''}
            </p>
          )}

          {/* Photo (first one) */}
          {photos[0] && (
            <div style={{ marginTop: 32, width: '100%', height: 340, borderRadius: 24, overflow: 'hidden' }}>
              <img src={photos[0]} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                crossOrigin="anonymous" />
            </div>
          )}

          {/* Caption */}
          {rating.caption && (
            <p style={{
              fontSize: 30, color: '#5a3e28', fontStyle: 'italic',
              margin: '28px 0 0', textAlign: 'center', lineHeight: 1.5,
              maxWidth: 760,
            }}>
              "{rating.caption}"
            </p>
          )}

          {/* Vibe tags */}
          {rating.vibe_tags && rating.vibe_tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 24, justifyContent: 'center' }}>
              {rating.vibe_tags.map((v, i) => (
                <span key={i} style={{
                  fontSize: 26, background: '#f5ead8', color: '#7a5c3a',
                  padding: '8px 20px', borderRadius: 40, fontFamily: 'sans-serif',
                  border: '1px solid #e8d4b0',
                }}>{v}</span>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 'auto', paddingBottom: 90, textAlign: 'center' }}>
          <p style={{ fontSize: 28, color: '#9b7a55', margin: '40px 0 8px', fontFamily: 'sans-serif' }}>
            Discover independent coffee shops
          </p>
          <p style={{ fontSize: 34, fontWeight: 'bold', color: '#c8853a', margin: 0, fontFamily: 'sans-serif' }}>
            Join Social Brew → socialbrew-ani.pages.dev
          </p>
          <p style={{ fontSize: 22, color: '#b8a090', margin: '8px 0 0', fontFamily: 'sans-serif' }}>
            {shareUrl}
          </p>
        </div>
      </div>
    </div>
  )
}
