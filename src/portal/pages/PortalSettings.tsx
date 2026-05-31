import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import type { PortalRole } from '../PortalApp'

interface ShopOwner {
  id: string
  profile_id: string
  shop_id: string
  notification_prefs: any
}

interface Props {
  shopOwner: ShopOwner | null
  userId: string
  portalRole: PortalRole
  onUpdate: (owner: ShopOwner) => void
}

export default function PortalSettings({ shopOwner, userId, onUpdate }: Props) {
  const prefs = shopOwner?.notification_prefs || {}
  const [emailDigest, setEmailDigest] = useState(prefs.email_digest !== false)
  const [newReviews, setNewReviews] = useState(prefs.new_reviews !== false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [isPortalOnly, setIsPortalOnly] = useState<boolean | null>(null)
  const [username, setUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [joiningApp, setJoiningApp] = useState(false)
  const [joinedSuccess, setJoinedSuccess] = useState(false)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('is_portal_only')
      .eq('id', userId)
      .single()
      .then(({ data }) => setIsPortalOnly(data?.is_portal_only ?? false))
  }, [userId])

  async function handleSave() {
    if (!shopOwner) return
    setSaving(true)
    setSaved(false)
    const newPrefs = { ...prefs, email_digest: emailDigest, new_reviews: newReviews }
    await supabase
      .from('shop_owners')
      .update({ notification_prefs: newPrefs })
      .eq('id', shopOwner.id)
    onUpdate({ ...shopOwner, notification_prefs: newPrefs })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleJoinApp() {
    const trimmed = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (!trimmed) { setUsernameError('Enter a username'); return }
    if (trimmed.length < 3) { setUsernameError('At least 3 characters'); return }
    setUsernameError('')
    setJoiningApp(true)

    // Check uniqueness
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', trimmed)
      .maybeSingle()

    if (existing) {
      setUsernameError('That username is taken')
      setJoiningApp(false)
      return
    }

    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed, is_portal_only: false })
      .eq('id', userId)

    if (error) {
      setUsernameError('Something went wrong, try again')
      setJoiningApp(false)
      return
    }

    setJoiningApp(false)
    setJoinedSuccess(true)
    setIsPortalOnly(false)
  }

  return (
    <div className="max-w-sm mx-auto space-y-5">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>

      {/* Join Social Brew as a consumer — portal-only accounts */}
      {isPortalOnly && !joinedSuccess && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-2xl">☕</span>
            <div>
              <p className="text-sm font-semibold text-coffee-900">Join Social Brew as a customer</p>
              <p className="text-xs text-coffee-500 mt-0.5 leading-relaxed">
                Pick a username to unlock the full app — discover coffee shops, rate brews, and earn punch card rewards.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 rounded-xl border border-amber-300 bg-white text-sm outline-none focus:ring-2 focus:ring-caramel/30 placeholder:text-gray-400"
                placeholder="username"
                value={username}
                onChange={e => { setUsername(e.target.value); setUsernameError('') }}
                maxLength={30}
              />
              <button
                onClick={handleJoinApp}
                disabled={joiningApp}
                className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex-shrink-0"
                style={{ background: '#c8853a' }}
              >
                {joiningApp ? '...' : 'Set username'}
              </button>
            </div>
            {usernameError && <p className="text-xs text-red-500">{usernameError}</p>}
          </div>
        </div>
      )}

      {joinedSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-sm font-semibold text-green-800">You can now use Social Brew to discover coffee shops!</p>
          <p className="text-xs text-green-600 mt-1">Head to the app to start rating and earning rewards.</p>
        </div>
      )}

      {/* Notification settings — owners only */}
      {shopOwner && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <p className="text-sm font-semibold text-gray-700">Notifications</p>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm text-gray-800">Weekly email digest</p>
              <p className="text-xs text-gray-400 mt-0.5">Summary of reviews, followers, and activity</p>
            </div>
            <div
              onClick={() => setEmailDigest(v => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${emailDigest ? 'bg-caramel' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${emailDigest ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm text-gray-800">New review alerts</p>
              <p className="text-xs text-gray-400 mt-0.5">Get notified when someone rates your shop</p>
            </div>
            <div
              onClick={() => setNewReviews(v => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${newReviews ? 'bg-caramel' : 'bg-gray-200'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${newReviews ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
          </label>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
            style={{ background: '#c8853a' }}
          >
            {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save settings'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <p className="text-sm font-semibold text-gray-700 mb-3">Account</p>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.reload() }}
          className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
