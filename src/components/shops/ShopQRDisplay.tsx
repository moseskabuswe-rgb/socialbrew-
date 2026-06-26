import { useEffect, useState, useCallback, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pifpkfuulfnweeiqufbq.supabase.co'
const RETRY_DELAYS = [5_000, 15_000, 30_000] // backoff steps in ms

interface Props {
  shopId: string
}

export default function ShopQRDisplay({ shopId }: Props) {
  const [token, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(180)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState(false)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchToken = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/generate-punch-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ shop_id: shopId }),
        }
      )
      const text = await res.text()
      const data = text ? JSON.parse(text) : {}
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`)
      setToken(data.token)
      setExpiresAt(new Date(data.expires_at))
      setSecondsLeft(180)
      setReconnecting(false)
      retryCountRef.current = 0
    } catch (err: any) {
      const hasStaleToken = !!token
      const retryIndex = retryCountRef.current
      if (hasStaleToken && retryIndex < RETRY_DELAYS.length) {
        // Keep showing the stale QR; retry silently with backoff
        setReconnecting(true)
        retryTimerRef.current = setTimeout(() => {
          retryCountRef.current += 1
          fetchToken()
        }, RETRY_DELAYS[retryIndex])
      } else {
        // No fallback token, or exhausted retries — show error
        setReconnecting(false)
        setError(err.message || 'Could not generate QR code. Please try again.')
      }
    }
    setLoading(false)
  }, [shopId, token])

  useEffect(() => {
    fetchToken()
    const interval = setInterval(() => {
      retryCountRef.current = 0
      fetchToken()
    }, 2.5 * 60 * 1000)
    return () => {
      clearInterval(interval)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [fetchToken])

  useEffect(() => {
    if (!expiresAt) return
    const tick = setInterval(() => {
      const secs = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
      setSecondsLeft(secs)
    }, 1000)
    return () => clearInterval(tick)
  }, [expiresAt])

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const isUrgent = secondsLeft < 30

  if (loading && !token) return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
      <p className="text-coffee-400 text-sm">Generating QR code...</p>
    </div>
  )

  if (error && !token) return (
    <div className="text-center py-8 px-4">
      <p className="text-red-500 text-sm mb-3">{error}</p>
      <button
        onClick={() => { retryCountRef.current = 0; fetchToken() }}
        className="px-5 py-2.5 rounded-full text-white text-sm font-semibold"
        style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
      >
        Try Again
      </button>
    </div>
  )

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="text-center">
        <p className="text-coffee-700 font-semibold text-sm">Customer Stamp QR</p>
        <p className="text-coffee-400 text-xs mt-0.5">Customers scan this with Social Brew to earn a stamp</p>
      </div>

      {token && (
        <div className="relative bg-white rounded-2xl p-5 border border-cream-200 shadow-sm">
          <QRCodeSVG
            value={`sbpunch:${token}`}
            size={200}
            level="M"
            includeMargin
          />
          {reconnecting && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80">
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
                <p className="text-coffee-500 text-xs font-medium">Reconnecting…</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
        isUrgent ? 'bg-red-50 border-red-200' : 'bg-cream-100 border-cream-200'
      }`}>
        <div className={`w-2 h-2 rounded-full animate-pulse ${isUrgent ? 'bg-red-500' : 'bg-green-500'}`} />
        <p className={`text-xs font-semibold ${isUrgent ? 'text-red-600' : 'text-coffee-600'}`}>
          {isUrgent ? 'Refreshing soon — ' : 'Refreshes in '}
          {mins}:{secs.toString().padStart(2, '0')}
        </p>
      </div>

      <p className="text-coffee-400 text-xs text-center px-6">
        This code is single-use and rotates every 3 minutes — screenshots won't work
      </p>
    </div>
  )
}
