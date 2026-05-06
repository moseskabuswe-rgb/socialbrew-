/**
 * ShareCard.tsx — Canvas-based Instagram Stories share card
 * Renders at 2x resolution for crisp display on all phones.
 * Draws the post exactly as it appears in the feed.
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
  coffee_shops?: {
    name: string
    city?: string | null
    state?: string | null
    country?: string | null
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

const APP_URL = 'socialbrew-ani.pages.dev'
const SUPABASE_URL = 'https://euxyleckowsfuyzgximo.supabase.co'
const SCALE = 2 // retina quality

function getFillLabel(fill: number) {
  if (fill === 100) return '✨ Perfect Brew'
  if (fill >= 90) return 'Loved It'
  if (fill >= 80) return 'Good Brew'
  if (fill >= 70) return 'Decent Pour'
  if (fill >= 60) return 'Just a Sip'
  if (fill > 0) return 'Not My Cup'
  return ''
}

function getLiquidColor(fill: number) {
  if (fill === 100) return '#3d1a06'
  if (fill >= 90) return '#6b3410'
  if (fill >= 80) return '#9b5e1a'
  if (fill >= 70) return '#b87333'
  if (fill >= 60) return '#c49a6c'
  return '#d4b896'
}

function formatLocation(
  city?: string | null,
  state?: string | null,
  country?: string | null
): string {
  const c = city?.trim()
  const s = state?.trim()
  const co = country?.trim()
  if (!c) return s || co || ''
  if (s && (!co || co === 'United States')) return `${c}, ${s}`
  if (co && co !== 'United States') return `${c}, ${co}`
  return c
}

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

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  r: number
) {
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

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
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

function drawMug(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  size: number,
  fill: number
) {
  // Proportions mirrored from MugRating.tsx SVG
  // MugRating uses: VW=200, BX=30, BY=35, BW=110, BH=105, BR=12
  // Scale factor: size / 200
  const sc = size / 200
  const BX = x + 30 * sc
  const BY = y + 35 * sc
  const BW = 110 * sc
  const BH = 105 * sc
  const BR = 12 * sc
  const liquidColor = getLiquidColor(fill)

  // Saucer ellipse (under the mug)
  ctx.beginPath()
  ctx.ellipse(BX + BW / 2, BY + BH + 18 * sc, BW / 2 + 16 * sc, 9 * sc, 0, 0, Math.PI * 2)
  ctx.fillStyle = '#e8d8bc'
  ctx.fill()
  ctx.strokeStyle = '#c8b090'
  ctx.lineWidth = 1 * sc
  ctx.stroke()

  // Handle (bezier curves matching MugRating exactly)
  ctx.beginPath()
  ctx.moveTo(BX + BW - 2 * sc, BY + 20 * sc)
  ctx.bezierCurveTo(
    BX + BW + 36 * sc, BY + 16 * sc,
    BX + BW + 36 * sc, BY + BH - 16 * sc,
    BX + BW - 2 * sc, BY + BH - 20 * sc
  )
  ctx.strokeStyle = '#c8b090'
  ctx.lineWidth = 8 * sc
  ctx.stroke()
  // Inner handle line
  ctx.beginPath()
  ctx.moveTo(BX + BW - 2 * sc, BY + 20 * sc)
  ctx.bezierCurveTo(
    BX + BW + 24 * sc, BY + 17 * sc,
    BX + BW + 24 * sc, BY + BH - 17 * sc,
    BX + BW - 2 * sc, BY + BH - 20 * sc
  )
  ctx.strokeStyle = '#dcc8a8'
  ctx.lineWidth = 4 * sc
  ctx.stroke()

  // Mug body — ceramic gradient
  const ceramicGrad = ctx.createLinearGradient(BX, BY, BX + BW, BY)
  ceramicGrad.addColorStop(0, '#f8f0e0')
  ceramicGrad.addColorStop(0.4, '#fdfaf5')
  ceramicGrad.addColorStop(1, '#e8d8bc')
  roundRect(ctx, BX, BY, BW, BH, BR)
  ctx.fillStyle = ceramicGrad
  ctx.fill()
  ctx.strokeStyle = '#c8b090'
  ctx.lineWidth = 1.5 * sc
  ctx.stroke()

  // Liquid fill
  if (fill > 0) {
    const IH = BH - 8 * sc
    const fillH = IH * (fill / 100)
    const fillY = BY + BH - fillH

    ctx.save()
    ctx.beginPath()
    ctx.rect(BX + 4 * sc, BY + 4 * sc, BW - 8 * sc, BH - 8 * sc)
    ctx.clip()

    ctx.fillStyle = liquidColor
    ctx.fillRect(BX + 4 * sc, fillY, BW - 8 * sc, fillH)

    // Crema ellipse on top of liquid
    ctx.beginPath()
    const cremaCX = BX + BW / 2
    const cremaRX = (BW - 14 * sc) / 2
    ctx.ellipse(cremaCX, fillY + 1, cremaRX, 4 * sc, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(210,170,100,0.85)'
    ctx.fill()

    ctx.restore()
  }

  // Rim (top band)
  roundRect(ctx, BX - 3 * sc, BY - 6 * sc, BW + 6 * sc, 12 * sc, 6 * sc)
  ctx.fillStyle = '#e8d8bc'
  ctx.fill()
  ctx.strokeStyle = '#c8b090'
  ctx.lineWidth = 1 * sc
  ctx.stroke()
  // Rim inner
  roundRect(ctx, BX, BY - 4 * sc, BW, 7 * sc, 4 * sc)
  ctx.fillStyle = '#dcc8a8'
  ctx.fill()

  // Highlight stripe
  roundRect(ctx, BX + 8 * sc, BY + 6 * sc, 12 * sc, BH - 16 * sc, 6 * sc)
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fill()

  // Steam (fill >= 65)
  if (fill >= 65) {
    ctx.strokeStyle = liquidColor
    ctx.lineWidth = 2 * sc
    ctx.lineCap = 'round'
    const steamPositions = [BX + BW * 0.25, BX + BW * 0.5, BX + BW * 0.75]
    steamPositions.forEach((sx, i) => {
      const offset = i % 2 === 0 ? 5 * sc : -5 * sc
      ctx.beginPath()
      ctx.moveTo(sx, BY - 8 * sc)
      ctx.bezierCurveTo(
        sx + offset, BY - 18 * sc,
        sx - offset, BY - 28 * sc,
        sx, BY - 38 * sc
      )
      ctx.stroke()
    })
  }
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number, cy: number,
  r: number,
  initial: string,
  color: string
) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()

  if (img) {
    // Cover fit
    const size = r * 2
    const ratio = Math.max(size / img.naturalWidth, size / img.naturalHeight)
    const dw = img.naturalWidth * ratio
    const dh = img.naturalHeight * ratio
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh)
  } else {
    ctx.fillStyle = color
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.font = `bold ${r}px system-ui, -apple-system, sans-serif`
    ctx.fillStyle = 'white'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initial.toUpperCase(), cx, cy)
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'
  }

  ctx.restore()

  // Ring
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.strokeStyle = '#e8d4b0'
  ctx.lineWidth = 1.5
  ctx.stroke()
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
  const photos = (
    rating.photo_urls?.length
      ? rating.photo_urls
      : rating.photo_url ? [rating.photo_url] : []
  ).filter(Boolean) as string[]
  const liquidColor = getLiquidColor(fill)
  const fillLabel = getFillLabel(fill)
  const location = formatLocation(shop?.city, shop?.state, shop?.country)

  useEffect(() => { generateCard() }, [])

  async function generateCard() {
    setGenerating(true)
    setStatus(null)
    const canvas = canvasRef.current
    if (!canvas) { setGenerating(false); return }

    // ── Layout constants (logical pixels, drawn at SCALE) ───
    const W = 390
    const PAD = 20
    const CARD_MX = 16        // card horizontal margin
    const CARD_W = W - CARD_MX * 2
    const CARD_R = 20         // card corner radius
    const HEADER_H = 76
    const CARD_PAD_TOP = 16
    const AVATAR_R = 20       // avatar radius
    const AVATAR_ROW_H = 48
    const DRINK_ROW_H = rating.drink_name ? 38 : 0
    const MUG_SIZE = 72
    const MUG_ROW_H = (!isVibePost && fill > 0) ? MUG_SIZE + 16 : 0
    const BADGE_ROW_H = (isQuickSip || isVibePost) ? 34 : 0

    // Load images in parallel
    const [avatarImg, ...photoImgs] = await Promise.all([
      user?.avatar_url ? loadImage(user.avatar_url) : Promise.resolve(null),
      ...photos.slice(0, 4).map(u => loadImage(u)),
    ])

    const loadedPhotos = photoImgs.filter(Boolean) as HTMLImageElement[]
    const PHOTO_H = loadedPhotos.length > 0
      ? (loadedPhotos.length === 1 ? 260 : loadedPhotos.length <= 2 ? 180 : 240)
      : 0

    const TAGS_H = (rating.vibe_tags?.length || 0) > 0 ? 44 : 0

    // Pre-measure caption lines
    const tmpCtx = document.createElement('canvas').getContext('2d')!
    tmpCtx.font = `14px system-ui, -apple-system, sans-serif`
    const captionLines = rating.caption
      ? wrapText(tmpCtx, rating.caption, CARD_W - PAD * 2)
      : []
    const CAPTION_H = captionLines.length > 0
      ? Math.min(captionLines.length, 6) * 22 + 20
      : 0

    const SHOP_H = shop ? 58 : 0
    const CARD_PAD_BOT = 16
    const FOOTER_H = 68

    const CARD_H =
      CARD_PAD_TOP + AVATAR_ROW_H + DRINK_ROW_H + MUG_ROW_H +
      BADGE_ROW_H + PHOTO_H + TAGS_H + CAPTION_H + SHOP_H + CARD_PAD_BOT

    const TOTAL_H = HEADER_H + 16 + CARD_H + 16 + FOOTER_H

    // ── Set up canvas at SCALE resolution ───────────────────
    canvas.width = W * SCALE
    canvas.height = TOTAL_H * SCALE
    const ctx = canvas.getContext('2d')!
    ctx.scale(SCALE, SCALE)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // ── Background ──────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, TOTAL_H)
    bg.addColorStop(0, '#fdfaf5')
    bg.addColorStop(1, '#efe0c8')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, TOTAL_H)

    // ── Header ───────────────────────────────────────────────
    let Y = 0
    const hdrGrad = ctx.createLinearGradient(0, 0, W, 0)
    hdrGrad.addColorStop(0, '#1c0a02')
    hdrGrad.addColorStop(1, '#3d1a06')
    ctx.fillStyle = hdrGrad
    ctx.fillRect(0, Y, W, HEADER_H)

    // ☕ icon circle
    const iconCX = PAD + 22, iconCY = Y + HEADER_H / 2
    ctx.beginPath()
    ctx.arc(iconCX, iconCY, 22, 0, Math.PI * 2)
    ctx.fillStyle = '#c8853a'
    ctx.fill()
    ctx.font = '22px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'white'
    ctx.fillText('☕', iconCX, iconCY + 1)
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'

    ctx.font = 'bold 21px Georgia, serif'
    ctx.fillStyle = 'white'
    ctx.fillText('Social Brew', PAD + 54, Y + HEADER_H / 2 - 2)
    ctx.font = '12px system-ui, -apple-system, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillText('Independent coffee only', PAD + 54, Y + HEADER_H / 2 + 17)

    Y += HEADER_H + 16

    // ── Card shadow + background ─────────────────────────────
    ctx.save()
    ctx.shadowColor = 'rgba(28,10,2,0.12)'
    ctx.shadowBlur = 20
    ctx.shadowOffsetY = 6
    roundRect(ctx, CARD_MX, Y, CARD_W, CARD_H, CARD_R)
    ctx.fillStyle = 'white'
    ctx.fill()
    ctx.restore()

    // ── Card content ─────────────────────────────────────────
    const CX = CARD_MX
    let CY = Y + CARD_PAD_TOP

    // Avatar + username + badge + time
    const avCX = CX + PAD + AVATAR_R
    const avCY = CY + AVATAR_R
    drawAvatar(
      ctx, avatarImg, avCX, avCY, AVATAR_R,
      user?.username?.[0] || '?', liquidColor
    )

    const textX = CX + PAD + AVATAR_R * 2 + 10
    ctx.font = `bold 14px system-ui, -apple-system, sans-serif`
    ctx.fillStyle = '#1c0a02'
    ctx.fillText(user?.username || '', textX, CY + 16)

    // Badge pill
    if (user?.badge) {
      const usernameW = ctx.measureText(user.username || '').width
      const pillX = textX + usernameW + 8
      ctx.font = `10px system-ui, -apple-system, sans-serif`
      const pillW = ctx.measureText(user.badge).width + 14
      roundRect(ctx, pillX, CY + 5, pillW, 16, 8)
      ctx.fillStyle = '#f5ead8'
      ctx.fill()
      ctx.strokeStyle = '#e8d4b0'
      ctx.lineWidth = 0.5
      ctx.stroke()
      ctx.fillStyle = '#9b7a55'
      ctx.fillText(user.badge, pillX + 7, CY + 16)
    }

    // Visit time
    if (rating.visit_time) {
      ctx.font = `11px system-ui, -apple-system, sans-serif`
      ctx.fillStyle = '#9b7a55'
      ctx.fillText(`🕐 ${rating.visit_time}`, textX, CY + 34)
    }

    CY += AVATAR_ROW_H

    // Drink name pill
    if (rating.drink_name) {
      ctx.font = `11px system-ui, -apple-system, sans-serif`
      ctx.fillStyle = '#9b7a55'
      ctx.fillText('ordered', CX + PAD, CY + 17)
      const ordW = ctx.measureText('ordered').width
      const pillX = CX + PAD + ordW + 8
      ctx.font = `12px system-ui, -apple-system, sans-serif`
      const pillW = ctx.measureText(rating.drink_name).width + 22
      roundRect(ctx, pillX, CY + 5, pillW, 22, 11)
      ctx.fillStyle = '#f0e8dc'
      ctx.fill()
      ctx.fillStyle = '#1c0a02'
      ctx.fillText(rating.drink_name, pillX + 11, CY + 20)
      CY += DRINK_ROW_H
    }

    // Mug + rating label + fill bar
    if (!isVibePost && fill > 0) {
      drawMug(ctx, CX + PAD, CY, MUG_SIZE, fill)

      const labelX = CX + PAD + MUG_SIZE + 18
      const labelY = CY + 22

      ctx.font = `bold 19px Georgia, serif`
      ctx.fillStyle = '#1c0a02'
      ctx.fillText(fillLabel, labelX, labelY)

      // Fill bar
      const barX = labelX
      const barY = labelY + 12
      const barW = CARD_W - PAD - MUG_SIZE - 18 - PAD - 32
      const barH = 8
      roundRect(ctx, barX, barY, barW, barH, barH / 2)
      ctx.fillStyle = '#f0e4d0'
      ctx.fill()
      roundRect(ctx, barX, barY, barW * (fill / 100), barH, barH / 2)
      const fillGrad = ctx.createLinearGradient(barX, 0, barX + barW * (fill / 100), 0)
      fillGrad.addColorStop(0, liquidColor + '88')
      fillGrad.addColorStop(1, liquidColor)
      ctx.fillStyle = fillGrad
      ctx.fill()

      // Percentage
      ctx.font = `bold 14px system-ui, -apple-system, sans-serif`
      ctx.fillStyle = liquidColor
      ctx.fillText(`${fill}%`, barX + barW + 6, barY + barH - 1)

      CY += MUG_ROW_H
    }

    // Quick Sip / Vibe Check badge
    if (isQuickSip) {
      const pillW = 90
      roundRect(ctx, CX + PAD, CY + 7, pillW, 22, 11)
      ctx.fillStyle = '#eff6ff'
      ctx.fill()
      ctx.font = `11px system-ui, -apple-system, sans-serif`
      ctx.fillStyle = '#3b82f6'
      ctx.fillText('⚡ Quick Sip', CX + PAD + 8, CY + 22)
      CY += BADGE_ROW_H
    } else if (isVibePost) {
      const pillW = 100
      roundRect(ctx, CX + PAD, CY + 7, pillW, 22, 11)
      ctx.fillStyle = '#f5e6d0'
      ctx.fill()
      ctx.font = `11px system-ui, -apple-system, sans-serif`
      ctx.fillStyle = '#c8853a'
      ctx.fillText('✨ Vibe Check', CX + PAD + 8, CY + 22)
      CY += BADGE_ROW_H
    }

    // Photos — each drawn in its own save/restore with its own clip
    // No outer clip needed — white card background hides any overflow
    if (loadedPhotos.length > 0 && PHOTO_H > 0) {

      function drawPhoto(
        img: HTMLImageElement,
        px: number, py: number,
        pw: number, ph: number
      ) {
        const scaleW = pw / img.naturalWidth
        const scaleH = ph / img.naturalHeight
        const ratio = Math.max(scaleW, scaleH) // cover fit
        const dw = img.naturalWidth * ratio
        const dh = img.naturalHeight * ratio
        const dx = px + (pw - dw) / 2
        const dy = py + (ph - dh) / 2
        ctx.save()
        ctx.beginPath()
        ctx.rect(px, py, pw, ph)
        ctx.clip()
        ctx.drawImage(img, dx, dy, dw, dh)
        ctx.restore()
      }

      const GAP = 2 // white gap between photos

      if (loadedPhotos.length === 1) {
        drawPhoto(loadedPhotos[0], CX, CY, CARD_W, PHOTO_H)

      } else if (loadedPhotos.length === 2) {
        const colW = (CARD_W - GAP) / 2
        drawPhoto(loadedPhotos[0], CX, CY, colW, PHOTO_H)
        drawPhoto(loadedPhotos[1], CX + colW + GAP, CY, colW, PHOTO_H)

      } else if (loadedPhotos.length === 3) {
        const topH = Math.floor(PHOTO_H * 0.56)
        const botH = PHOTO_H - topH - GAP
        const colW = (CARD_W - GAP) / 2
        drawPhoto(loadedPhotos[0], CX, CY, CARD_W, topH)
        drawPhoto(loadedPhotos[1], CX, CY + topH + GAP, colW, botH)
        drawPhoto(loadedPhotos[2], CX + colW + GAP, CY + topH + GAP, colW, botH)

      } else {
        // 4 photos: equal 2x2 grid
        const colW = (CARD_W - GAP) / 2
        const rowH = (PHOTO_H - GAP) / 2
        drawPhoto(loadedPhotos[0], CX,           CY,           colW, rowH)
        drawPhoto(loadedPhotos[1], CX + colW + GAP, CY,        colW, rowH)
        drawPhoto(loadedPhotos[2], CX,           CY + rowH + GAP, colW, rowH)
        drawPhoto(loadedPhotos[3], CX + colW + GAP, CY + rowH + GAP, colW, rowH)
      }

      CY += PHOTO_H
    }

    // Vibe tags
    if (rating.vibe_tags && rating.vibe_tags.length > 0) {
      let tx = CX + PAD
      rating.vibe_tags.forEach(tag => {
        ctx.font = `11px system-ui, -apple-system, sans-serif`
        const tw = ctx.measureText(tag).width + 18
        if (tx + tw > CX + CARD_W - PAD) return // skip if overflows
        roundRect(ctx, tx, CY + 10, tw, 22, 11)
        ctx.fillStyle = '#f5ead8'
        ctx.fill()
        ctx.strokeStyle = '#e8d4b0'
        ctx.lineWidth = 0.8
        ctx.stroke()
        ctx.fillStyle = '#7a5c3a'
        ctx.fillText(tag, tx + 9, CY + 25)
        tx += tw + 8
      })
      CY += TAGS_H
    }

    // Caption — max 6 lines
    if (captionLines.length > 0) {
      ctx.font = `13px Georgia, serif`
      ctx.fillStyle = '#3d2010'
      const maxLines = Math.min(captionLines.length, 6)
      for (let i = 0; i < maxLines; i++) {
        ctx.fillText(captionLines[i], CX + PAD, CY + 16 + i * 22)
      }
      if (captionLines.length > 6) {
        ctx.fillStyle = '#9b7a55'
        ctx.font = `12px system-ui, -apple-system, sans-serif`
        ctx.fillText('...', CX + PAD, CY + 16 + 6 * 22)
      }
      CY += CAPTION_H
    }

    // Shop card
    if (shop) {
      const shopCardY = CY + 8
      const shopCardH = 44
      roundRect(ctx, CX + PAD, shopCardY, CARD_W - PAD * 2, shopCardH, 12)
      ctx.fillStyle = '#fdfaf5'
      ctx.fill()
      ctx.strokeStyle = '#e8d4b0'
      ctx.lineWidth = 1
      ctx.stroke()

      ctx.font = `bold 13px system-ui, -apple-system, sans-serif`
      ctx.fillStyle = '#1c0a02'
      ctx.fillText(shop.name, CX + PAD + 12, shopCardY + 18)

      if (location) {
        ctx.font = `11px system-ui, -apple-system, sans-serif`
        ctx.fillStyle = '#9b7a55'
        ctx.fillText(location, CX + PAD + 12, shopCardY + 34)
      }

      ctx.font = `bold 11px system-ui, -apple-system, sans-serif`
      ctx.fillStyle = '#c8853a'
      ctx.textAlign = 'right'
      ctx.fillText('View →', CX + CARD_W - PAD, shopCardY + 26)
      ctx.textAlign = 'left'
    }

    // ── Footer ───────────────────────────────────────────────
    const footerY = Y + CARD_H + 16
    ctx.font = `12px system-ui, -apple-system, sans-serif`
    ctx.fillStyle = '#9b7a55'
    ctx.textAlign = 'center'
    ctx.fillText('Discover independent coffee shops', W / 2, footerY + 20)
    ctx.font = `bold 13px system-ui, -apple-system, sans-serif`
    ctx.fillStyle = '#c8853a'
    ctx.fillText(`Join Social Brew → ${APP_URL}`, W / 2, footerY + 42)
    ctx.textAlign = 'left'

    // ── Export ───────────────────────────────────────────────
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
          style={{ height: 280 }}>
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
          <p className="mx-5 mb-3 text-coffee-500 text-xs text-center leading-relaxed bg-cream-50 rounded-xl px-3 py-2">
            {status}
          </p>
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

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  )
}
