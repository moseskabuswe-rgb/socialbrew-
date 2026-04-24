// src/components/shared/AvatarCropper.tsx
// Canvas-based circular avatar cropper — no external dependencies

import { useEffect, useRef, useState, useCallback } from 'react'
import { Check, X, ZoomIn, ZoomOut } from 'lucide-react'

interface Props {
  imageFile: File
  onCrop: (croppedBlob: Blob) => void
  onCancel: () => void
}

export default function AvatarCropper({ imageFile, onCrop, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 })

  const SIZE = 280 // canvas size
  const RADIUS = 120 // crop circle radius

  // Load image
  useEffect(() => {
    const url = URL.createObjectURL(imageFile)
    const image = new Image()
    image.onload = () => {
      setImg(image)
      // Initial scale: fit the image so it covers the circle
      const minDim = Math.min(image.width, image.height)
      const initialScale = (RADIUS * 2) / minDim
      setScale(initialScale)
      setOffset({ x: 0, y: 0 })
      URL.revokeObjectURL(url)
    }
    image.src = url
  }, [imageFile])

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, SIZE, SIZE)

    // Draw image
    const cx = SIZE / 2
    const cy = SIZE / 2
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, cx - w / 2 + offset.x, cy - h / 2 + offset.y, w, h)

    // Dark overlay outside circle
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Circle border
    ctx.strokeStyle = '#c8853a'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2)
    ctx.stroke()
  }, [img, scale, offset])

  useEffect(() => { draw() }, [draw])

  // Drag handlers
  function onMouseDown(e: React.MouseEvent) {
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    })
  }
  function onMouseUp() { setDragging(false) }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    setDragging(true)
    dragStart.current = { x: t.clientX, y: t.clientY, ox: offset.x, oy: offset.y }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (!dragging) return
    const t = e.touches[0]
    setOffset({
      x: dragStart.current.ox + (t.clientX - dragStart.current.x),
      y: dragStart.current.oy + (t.clientY - dragStart.current.y),
    })
  }

  function handleCrop() {
    const canvas = canvasRef.current
    if (!canvas || !img) return

    // Draw just the circle onto a fresh canvas
    const out = document.createElement('canvas')
    out.width = RADIUS * 2
    out.height = RADIUS * 2
    const ctx = out.getContext('2d')
    if (!ctx) return

    const cx = SIZE / 2
    const cy = SIZE / 2
    const w = img.width * scale
    const h = img.height * scale

    ctx.beginPath()
    ctx.arc(RADIUS, RADIUS, RADIUS, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(
      img,
      cx - w / 2 + offset.x - (cx - RADIUS),
      cy - h / 2 + offset.y - (cy - RADIUS),
      w, h
    )

    out.toBlob(blob => {
      if (blob) {
        onCrop(blob)
      } else {
        // toBlob failed — fall back to uploading original image as blob
        fetch(img.src)
          .then(r => r.blob())
          .then(b => onCrop(b))
          .catch(() => alert('Could not process image. Please try a different photo.'))
      }
    }, 'image/jpeg', 0.92)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: 'rgba(8,4,1,0.95)', backdropFilter: 'blur(8px)' }}>

      <p className="text-white font-semibold text-base mb-2">Drag to reposition</p>
      <p className="text-white/50 text-xs mb-5">Pinch or use buttons to zoom</p>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        style={{ borderRadius: 16, cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onMouseUp}
      />

      {/* Zoom controls */}
      <div className="flex items-center gap-4 mt-5">
        <button
          onClick={() => setScale(s => Math.max(s - 0.1, 0.5))}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-95"
        >
          <ZoomOut size={18} />
        </button>
        <div className="w-28 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(((scale - 0.5) / 2.5) * 100, 100)}%`, background: '#c8853a' }}
          />
        </div>
        <button
          onClick={() => setScale(s => Math.min(s + 0.1, 3))}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-95"
        >
          <ZoomIn size={18} />
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-4 mt-6">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-semibold text-sm"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <X size={16} /> Cancel
        </button>
        <button
          onClick={handleCrop}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)', boxShadow: '0 4px 16px rgba(200,133,58,0.4)' }}
        >
          <Check size={16} /> Use Photo
        </button>
      </div>
    </div>
  )
}
