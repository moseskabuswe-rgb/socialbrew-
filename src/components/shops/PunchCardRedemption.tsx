import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'
import { X } from 'lucide-react'

interface Props {
  shop: { id: string; name: string }
  punchCardId: string
  userId: string
  onClose: () => void
}

export default function PunchCardRedemption({ shop, punchCardId, userId, onClose }: Props) {
  const [token, setToken] = useState<string | null>(null)
  const [, setExpiresAt] = useState<Date | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(900)
  const [redeemed, setRedeemed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const wakeLockRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef = useRef<any>(null)
  const currentIdRef = useRef<string | null>(null)

  useEffect(() => {
    init()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (wakeLockRef.current) wakeLockRef.current.release().catch(() => {})
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  async function init() {
    setLoading(true)
    setError('')

    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
      }
    } catch {}

    const now = new Date()
    const { data: existing } = await supabase
      .from('punch_redemptions')
      .select('id, qr_token, expires_at, redeemed_at')
      .eq('user_id', userId)
      .eq('shop_id', shop.id)
      .eq('punch_card_id', punchCardId)
      .is('redeemed_at', null)
      .gt('expires_at', now.toISOString())
      .maybeSingle()

    let redemptionId: string
    let qrToken: string
    let expiry: Date

    if (existing) {
      redemptionId = existing.id
      qrToken = existing.qr_token
      expiry = new Date(existing.expires_at)
    } else {
      expiry = new Date(now.getTime() + 15 * 60 * 1000)
      const { data: created, error: createErr } = await supabase
        .from('punch_redemptions')
        .insert({
          user_id: userId,
          shop_id: shop.id,
          punch_card_id: punchCardId,
          expires_at: expiry.toISOString(),
        })
        .select('id, qr_token')
        .single()

      if (createErr || !created) {
        setError('Failed to generate QR code. Please try again.')
        setLoading(false)
        return
      }
      redemptionId = created.id
      qrToken = created.qr_token
    }

    currentIdRef.current = redemptionId
    setToken(qrToken)
    setExpiresAt(expiry)
    setLoading(false)
    startCountdown(expiry)
    subscribeToRedemption(redemptionId)
  }

  function startCountdown(expiry: Date) {
    if (timerRef.current) clearInterval(timerRef.current)
    const update = () => {
      const left = Math.max(0, Math.floor((expiry.getTime() - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0 && timerRef.current) clearInterval(timerRef.current)
    }
    update()
    timerRef.current = setInterval(update, 1000)
  }

  function subscribeToRedemption(id: string) {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const channel = supabase
      .channel(`redemption-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'punch_redemptions',
        filter: `id=eq.${id}`,
      }, (payload: any) => {
        if (payload.new?.redeemed_at) {
          setRedeemed(true)
          if (timerRef.current) clearInterval(timerRef.current)
        }
      })
      .subscribe()
    channelRef.current = channel
  }

  async function regenerate() {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    setToken(null)
    setRedeemed(false)
    await init()
  }

  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60
  const expired = !loading && !redeemed && token !== null && secondsLeft === 0

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.95)' }}>
      <div
        className="w-full max-w-sm rounded-t-3xl animate-slide-up overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #fdfaf5, #f5ead8)', maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-cream-200">
          <div>
            <h2 className="text-coffee-800 font-display text-xl font-bold">Redeem Reward</h2>
            <p className="text-coffee-400 text-xs">{shop.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-6 text-center space-y-4">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
            </div>
          )}

          {error && (
            <div className="py-8 space-y-3">
              <p className="text-red-500 text-sm">{error}</p>
              <button onClick={init} className="px-4 py-2 text-xs font-medium text-caramel border border-caramel/30 rounded-lg">
                Try again
              </button>
            </div>
          )}

          {redeemed && (
            <div className="py-8 space-y-4">
              <div className="text-6xl animate-bounce-in">🎉</div>
              <p className="font-display text-2xl font-bold text-coffee-800">Reward Claimed!</p>
              <p className="text-coffee-500 text-sm">Enjoy your reward from {shop.name}!</p>
              <button
                onClick={onClose}
                className="mt-2 w-full py-3 rounded-xl text-sm font-medium text-gray-600 border border-gray-200"
              >
                Close
              </button>
            </div>
          )}

          {expired && (
            <div className="py-8 space-y-3">
              <div className="text-4xl">⏰</div>
              <p className="font-display text-xl font-bold text-coffee-800">QR Expired</p>
              <p className="text-coffee-500 text-sm">Generate a new code to continue.</p>
              <button
                onClick={regenerate}
                className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
              >
                Generate new QR
              </button>
            </div>
          )}

          {token && !redeemed && !expired && (
            <>
              <p className="text-coffee-500 text-sm">Show this QR code to the barista to claim your reward</p>

              <div className="flex justify-center">
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-cream-200">
                  <QRCodeSVG value={token} size={200} level="M" />
                </div>
              </div>

              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${secondsLeft < 60 ? 'bg-red-50 border border-red-200' : 'bg-cream-100'}`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${secondsLeft < 60 ? 'bg-red-400' : 'bg-green-400'}`} />
                <p className={`text-sm font-mono font-bold ${secondsLeft < 60 ? 'text-red-500' : 'text-coffee-600'}`}>
                  {minutes}:{seconds.toString().padStart(2, '0')}
                </p>
              </div>

              <p className="text-coffee-400 text-xs">
                This code is valid for {minutes > 0 ? `${minutes}m ` : ''}{seconds}s
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
