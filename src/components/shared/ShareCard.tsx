/**
 * ShareCard.tsx — Canvas-based Instagram Stories share card
 *
 * Draws the post card directly onto an HTML Canvas using the 2D API.
 * No dom-to-image-more, no html2canvas, no CORS library issues.
 *
 * Images are fetched via a Supabase Edge Function proxy that adds
 * Access-Control-Allow-Origin: * so they can be drawn to canvas.
 *
 * Falls back gracefully if images can't load — card still generates
 * with placeholder colors instead of photos.
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
  is_quick_sip?: boolean
  coffee_shops?: { name: string; city?: string | null; state?: string | null }
  profiles?: { username: string; avatar_url?: string | null; badge?: string | null }
}

interface Props {
  rating: Rating
  onClose: () => void
}

const APP_URL = 'socialbrew-ani.pages.dev'
const SUPABASE_URL = 'https://euxyleckowsfuyzgximo.supabase.co'

function getFillLabel(fill: number) {
  if (fill === 100) return '✨ Perfect Brew'
  if (fill >= 90) return 'Loved It'
  if (fill >= 80) return 'Good Brew'
  if (fill >= 70) return 'Decent Pour'
  if (fill >= 60) return 'Just a Sip'
  return 'Not My Cup'
}

function getLiquidColor(fill: number) {
  if (fill >= 90) return '#3d1a06'
  if (fill >= 80) return '#6b3410'
  if (fill >= 70) return '#b87333'
  if (fill >= 60) return '#c49a6c'
  return '#d4b896'
}

// Fetch image via proxy → falls back to direct → returns null on failure
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  const attempts = [
    `${SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`,
    url,
  ]
  for (const src of attempts) {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject()
        img.src = src
        setTimeout(() => reject(), 5000)
      })
      if (img.naturalWidth > 0) return img
    } catch { /* try next */ }
  }
  return null
}

// Draw rounded rectangle helper
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// Word wrap text helper
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines
}

// Draw the mug SVG shape on canvas
function drawMug(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill: number) {
  const liquidColor = getLiquidColor(fill)
  const bx = x + size * 0.08
  const by = y + size * 0.1
  const bw = size * 0.72
  const bh = size * 0.88
  const br = size * 0.12

  // Body background
  roundRect(ctx, bx, by, bw, bh, br)
  ctx.fillStyle = '#f5ead8'
  ctx.fill()
  ctx.strokeStyle = '#d4b896'
  ctx.lineWidth = 2
  ctx.stroke()

  // Liquid fill
  if (fill > 0) {
    const fillH = bh * (fill / 100)
    const fillY = by + bh - fillH
    ctx.save()
    roundRect(ctx, bx + 2, by + 2, bw - 4, bh - 4, br - 1)
    ctx.clip()
    ctx.fillStyle = liquidColor
    ctx.fillRect(bx, fillY, bw, fillH + 4)
    // Crema highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(bx, fillY, bw, Math.max(3, fillH * 0.06))
    ctx.restore()
  }

  // Handle
  ctx.beginPath()
  ctx.arc(bx + bw + size * 0.12, by + bh * 0.5, size * 0.14, -Math.PI * 0.55, Math.PI * 0.55)
  ctx.strokeStyle = '#d4b896'
  ctx.lineWidth = size * 0.055
  ctx.stroke()

  // Steam lines (fill >= 65)
  if (fill >= 65) {
    ctx.strokeStyle = liquidColor
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    ;[0.2, 0.45, 0.7].forEach(xPct => {
      const sx = bx + bw * xPct
      ctx.beginPath()
      ctx.moveTo(sx, by - size * 0.04)
      ctx.bezierCurveTo(sx + 4, by - size * 0.1, sx - 4, by - size * 0.16, sx, by - size * 0.22)
      ctx.stroke()
    })
  }
}

