import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import ShopQRDisplay from '../../components/shops/ShopQRDisplay'

interface Props {
  shop: { id: string; name: string }
  userId: string
}

type ScanStatus = 'scanning' | 'processing' | 'success' | 'error'

function RedemptionScanner({ shop }: { shop: { id: string; name: string } }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const processingRef = useRef(false)

  const [status, setStatus] = useState<ScanStatus>('scanning')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successInfo, setSuccessInfo] = useState<{ reward: string; punches: number } | null>(null)
  const [cameraRequested, setCameraRequested] = useState(false)

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  const handleScan = useCallback(async (rawValue: string) => {
    if (processingRef.current) return
    processingRef.current = true
    setStatus('processing')
    stopCamera()

    const { data, error } = await supabase.rpc('confirm_redemption', {
      p_token: rawValue,
      p_shop_id: shop.id,
    })

    if (error || !data?.success) {
      setErrorMsg((data as any)?.error || error?.message || 'Could not confirm. Please try again.')
      setStatus('error')
      processingRef.current = false
      return
    }

    setSuccessInfo({
      reward: (data as any).reward_description || 'Reward',
      punches: (data as any).punches_at_redemption ?? 0,
    })
    setStatus('success')
  }, [stopCamera, shop.id])

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

    if ('BarcodeDetector' in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      detector.detect(canvas)
        .then((barcodes: any[]) => {
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            handleScan(barcodes[0].rawValue)
          } else {
            animFrameRef.current = requestAnimationFrame(scanFrame)
          }
        })
        .catch(() => { animFrameRef.current = requestAnimationFrame(scanFrame) })
      return
    }

    import('jsqr').then(({ default: jsQR }) => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code?.data) {
        handleScan(code.data)
      } else {
        animFrameRef.current = requestAnimationFrame(scanFrame)
      }
    }).catch(() => { animFrameRef.current = requestAnimationFrame(scanFrame) })
  }, [handleScan])

  useEffect(() => {
    if (!cameraRequested) return
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          animFrameRef.current = requestAnimationFrame(scanFrame)
        }
      } catch {
        setErrorMsg('Camera access denied. Please enable camera access in your device settings and try again.')
        setStatus('error')
      }
    }
    startCamera()
    return stopCamera
  }, [scanFrame, stopCamera, cameraRequested])

  function restart() {
    processingRef.current = false
    setStatus('scanning')
    setErrorMsg(null)
    setSuccessInfo(null)
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
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
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {status === 'scanning' && !cameraRequested && (
        <div className="w-full bg-white rounded-2xl border border-cream-200 p-6 text-center space-y-4">
          <div className="text-5xl">📷</div>
          <p className="text-coffee-800 font-semibold text-base">Camera access needed</p>
          <p className="text-coffee-500 text-sm leading-relaxed">
            We need your camera to scan the customer's reward QR code.
          </p>
          <button
            onClick={() => setCameraRequested(true)}
            className="w-full py-3 rounded-xl font-semibold text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
          >
            Grant Camera Access
          </button>
        </div>
      )}

      {status === 'scanning' && cameraRequested && (
        <>
          <div className="text-center">
            <p className="text-coffee-700 font-semibold text-sm">Scan Customer Reward QR</p>
            <p className="text-coffee-400 text-xs mt-0.5">
              Ask the customer to open their app and tap Redeem
            </p>
          </div>
          <div className="relative w-full max-w-xs aspect-square rounded-2xl overflow-hidden border border-cream-200 bg-black">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-caramel rounded-tl-lg" />
              <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-caramel rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-caramel rounded-bl-lg" />
              <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-caramel rounded-br-lg" />
            </div>
          </div>
          <p className="text-coffee-400 text-xs text-center px-4">
            Point your camera at the QR code on the customer's screen
          </p>
        </>
      )}

      {status === 'processing' && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
          <p className="text-coffee-600 text-sm font-semibold">Confirming reward…</p>
        </div>
      )}

      {status === 'success' && successInfo && (
        <div className="w-full bg-white rounded-2xl border border-green-200 p-6 text-center space-y-3">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <span className="text-3xl">🎉</span>
          </div>
          <p className="text-coffee-800 font-bold text-lg">Reward Confirmed!</p>
          <p className="text-coffee-700 text-sm font-medium">{successInfo.reward}</p>
          <p className="text-coffee-400 text-xs">{successInfo.punches} stamps redeemed</p>
          <button
            onClick={restart}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-coffee-700 border border-cream-200 bg-cream-50 mt-2"
          >
            Scan another
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="w-full bg-red-50 rounded-2xl border border-red-200 p-5 text-center space-y-3">
          <p className="text-red-600 text-sm font-semibold">Could not confirm</p>
          <p className="text-red-500 text-xs leading-relaxed">{errorMsg}</p>
          <button
            onClick={restart}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}

export default function PortalScanner({ shop, userId: _userId }: Props) {
  const [mode, setMode] = useState<'stamp' | 'redeem'>('stamp')

  return (
    <div className="max-w-sm mx-auto py-4 space-y-4">
      <div className="flex rounded-xl bg-cream-100 p-1 border border-cream-200">
        <button
          onClick={() => setMode('stamp')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === 'stamp' ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'
          }`}
        >
          ☕ Stamp QR
        </button>
        <button
          onClick={() => setMode('redeem')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === 'redeem' ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'
          }`}
        >
          🎁 Scan Reward
        </button>
      </div>

      {mode === 'stamp' && <ShopQRDisplay shopId={shop.id} />}
      {mode === 'redeem' && <RedemptionScanner shop={shop} />}
    </div>
  )
}
