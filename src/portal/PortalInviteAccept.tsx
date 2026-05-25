import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function PortalInviteAccept() {
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const [loading, setLoading] = useState(true)
  const [claim, setClaim] = useState<any>(null)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!token) { setError('Invalid or missing invite link.'); setLoading(false); return }
    supabase
      .from('shop_claims')
      .select('id,shop_id,claimant_name,claimant_email,status,invite_expires_at,coffee_shops(name)')
      .eq('invite_token', token)
      .eq('status', 'invited')
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) { setError('This invite link is invalid or has already been used.'); setLoading(false); return }
        if (data.invite_expires_at && new Date(data.invite_expires_at) < new Date()) {
          setError('This invite link has expired. Please contact Social Brew support.')
          setLoading(false)
          return
        }
        setClaim(data)
        setLoading(false)
      })
  }, [token])

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setError('')
    setSubmitting(true)

    // Sign up (or sign in if account already exists)
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: claim.claimant_email,
      password,
    })

    // If user already exists, try sign in instead
    let userId = signUpData?.user?.id
    if (signUpErr?.message?.includes('already registered')) {
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: claim.claimant_email,
        password,
      })
      if (signInErr || !signInData?.user) {
        setError('An account already exists with this email. Please sign in instead.')
        setSubmitting(false)
        return
      }
      userId = signInData.user.id
    } else if (signUpErr || !userId) {
      setError(signUpErr?.message || 'Account setup failed. Please try again.')
      setSubmitting(false)
      return
    }

    // Create shop_owners record
    await supabase.from('shop_owners').upsert({
      profile_id: userId,
      shop_id: claim.shop_id,
    }, { onConflict: 'profile_id,shop_id' })

    // Update claim status to accepted
    await supabase.from('shop_claims').update({ status: 'accepted' }).eq('id', claim.id)

    // Update coffee_shops claimed_by
    await supabase.from('coffee_shops').update({ claimed_by: userId, claimed_at: new Date().toISOString() }).eq('id', claim.shop_id)

    // Ensure profile exists with business role
    await supabase.from('profiles').upsert({
      id: userId,
      username: claim.claimant_email.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase().slice(0, 20) + Math.floor(Math.random() * 900 + 100),
      role: 'business',
    }, { onConflict: 'id' })

    setSubmitting(false)
    setDone(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-5">
        <div className="w-full max-w-sm text-center">
          <p className="text-5xl mb-4">🎉</p>
          <h1 className="font-display font-bold text-coffee-900 text-2xl mb-2">You're all set!</h1>
          <p className="text-coffee-500 text-sm leading-relaxed mb-6">
            Welcome to Social Brew. Your shop portal is ready.
          </p>
          <a
            href="/portal"
            className="block w-full py-3.5 rounded-2xl text-white font-semibold text-sm text-center"
            style={{ background: '#c8853a' }}
          >
            Go to my portal ☕
          </a>
        </div>
      </div>
    )
  }

  if (error && !claim) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-5">
        <div className="w-full max-w-sm text-center">
          <p className="text-4xl mb-3">😕</p>
          <p className="text-coffee-800 font-semibold text-base mb-1">{error}</p>
          <a href="/" className="text-caramel text-sm underline">Back to Social Brew</a>
        </div>
      </div>
    )
  }

  const shopName = (claim?.coffee_shops as any)?.name || 'your shop'

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-5xl mb-3">☕</p>
          <h1 className="font-display font-bold text-coffee-900 text-2xl">Set up your portal</h1>
          <p className="text-coffee-500 text-sm mt-1">
            You've been invited to manage <span className="font-semibold text-coffee-700">{shopName}</span>.
          </p>
        </div>

        <form onSubmit={handleSetup} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-coffee-600 mb-1">Email</label>
            <div className="w-full bg-cream-100 text-coffee-500 rounded-xl px-4 py-3 text-sm border border-cream-200">
              {claim?.claimant_email}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-coffee-600 mb-1">Set a password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-coffee-600 mb-1">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
              placeholder="Re-enter password"
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p className="text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={submitting || !password || !confirm}
            className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm disabled:opacity-40 mt-2"
            style={{ background: '#c8853a' }}
          >
            {submitting ? 'Setting up...' : 'Create account & enter portal ☕'}
          </button>
        </form>
      </div>
    </div>
  )
}
