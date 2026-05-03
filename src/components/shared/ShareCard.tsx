/**
 * ShareCard.tsx
 *
 * Generates a beautiful Instagram Stories-ready image card from a rating post.
 * Uses HTML Canvas to render the mug fill graphic, shop info, rating label,
 * and Social Brew branding into a 1080x1920 image.
 *
 * Share flow:
 * 1. User taps Share on a post
 * 2. ShareCard renders the canvas off-screen
 * 3. Canvas exports to PNG blob
 * 4. On iOS/Android: tries to open Instagram Stories directly via URL scheme
 * 5. Falls back to native Web Share API if Instagram isn't available
 * 6. Falls back to download if Web Share isn't supported
 */

import { useEffect, useRef, useState } from 'react'
import { X, Download } from 'lucide-react'

interface Rating {
  id: string
  fill_level: number
  caption?: string | null
  drink_name?: string | null
  vibe_tags?: string[]
  photo_url?: string | null
  coffee_shops?: {
    name: string
    city?: string | null
  }
  profiles?: {
    username: string
  }
}

interface Props {
  rating: Rating
  onClose: () => void
}

// Mug fill color matching the app's scale
function getMugColor(fill: number): string {
  if (fill >= 90) return '#3d1a06'
  if (fill >= 80) return '#6b3410'
  if (fill >= 70) return '#b87333'
  if (fill >= 60) return '#c49a6c'
  return '#d4b896'
}

function getFillLabel(fill: number): string {
  if (fill === 100) return '✨ Perfect Brew'
  if (fill >= 90) return 'Loved It'
  if (fill >= 80) return 'Good Brew'
  if (fill >= 70) return 'Decent Pour'
  if (fill >= 60) return 'Just a Sip'
  return 'Not My Cup'
}

// Draw the mug on canvas — matches the app's SVG mug shape
function drawMug(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: number) {
  const mugColor = getMugColor(fill)
  const fillHeight = (fill / 100) * (h * 0.75)
  const fillY = y + h * 0.1 + (h * 0.75 - fillHeight)

  // Mug body outline
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y + h * 0.08, w * 0.78, h * 0.82, 12)
  ctx.fillStyle = '#f5ead8'
  ctx.fill()
  ctx.strokeStyle = '#d4b896'
  ctx.lineWidth = 3
  ctx.stroke()

  // Liquid fill with clip
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x + 3, y + h * 0.08 + 3, w * 0.78 - 6, h * 0.82 - 6, 10)
  ctx.clip()
  ctx.fillStyle = mugColor
  ctx.fillRect(x, fillY, w * 0.78, fillHeight + h * 0.9)
  ctx.restore()

  // Mug handle
  ctx.beginPath()
  ctx.arc(x + w * 0.78 + w * 0.12, y + h * 0.42, w * 0.18, -Math.PI * 0.6, Math.PI * 0.6)
  ctx.strokeStyle = '#d4b896'
  ctx.lineWidth = 8
  ctx.stroke()

  // Steam lines (only if fill >= 65)
  if (fill >= 65) {
    ctx.strokeStyle = mugColor
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    const steamPositions = [x + w * 0.18, x + w * 0.39, x + w * 0.6]
    steamPositions.forEach((sx) => {
      ctx.beginPath()
      ctx.moveTo(sx, y + h * 0.06)
      ctx.bezierCurveTo(sx + 8, y - h * 0.06, sx - 8, y - h * 0.14, sx, y - h * 0.22)
      ctx.stroke()
    })
  }

  ctx.restore()
}

