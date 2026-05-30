import { useState, useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../../lib/supabase'
import { X, Check, Camera } from 'lucide-react'

interface Props {
  shop: { id: string; name: string }
  userId: string
}

interface RedemptionResult {
  id: string
  shop_id: string
  user_id: string
  redeemed_at: string | null
  expires_at: string
  profiles: { username: string; full_name: string | null } | null
}

type ScanState = 'idle' | 'scanning' | 'processing' | 'valid' | 'redeemed' | 'expired' | 'invalid' | 'wrong_shop' | 'done' | 'punched' | 'punch_failed'

interface PunchResult { newCount: number; required: number; rewardEarned: boolean }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PUNCH_PREFIX = 'punch:'

export default function PortalScanner({ shop, userId }: Props) {
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [result, setResult] = useState<RedemptionResult | null>(null)
  const [punchResult, setPunchResult] = useState<PunchResult | null>(null)
  const [working, setWorking] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const processedRef = useRef(false)

  useEffect(() => {
    if (!cameraActive) return
    processedRef.current = false
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner

    scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        if (processedRef.current) return
        processedRef.current = true
        setCameraActive(false)
        await scanner.stop().catch(() => {})
        setScanState('processing')
        await processToken(decodedText.trim())
      },
      undefined
    ).catch(() => {
      setScanState('idle')
      setCameraActive(false)
    })

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(() => {})
      }
    }
  }, [cameraActive])

  async function processToken(token: string) {
    // Punch stamp QR: format is "punch:{userId}"
    if (token.startsWith(PUNCH_PREFIX)) {
      const userId = token.slice(PUNCH_PREFIX.length).trim()
      if (!UUID_RE.test(userId)) { setScanState('invalid'); return }
      const { data, error } = await supabase.rpc('award_punch', {
        p_shop_id: shop.id,
        p_user_id: userId,
      })
      if (error || !data?.awarded) {
        setScanState('punch_failed')
      } else {
        setPunchResult({ newCount: data.new_count, required: data.required, rewardEarned: data.reward_earned })
        setScanState('punched')
      }
      return
    }

    // Reward redemption QR: a bare UUID
    if (!UUID_RE.test(token)) { setScanState('invalid'); return }

    const { data } = await supabase
      .from('punch_redemptions')
      .select('id, shop_id, user_id, redeemed_at, expires_at, profiles:user_id(username, full_name)')
      .eq('qr_token', token)
      .maybeSingle()

    if (!data) { setScanState('invalid'); return }
    if (data.shop_id !== shop.id) { setScanState('wrong_shop'); return }
    if (data.redeemed_at) { setScanState('redeemed'); return }
    if (new Date(data.expires_at) < new Date()) { setScanState('expired'); return }

    setResult(data as unknown as RedemptionResult)
    setScanState('valid')
  }

  async function confirmRedemption() {
    if (!result) return
    setWorking(true)
    await supabase.from('punch_redemptions').update({
      redeemed_at: new Date().toISOString(),
      redeemed_by: userId,
    }).eq('id', result.id)
    setWorking(false)
    setScanState('done')
  }

  function reset() {
    setScanState('idle')
    setResult(null)
    setPunchResult(null)
    setCameraActive(false)
  }

  function startScan() {
    setScanState('scanning')
    setCameraActive(true)
  }

  function stopScan() {
    setCameraActive(false)
    setScanState('idle')
  }

  const displayName = result?.profiles?.full_name || result?.profiles?.username || 'Customer'

  return (
    <div className="max-w-sm mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Scan QR</h1>
        <p className="text-sm text-gray-500 mt-0.5">Scan a customer's redemption QR code</p>
      </div>

      {/* Idle */}
      {scanState === 'idle' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-caramel/10 flex items-center justify-center">
            <Camera size={32} className="text-caramel" />
          </div>
          <div className="text-center">
            <p className="font-medium text-gray-800">Ready to scan</p>
            <p className="text-xs text-gray-400 mt-1">Ask the customer to show their reward QR code</p>
          </div>
          <button
            onClick={startScan}
            className="w-full py-3 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
          >
            Open Camera
          </button>
        </div>
      )}

      {/* Camera / scanning */}
      {(scanState === 'scanning' || scanState === 'processing') && (
        <div className="space-y-3">
          <div className="relative bg-black rounded-2xl overflow-hidden" style={{ minHeight: 300 }}>
            <div id="qr-reader" className="w-full" />
            {scanState === 'processing' && (
              <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
              </div>
            )}
          </div>
          {scanState === 'scanning' && (
            <button
              onClick={stopScan}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Valid — confirm redemption */}
      {scanState === 'valid' && result && (
        <div className="bg-white rounded-2xl border border-green-200 p-5 space-y-4">
          <div className="flex items-center gap-2 text-green-600">
            <Check size={18} />
            <p className="font-semibold text-sm">Valid redemption</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-base font-bold text-gray-900">{displayName}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Expires {new Date(result.expires_at).toLocaleString()}
            </p>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Confirm to mark this reward as redeemed. This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmRedemption}
              disabled={working}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
            >
              {working ? 'Marking…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* Punch awarded */}
      {scanState === 'punched' && punchResult && (
        <div className="bg-white rounded-2xl border border-amber-200 p-8 flex flex-col items-center gap-3">
          <div className="text-5xl">☕</div>
          <p className="font-bold text-coffee-900 text-lg">Stamp added!</p>
          <p className="text-sm text-coffee-600 text-center">
            {punchResult.newCount}/{punchResult.required} stamps
          </p>
          {punchResult.rewardEarned && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-center">
              <p className="text-xs font-bold text-amber-700">🎉 Reward earned! Customer can now redeem.</p>
            </div>
          )}
          <button onClick={reset} className="mt-2 w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
            Scan another
          </button>
        </div>
      )}

      {/* Punch failed */}
      {scanState === 'punch_failed' && (
        <div className="bg-white rounded-2xl border border-red-200 p-8 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <X size={28} className="text-red-500" />
          </div>
          <p className="font-bold text-gray-900">Couldn't award stamp</p>
          <p className="text-xs text-gray-400 text-center">The stamp couldn't be awarded. The customer may have already earned their reward or there was an error.</p>
          <button onClick={reset} className="mt-2 w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
            Try again
          </button>
        </div>
      )}

      {/* Done */}
      {scanState === 'done' && (
        <div className="bg-white rounded-2xl border border-green-200 p-8 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Check size={28} className="text-green-600" />
          </div>
          <p className="font-bold text-gray-900">Reward redeemed!</p>
          <p className="text-xs text-gray-400 text-center">The customer's reward has been marked as used.</p>
          <button
            onClick={reset}
            className="mt-2 w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
          >
            Scan another
          </button>
        </div>
      )}

      {/* Error states */}
      {(scanState === 'redeemed' || scanState === 'expired' || scanState === 'invalid' || scanState === 'wrong_shop') && (
        <div className="bg-white rounded-2xl border border-red-200 p-8 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <X size={28} className="text-red-500" />
          </div>
          <p className="font-bold text-gray-900">
            {scanState === 'redeemed' && 'Already redeemed'}
            {scanState === 'expired' && 'QR code expired'}
            {scanState === 'invalid' && 'Invalid QR code'}
            {scanState === 'wrong_shop' && 'Wrong shop'}
          </p>
          <p className="text-xs text-gray-400 text-center">
            {scanState === 'redeemed' && 'This reward has already been claimed.'}
            {scanState === 'expired' && 'This QR code has passed its expiry time.'}
            {scanState === 'invalid' && 'This QR code is not a valid reward code.'}
            {scanState === 'wrong_shop' && 'This QR code belongs to a different shop.'}
          </p>
          <button
            onClick={reset}
            className="mt-2 w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
