import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import { registerPushNotifications } from '../../lib/push'

interface Props {
  userId: string
  onDismiss: () => void
  onSuccess: () => void
}

export default function PushPrompt({ userId, onDismiss, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isIOSPWA = (window.navigator as any).standalone === true

  if (isIOS && !isIOSPWA) {
    return (
      <div className="mx-4 mb-3 bg-white rounded-2xl border border-cream-200 shadow-sm p-4 animate-fade-in">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-caramel/10 rounded-full flex items-center justify-center">
              <Bell size={16} className="text-caramel" />
            </div>
            <p className="text-coffee-800 font-semibold text-sm">Get notifications</p>
          </div>
          <button onClick={onDismiss} className="text-coffee-300 p-1"><X size={16} /></button>
        </div>
        <p className="text-coffee-500 text-xs mb-3 leading-relaxed">
          To get notified when friends brew, tap <span className="font-semibold text-coffee-700">Share ⬆️</span> in Safari then <span className="font-semibold text-coffee-700">"Add to Home Screen"</span>. Takes 10 seconds.
        </p>
        <button onClick={onDismiss} className="text-coffee-400 text-xs">Maybe later</button>
      </div>
    )
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return null

  if (done) {
    return (
      <div className="mx-4 mb-3 bg-caramel rounded-2xl p-4 flex items-center gap-3 animate-fade-in">
        <span className="text-2xl">🔔</span>
        <p className="text-white font-semibold text-sm flex-1">Notifications enabled!</p>
      </div>
    )
  }

  async function handleEnable() {
    setLoading(true)
    setErrorMsg(null)
    try {
      const success = await registerPushNotifications(userId)
      if (success) {
        setDone(true)
        setTimeout(onSuccess, 1800)
      } else {
        setErrorMsg('Could not enable — tap Try again')
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div className="mx-4 mb-3 bg-white rounded-2xl border border-cream-200 shadow-sm p-4 animate-fade-in">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-caramel/10 rounded-full flex items-center justify-center">
            <Bell size={16} className="text-caramel" />
          </div>
          <p className="text-coffee-800 font-semibold text-sm">Your friends are brewing ☕</p>
        </div>
        <button onClick={onDismiss} className="text-coffee-300 p-1"><X size={16} /></button>
      </div>
      <p className="text-coffee-500 text-xs mb-3 leading-relaxed">
        Someone just liked your brew or followed you — and you didn't know. Enable notifications so you never miss it.
      </p>
      {errorMsg && (
        <p className="text-red-400 text-xs mb-2 font-medium">{errorMsg}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleEnable}
          disabled={loading}
          className="flex-1 bg-caramel text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-60"
        >
          {loading ? 'Opening...' : errorMsg ? 'Try again' : 'Enable notifications'}
        </button>
        <button onClick={onDismiss} className="px-3 text-coffee-400 text-sm">Not now</button>
      </div>
    </div>
  )
}