export default function ShareCard({ rating, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [generating, setGenerating] = useState(true)
  const [imageBlob, setImageBlob] = useState<Blob | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const shopName = rating.coffee_shops?.name || 'Unknown Shop'
  const city = rating.coffee_shops?.city || ''
  const username = rating.profiles?.username || ''
  const fill = rating.fill_level || 0
  const label = getFillLabel(fill)
  const mugColor = getMugColor(fill)

  useEffect(() => {
    generateCard()
  }, [])

  async function generateCard() {
    const canvas = canvasRef.current
    if (!canvas) return

    // Instagram Stories dimensions
    canvas.width = 1080
    canvas.height = 1920
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Background gradient — warm cream to light tan
    const bg = ctx.createLinearGradient(0, 0, 0, 1920)
    bg.addColorStop(0, '#fdfaf5')
    bg.addColorStop(0.5, '#f5ead8')
    bg.addColorStop(1, '#efe0c4')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, 1080, 1920)

    // Subtle texture dots
    ctx.fillStyle = 'rgba(200,133,58,0.04)'
    for (let i = 0; i < 80; i++) {
      const dx = Math.random() * 1080
      const dy = Math.random() * 1920
      ctx.beginPath()
      ctx.arc(dx, dy, Math.random() * 20 + 5, 0, Math.PI * 2)
      ctx.fill()
    }

    // Top Social Brew wordmark
    ctx.fillStyle = '#1c0a02'
    ctx.font = 'bold 52px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('Social Brew', 540, 140)

    // Tagline
    ctx.fillStyle = '#b8956a'
    ctx.font = '32px sans-serif'
    ctx.letterSpacing = '4px'
    ctx.fillText('INDEPENDENT COFFEE', 540, 195)
    ctx.letterSpacing = '0px'

    // Divider line
    ctx.strokeStyle = '#e8d4b0'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(120, 225)
    ctx.lineTo(960, 225)
    ctx.stroke()

    // Photo (if available) — load and draw
    if (rating.photo_url) {
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((resolve) => {
          img.onload = () => resolve()
          img.onerror = () => resolve() // fail silently
          img.src = rating.photo_url!
          setTimeout(resolve, 3000) // timeout after 3s
        })
        if (img.complete && img.naturalWidth > 0) {
          // Draw photo as a rounded rectangle
          ctx.save()
          ctx.beginPath()
          ctx.roundRect(80, 260, 920, 680, 24)
          ctx.clip()
          // Cover fit
          const ratio = Math.max(920 / img.naturalWidth, 680 / img.naturalHeight)
          const dw = img.naturalWidth * ratio
          const dh = img.naturalHeight * ratio
          ctx.drawImage(img, 80 + (920 - dw) / 2, 260 + (680 - dh) / 2, dw, dh)
          ctx.restore()
          // Photo border
          ctx.strokeStyle = '#e8d4b0'
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.roundRect(80, 260, 920, 680, 24)
          ctx.stroke()
        }
      } catch {}
    }

    // Main card area
    const cardY = rating.photo_url ? 980 : 280
    const cardH = rating.photo_url ? 760 : 1200

    // Card background
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.save()
    ctx.shadowColor = 'rgba(28,10,2,0.08)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 8
    ctx.beginPath()
    ctx.roundRect(60, cardY, 960, cardH, 32)
    ctx.fill()
    ctx.restore()

    // Draw mug
    const mugSize = rating.photo_url ? 160 : 220
    const mugX = 540 - mugSize * 0.5
    const mugY = cardY + (rating.photo_url ? 40 : 80)
    drawMug(ctx, mugX, mugY, mugSize, mugSize * 1.1, fill)

    // Fill percentage
    const pctY = mugY + mugSize * 1.25
    ctx.fillStyle = mugColor
    ctx.font = `bold ${rating.photo_url ? 72 : 96}px Georgia, serif`
    ctx.textAlign = 'center'
    ctx.fillText(`${fill}%`, 540, pctY)

    // Rating label
    ctx.fillStyle = '#1c0a02'
    ctx.font = `bold ${rating.photo_url ? 48 : 60}px Georgia, serif`
    ctx.fillText(label, 540, pctY + (rating.photo_url ? 60 : 76))

    // Divider
    const divY = pctY + (rating.photo_url ? 90 : 110)
    ctx.strokeStyle = '#e8d4b0'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(160, divY)
    ctx.lineTo(920, divY)
    ctx.stroke()

    // Drink name
    const drinkName = rating.drink_name || ''
    if (drinkName) {
      ctx.fillStyle = '#c8853a'
      ctx.font = `${rating.photo_url ? 36 : 42}px sans-serif`
      ctx.fillText(drinkName, 540, divY + (rating.photo_url ? 52 : 64))
    }

    // Shop name
    const shopY = divY + (drinkName ? (rating.photo_url ? 110 : 130) : (rating.photo_url ? 60 : 70))
    ctx.fillStyle = '#1c0a02'
    ctx.font = `bold ${rating.photo_url ? 44 : 54}px Georgia, serif`
    ctx.fillText(shopName, 540, shopY)

    // City
    if (city) {
      ctx.fillStyle = '#9b7a55'
      ctx.font = `${rating.photo_url ? 32 : 38}px sans-serif`
      ctx.fillText(city, 540, shopY + (rating.photo_url ? 46 : 56))
    }

    // Caption
    if (rating.caption) {
      const capY = shopY + (city ? (rating.photo_url ? 90 : 110) : (rating.photo_url ? 60 : 70))
      ctx.fillStyle = '#5a3e28'
      ctx.font = `italic ${rating.photo_url ? 30 : 36}px Georgia, serif`
      // Word wrap caption
      const words = rating.caption.split(' ')
      let line = ''
      let lineY = capY
      const maxWidth = 800
      const lineHeight = rating.photo_url ? 42 : 50
      for (const word of words) {
        const test = line + (line ? ' ' : '') + word
        if (ctx.measureText(test).width > maxWidth && line) {
          ctx.fillText(`"${line}"`, 540, lineY)
          line = word
          lineY += lineHeight
          if (lineY > cardY + cardH - 80) break
        } else {
          line = test
        }
      }
      if (line) ctx.fillText(line.startsWith('"') ? `${line}"` : `"${line}"`, 540, lineY)
    }

    // Vibe tags
    if (rating.vibe_tags && rating.vibe_tags.length > 0) {
      const tagY = cardY + cardH - (rating.photo_url ? 80 : 100)
      ctx.fillStyle = '#b8956a'
      ctx.font = `${rating.photo_url ? 28 : 34}px sans-serif`
      ctx.fillText(rating.vibe_tags.join('  ·  '), 540, tagY)
    }

    // Bottom username + CTA
    ctx.fillStyle = '#9b7a55'
    ctx.font = '34px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`@${username} on Social Brew`, 540, 1800)

    ctx.fillStyle = '#c8853a'
    ctx.font = 'bold 36px sans-serif'
    ctx.fillText('socialbrew-ani.pages.dev', 540, 1850)

    // Convert to blob
    canvas.toBlob(blob => {
      if (blob) {
        setImageBlob(blob)
        setImageUrl(URL.createObjectURL(blob))
      }
      setGenerating(false)
    }, 'image/png', 0.95)
  }

  async function shareToInstagramStories() {
    if (!imageBlob) return
    setSharing(true)
    setError(null)

    try {
      // Method 1: Instagram Stories URL scheme (iOS/Android native app)
      // Convert blob to base64 for URL scheme
      const reader = new FileReader()
      reader.onload = async () => {
        // Try Web Share API first (works on modern iOS/Android)
        if (navigator.share && navigator.canShare) {
          const file = new File([imageBlob!], 'social-brew-share.png', { type: 'image/png' })
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              files: [file],
              title: `${shopName} on Social Brew`,
            })
            setSharing(false)
            return
          }
        }

        // Method 2: Instagram Stories URL scheme
        // Works when Instagram app is installed
        const instagramUrl = `instagram-stories://share?source_application=social_brew`
        window.location.href = instagramUrl

        // If Instagram isn't installed, fall back after delay
        setTimeout(() => {
          // Fall back to downloading the image
          handleDownload()
          setError('Instagram not detected — image saved to download instead')
          setSharing(false)
        }, 1500)
      }
      reader.readAsDataURL(imageBlob)
    } catch (err: any) {
      // Fall back to download
      handleDownload()
      setError('Tap the downloaded image and share to Instagram Stories')
      setSharing(false)
    }
  }

  function handleDownload() {
    if (!imageUrl) return
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = `social-brew-${shopName.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.9)' }}
      onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white rounded-t-3xl pb-8 px-5 pt-5"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-coffee-800 text-lg">Share to Instagram</h3>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center">
            <X size={15} className="text-coffee-500" />
          </button>
        </div>

        {/* Preview */}
        <div className="w-full rounded-2xl overflow-hidden mb-4 bg-cream-100 flex items-center justify-center"
          style={{ height: 280 }}>
          {generating ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
              <p className="text-coffee-400 text-sm">Generating your card...</p>
            </div>
          ) : imageUrl ? (
            <img src={imageUrl} alt="Share card preview"
              className="w-full h-full object-contain" />
          ) : null}
        </div>

        {error && (
          <p className="text-coffee-500 text-xs text-center mb-3 leading-relaxed">{error}</p>
        )}

        {/* Share to Instagram Stories button */}
        <button
          onClick={shareToInstagramStories}
          disabled={generating || sharing}
          className="w-full py-4 rounded-2xl text-white font-bold text-base mb-3 flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
          </svg>
          {sharing ? 'Opening Instagram...' : 'Share to Instagram Stories'}
        </button>

        {/* Download fallback */}
        <button
          onClick={handleDownload}
          disabled={generating}
          className="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 bg-cream-100 text-coffee-700">
          <Download size={16} />
          Save Image Instead
        </button>

        <p className="text-coffee-300 text-xs text-center mt-3 leading-relaxed">
          Save the image and open Instagram → tap + → Story → select from camera roll
        </p>

        {/* Hidden canvas for rendering */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  )
}
