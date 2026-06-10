import { useEffect, useRef, useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pifpkfuulfnweeiqufbq.supabase.co'

interface Props {
  onClose: () => void
  onStampEarned: (shopName: string, rewardEarned: boolean, newCount: number, required: number) => void
}

export default function QRScannerModal({ onClose, onStampEarned }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const processingRef = useRef(false)

  const [status, setStatus] = useState<'scanning' | 'redeeming' | 'error' | 'success'>('scanning')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  const handleScan = useCallback(async (rawValue: string) => {
    if (processingRef.current) return
    processingRef.current = true
    setStatus('redeeming')
    stopCamera()

    try {
      const token = rawValue.startsWith('sbpunch:') ? rawValue.slice(8) : rawValue
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/redeem-punch-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ token }),
        }
      )
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}

      if (!res.ok) {
        setErrorMsg(data.error || 'Could not redeem stamp. Please try again.')
        setStatus('error')
        processingRef.current = false
        return
      }

      setStatus('success')
      setTimeout(() => {
        onStampEarned(data.shop_name, data.reward_earned, data.new_count, data.required)
      }, 1200)
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
      setStatus('error')
      processingRef.current = false
    }
  }, [stopCamera, onStampEarned])

  const scanFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanFrame)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(video, 0, 0)

    // BarcodeDetector — Chrome/Android
    if ('BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      detector.detect(canvas).then((barcodes: any[]) => {
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          handleScan(barcodes[0].rawValue)
        } else {
          animFrameRef.current = requestAnimationFrame(scanFrame)
        }
      }).catch(() => {
        animFrameRef.current = requestAnimationFrame(scanFrame)
      })
      return
    }

    // jsQR fallback — iOS/Safari
    import('jsqr').then(({ default: jsQR }) => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code?.data) {
        handleScan(code.data)
      } else {
        animFrameRef.current = requestAnimationFrame(scanFrame)
      }
    }).catch(() => {
      animFrameRef.current = requestAnimationFrame(scanFrame)
    })
  }, [handleScan])

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          animFrameRef.current = requestAnimationFrame(scanFrame)
        }
      } catch {
        setErrorMsg('Camera access denied. Please allow camera access in your device settings and try again.')
        setStatus('error')
      }
    }
    startCamera()
    return stopCamera
  }, [scanFrame, stopCamera])

  return (
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ background: '#0d0904' }}>
      <div className="flex items-center justify-between px-5 pt-12 pb-4 flex-shrink-0">
        <div>
          <p className="text-white font-display font-bold text-lg">Scan to Earn a Stamp</p>
          <p className="text-cream-400 text-xs mt-0.5">Point your camera at the shop's QR code</p>
        </div>
        <button
          onClick={() => { stopCamera(); onClose() }}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        {status === 'scanning' && (
          <>
            <div className="relative w-full max-w-xs aspect-square rounded-2xl overflow-hidden">
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-caramel rounded-tl-lg" />
                <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-caramel rounded-tr-lg" />
                <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-caramel rounded-bl-lg" />
                <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-caramel rounded-br-lg" />
              </div>
            </div>
            <p className="text-cream-400 text-xs text-center">
              The shop's QR code refreshes every 3 minutes
            </p>
          </>
        )}

        {status === 'redeeming' && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full border-2 border-caramel border-t-transparent animate-spin mx-auto mb-4" />
            <p className="text-white font-semibold">Earning your stamp...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-caramel/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">☕</span>
            </div>
            <p className="text-white font-display font-bold text-xl">Stamp earned!</p>
            <p className="text-cream-400 text-sm mt-1">Check your Cards tab for progress</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center px-4">
            <p className="text-4xl mb-4">😕</p>
            <p className="text-red-400 text-sm mb-6 leading-relaxed">{errorMsg}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => { stopCamera(); onClose() }}
                className="px-5 py-2.5 rounded-full text-sm font-semibold bg-white/10 text-white"
              >
                Close
              </button>
              <button
                onClick={() => {
                  processingRef.current = false
                  setStatus('scanning')
                  setErrorMsg(null)
                  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                    .then(stream => {
                      streamRef.current = stream
                      if (videoRef.current) {
                        videoRef.current.srcObject = stream
                        videoRef.current.play().then(() => {
                          animFrameRef.current = requestAnimationFrame(scanFrame)
                        })
                      }
                    })
                    .catch(() => { setErrorMsg('Camera unavailable.'); setStatus('error') })
                }}
                className="px-5 py-2.5 rounded-full text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
