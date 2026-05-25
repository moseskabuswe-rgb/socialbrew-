import { useState } from 'react'
import { supabase } from '../../lib/supabase'

interface ShopOwner {
  id: string
  profile_id: string
  shop_id: string
  notification_prefs: any
}

interface Props {
  shopOwner: ShopOwner
  onUpdate: (owner: ShopOwner) => void
}

export default function PortalSettings({ shopOwner, onUpdate }: Props) {
  const prefs = shopOwner.notification_prefs || {}
  const [emailDigest, setEmailDigest] = useState(prefs.email_digest !== false)
  const [newReviews, setNewReviews] = useState(prefs.new_reviews !== false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
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

  return (
    <div className="max-w-sm mx-auto space-y-5">
      <h1 className="text-xl font-semibold text-gray-900">Settings</h1>

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