export default function ShareCard({ rating, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [generating, setGenerating] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [sharing, setSharing] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const shop = rating.coffee_shops
  const user = rating.profiles
  const fill = rating.fill_level || 0
  const isQuickSip = rating.is_quick_sip === true
  const isVibePost = fill === 0 && !isQuickSip
  const photos = [...(rating.photo_urls || []), rating.photo_url].filter(Boolean) as string[]
  const liquidColor = getLiquidColor(fill)

  useEffect(() => {
    generateCard()
  }, [])

  async function generateCard() {
    setGenerating(true)
    setStatus(null)
    const canvas = canvasRef.current
    if (!canvas) { setGenerating(false); return }

    // Card width matches phone screen, height calculated dynamically
    const W = 390
    const PADDING = 20
    const CARD_MARGIN = 16
    const CARD_W = W - CARD_MARGIN * 2
    let Y = 0

    // Load images in parallel (non-blocking — card generates even if they fail)
    const [avatarImg, ...photoImgs] = await Promise.all([
      user?.avatar_url ? loadImage(user.avatar_url) : Promise.resolve(null),
      ...photos.slice(0, 4).map(u => loadImage(u)),
    ])

    // Calculate total height
    const HEADER_H = 72
    const CARD_TOP_PADDING = 14
    const AVATAR_ROW_H = 44
    const DRINK_ROW_H = rating.drink_name ? 36 : 0
    const MUG_ROW_H = (!isVibePost && fill > 0) ? 80 : 0
    const BADGE_ROW_H = (isQuickSip || isVibePost) ? 32 : 0
    const PHOTO_H = photos.length > 0 ? (photos.length === 1 ? 240 : 180) : 0
    const TAGS_H = (rating.vibe_tags?.length || 0) > 0 ? 40 : 0
    const captionLines = rating.caption
      ? (() => {
          const tmp = document.createElement('canvas').getContext('2d')!
          tmp.font = '14px system-ui'
          return wrapText(tmp, rating.caption, CARD_W - 32).length
        })()
      : 0
    const CAPTION_H = captionLines > 0 ? captionLines * 22 + 20 : 0
    const SHOP_H = shop ? 56 : 0
    const CARD_BOTTOM_PADDING = 14
    const FOOTER_H = 64

    const CARD_H = CARD_TOP_PADDING + AVATAR_ROW_H + DRINK_ROW_H + MUG_ROW_H +
      BADGE_ROW_H + PHOTO_H + TAGS_H + CAPTION_H + SHOP_H + CARD_BOTTOM_PADDING
    const TOTAL_H = HEADER_H + 16 + CARD_H + 16 + FOOTER_H

    canvas.width = W
    canvas.height = TOTAL_H
    const ctx = canvas.getContext('2d')!

    // ── Background ──────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, TOTAL_H)
    bg.addColorStop(0, '#fdfaf5')
    bg.addColorStop(1, '#f0e0c8')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, TOTAL_H)

    // ── Social Brew Header ───────────────────────────────────
    Y = 0
    const hdrGrad = ctx.createLinearGradient(0, 0, W, 0)
    hdrGrad.addColorStop(0, '#1c0a02')
    hdrGrad.addColorStop(1, '#3d1a06')
    ctx.fillStyle = hdrGrad
    ctx.fillRect(0, Y, W, HEADER_H)

    // Coffee cup icon circle
    ctx.beginPath()
    ctx.arc(PADDING + 20, Y + HEADER_H / 2, 20, 0, Math.PI * 2)
    ctx.fillStyle = '#c8853a'
    ctx.fill()
    ctx.font = 'bold 20px system-ui'
    ctx.textAlign = 'center'
    ctx.fillStyle = 'white'
    ctx.fillText('☕', PADDING + 20, Y + HEADER_H / 2 + 7)

    ctx.textAlign = 'left'
    ctx.font = 'bold 20px Georgia, serif'
    ctx.fillStyle = 'white'
    ctx.fillText('Social Brew', PADDING + 50, Y + HEADER_H / 2 - 2)
    ctx.font = '12px system-ui'
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText('Independent coffee only', PADDING + 50, Y + HEADER_H / 2 + 16)

    Y += HEADER_H + 16

    // ── White card ───────────────────────────────────────────
    roundRect(ctx, CARD_MARGIN, Y, CARD_W, CARD_H, 20)
    ctx.fillStyle = 'white'
    ctx.shadowColor = 'rgba(28,10,2,0.1)'
    ctx.shadowBlur = 16
    ctx.shadowOffsetY = 4
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    const CX = CARD_MARGIN // card left edge
    let CY = Y + CARD_TOP_PADDING // current Y inside card

    // Avatar + username row
    const AVATAR_SIZE = 34
    if (avatarImg) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(CX + PADDING + AVATAR_SIZE / 2, CY + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(avatarImg, CX + PADDING, CY, AVATAR_SIZE, AVATAR_SIZE)
      ctx.restore()
    } else {
      // Fallback circle with initial
      ctx.beginPath()
      ctx.arc(CX + PADDING + AVATAR_SIZE / 2, CY + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2)
      ctx.fillStyle = liquidColor
      ctx.fill()
      ctx.font = `bold ${AVATAR_SIZE * 0.45}px system-ui`
      ctx.textAlign = 'center'
      ctx.fillStyle = 'white'
      ctx.fillText(
        (user?.username?.[0] || '?').toUpperCase(),
        CX + PADDING + AVATAR_SIZE / 2,
        CY + AVATAR_SIZE / 2 + AVATAR_SIZE * 0.16
      )
      ctx.textAlign = 'left'
    }

    // Username
    const textX = CX + PADDING + AVATAR_SIZE + 10
    ctx.font = 'bold 14px system-ui'
    ctx.fillStyle = '#1c0a02'
    ctx.fillText(user?.username || '', textX, CY + 15)

    // Badge pill
    if (user?.badge) {
      const badgeX = textX + ctx.measureText(user.username || '').width + 8
      ctx.font = '11px system-ui'
      ctx.fillStyle = '#b8956a'
      ctx.fillText(user.badge, badgeX, CY + 15)
    }

    // Visit time
    if (rating.visit_time) {
      ctx.font = '11px system-ui'
      ctx.fillStyle = '#9b7a55'
      ctx.fillText(`🕐 ${rating.visit_time}`, textX, CY + 32)
    }

    CY += AVATAR_ROW_H

    // Drink name pill
    if (rating.drink_name) {
      ctx.font = '11px system-ui'
      ctx.fillStyle = '#9b7a55'
      ctx.fillText('ordered', CX + PADDING, CY + 16)
      const pillX = CX + PADDING + ctx.measureText('ordered').width + 8
      const pillW = ctx.measureText(rating.drink_name).width + 20
      roundRect(ctx, pillX, CY + 4, pillW, 22, 11)
      ctx.fillStyle = '#f5f5f5'
      ctx.fill()
      ctx.font = '12px system-ui'
      ctx.fillStyle = '#1c0a02'
      ctx.fillText(rating.drink_name, pillX + 10, CY + 19)
      CY += DRINK_ROW_H
    }

    // Mug + fill level
    if (!isVibePost && fill > 0) {
      const mugSize = 64
      drawMug(ctx, CX + PADDING, CY, mugSize, fill)
      ctx.font = 'bold 20px Georgia, serif'
      ctx.fillStyle = '#1c0a02'
      ctx.fillText(getFillLabel(fill), CX + PADDING + mugSize + 16, CY + 28)
      // Fill bar
      const barX = CX + PADDING + mugSize + 16
      const barW = 100
      roundRect(ctx, barX, CY + 36, barW, 7, 3.5)
      ctx.fillStyle = '#f0e4d0'
      ctx.fill()
      roundRect(ctx, barX, CY + 36, barW * (fill / 100), 7, 3.5)
      ctx.fillStyle = liquidColor
      ctx.fill()
      ctx.font = 'bold 13px system-ui'
      ctx.fillStyle = '#9b7a55'
      ctx.fillText(`${fill}%`, barX + barW + 8, CY + 44)
      CY += MUG_ROW_H
    }

    // Quick Sip / Vibe Check badge
    if (isQuickSip) {
      roundRect(ctx, CX + PADDING, CY + 6, 85, 22, 11)
      ctx.fillStyle = '#eff6ff'
      ctx.fill()
      ctx.font = '11px system-ui'
      ctx.fillStyle = '#3b82f6'
      ctx.fillText('⚡ Quick Sip', CX + PADDING + 8, CY + 21)
      CY += BADGE_ROW_H
    } else if (isVibePost) {
      roundRect(ctx, CX + PADDING, CY + 6, 95, 22, 11)
      ctx.fillStyle = '#f5e6d0'
      ctx.fill()
      ctx.font = '11px system-ui'
      ctx.fillStyle = '#c8853a'
      ctx.fillText('✨ Vibe Check', CX + PADDING + 8, CY + 21)
      CY += BADGE_ROW_H
    }

    // Photos
    if (photoImgs.length > 0 && PHOTO_H > 0) {
      const loaded = photoImgs.filter(Boolean) as HTMLImageElement[]
      if (loaded.length === 1) {
        const img = loaded[0]
        const ratio = Math.max(CARD_W / img.naturalWidth, PHOTO_H / img.naturalHeight)
        const dw = img.naturalWidth * ratio
        const dh = img.naturalHeight * ratio
        ctx.save()
        ctx.rect(CX, CY, CARD_W, PHOTO_H)
        ctx.clip()
        ctx.drawImage(img, CX + (CARD_W - dw) / 2, CY + (PHOTO_H - dh) / 2, dw, dh)
        ctx.restore()
      } else {
        const colW = CARD_W / 2
        loaded.slice(0, 4).forEach((img, i) => {
          const col = i % 2
          const row = Math.floor(i / 2)
          const ix = CX + col * colW
          const iy = CY + row * (PHOTO_H / 2)
          const ih = PHOTO_H / (loaded.length > 2 ? 2 : 1)
          const ratio = Math.max(colW / img.naturalWidth, ih / img.naturalHeight)
          const dw = img.naturalWidth * ratio
          const dh = img.naturalHeight * ratio
          ctx.save()
          ctx.rect(ix, iy, colW - 1, ih - 1)
          ctx.clip()
          ctx.drawImage(img, ix + (colW - dw) / 2, iy + (ih - dh) / 2, dw, dh)
          ctx.restore()
        })
      }
      CY += PHOTO_H
    }

    // Vibe tags
    if (rating.vibe_tags && rating.vibe_tags.length > 0) {
      let tx = CX + PADDING
      rating.vibe_tags.forEach(tag => {
        ctx.font = '11px system-ui'
        const tw = ctx.measureText(tag).width + 16
        roundRect(ctx, tx, CY + 8, tw, 22, 11)
        ctx.fillStyle = '#f5ead8'
        ctx.fill()
        ctx.strokeStyle = '#e8d4b0'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.fillStyle = '#7a5c3a'
        ctx.fillText(tag, tx + 8, CY + 23)
        tx += tw + 8
      })
      CY += TAGS_H
    }

    // Caption
    if (rating.caption && captionLines > 0) {
      ctx.font = '13px Georgia, serif'
      ctx.fillStyle = '#3d2010'
      const lines = wrapText(ctx, rating.caption, CARD_W - 32)
      lines.forEach((line, i) => {
        ctx.fillText(line, CX + PADDING, CY + 16 + i * 22)
      })
      CY += CAPTION_H
    }

    // Shop card
    if (shop) {
      roundRect(ctx, CX + PADDING, CY + 6, CARD_W - PADDING * 2, 44, 12)
      ctx.fillStyle = '#fdfaf5'
      ctx.fill()
      ctx.strokeStyle = '#e8d4b0'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.font = 'bold 14px system-ui'
      ctx.fillStyle = '#1c0a02'
      ctx.fillText(shop.name, CX + PADDING + 12, CY + 24)
      if (shop.city) {
        ctx.font = '11px system-ui'
        ctx.fillStyle = '#9b7a55'
        ctx.fillText(shop.city + (shop.state ? `, ${shop.state}` : ''), CX + PADDING + 12, CY + 40)
      }
      ctx.font = 'bold 12px system-ui'
      ctx.fillStyle = '#c8853a'
      ctx.textAlign = 'right'
      ctx.fillText('View →', CX + CARD_W - PADDING, CY + 32)
      ctx.textAlign = 'left'
    }

    // ── Footer ───────────────────────────────────────────────
    Y = Y + CARD_H + 16
    ctx.font = '12px system-ui'
    ctx.fillStyle = '#9b7a55'
    ctx.textAlign = 'center'
    ctx.fillText('Discover independent coffee shops', W / 2, Y + 20)
    ctx.font = 'bold 14px system-ui'
    ctx.fillStyle = '#c8853a'
    ctx.fillText(`Join Social Brew → ${APP_URL}`, W / 2, Y + 42)
    ctx.textAlign = 'left'

    // Export to blob
    canvas.toBlob(b => {
      if (b) {
        setBlob(b)
        setPreviewUrl(prev => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(b)
        })
      } else {
        setStatus('Could not generate card — try again')
      }
      setGenerating(false)
    }, 'image/png', 0.95)
  }

  async function share() {
    if (!blob) return
    setSharing(true)
    setStatus(null)
    const file = new File([blob], 'social-brew.png', { type: 'image/png' })

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `${shop?.name} on Social Brew` })
        setSharing(false); return
      } catch (e: any) {
        if (e.name === 'AbortError') { setSharing(false); return }
      }
    }

    if (/iphone|ipad/i.test(navigator.userAgent)) {
      download()
      window.location.href = 'instagram-stories://share'
      setTimeout(() => {
        setStatus('Image saved — open Instagram → tap + → Story → select from Photos')
        setSharing(false)
      }, 1500)
      return
    }

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
      style={{ background: 'rgba(0,0,0,0.92)' }} onClick={onClose}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl pb-8"
        onClick={e => e.stopPropagation()}>

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
              <p className="text-coffee-400 text-xs">Building your card...</p>
            </div>
          ) : previewUrl ? (
            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-coffee-300 text-xs text-center px-4">{status || 'Preview unavailable'}</p>
            </div>
          )}
        </div>

        {status && previewUrl && (
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
          Your followers can visit the link to join Social Brew ☕
        </p>

        {/* Hidden canvas — drawing happens here */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  )
}
