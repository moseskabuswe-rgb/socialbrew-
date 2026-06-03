import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type Screen = 'loading' | 'error' | 'form' | 'signin' | 'done'

interface OwnerClaim {
  kind: 'owner'
  claimId: string
  shopId: string
  shopName: string
  email: string
  displayName: string
  initialPunchQuota: number
}

interface TeamInvite {
  kind: 'team'
  memberId: string
  shopId: string
  shopName: string
  email: string
  displayName: string
  portalRole: 'manager' | 'barista'
}

type Invite = OwnerClaim | TeamInvite

export default function PortalInviteAccept() {
  const token = new URLSearchParams(window.location.search).get('token') || ''

  const [screen, setScreen] = useState<Screen>('loading')
  const [invite, setInvite] = useState<Invite | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [alreadyHasAccount, setAlreadyHasAccount] = useState(false)

  // Form fields
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showConsumerOpt, setShowConsumerOpt] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!token) { setErrorMsg('Invalid or missing invite link.'); setScreen('error'); return }
    resolveToken()
  }, [token])

  async function resolveToken() {
    // Check owner claims first
    const { data: claim } = await supabase
      .from('shop_claims')
      .select('id,shop_id,claimant_name,claimant_email,status,invite_expires_at,initial_punch_quota,coffee_shops(name)')
      .eq('invite_token', token)
      .maybeSingle()

    if (claim) {
      if (claim.status === 'accepted') {
        setErrorMsg('This invite has already been accepted. Head to the portal to sign in.')
        setScreen('error')
        return
      }
      if (claim.status !== 'invited') {
        setErrorMsg('This invite link is invalid or has already been used.')
        setScreen('error')
        return
      }
      if (claim.invite_expires_at && new Date(claim.invite_expires_at) < new Date()) {
        setErrorMsg('This invite link has expired. Contact Social Brew support for a new one.')
        setScreen('error')
        return
      }
      setInvite({
        kind: 'owner',
        claimId: claim.id,
        shopId: claim.shop_id,
        shopName: (claim.coffee_shops as any)?.name || 'your shop',
        email: claim.claimant_email,
        displayName: claim.claimant_name || '',
        initialPunchQuota: (claim as any).initial_punch_quota ?? 0,
      })
      setFullName(claim.claimant_name || '')
      setScreen('form')
      return
    }

    // Check team invites
    const { data: member } = await supabase
      .from('shop_team_members')
      .select('id,shop_id,email,display_name,portal_role,status,invite_expires_at,coffee_shops(name)')
      .eq('invite_token', token)
      .maybeSingle()

    if (member) {
      if (member.status === 'active') {
        setErrorMsg('This invite has already been accepted. Head to the portal to sign in.')
        setScreen('error')
        return
      }
      if (member.status === 'revoked') {
        setErrorMsg('This invite has been cancelled. Contact your shop owner for a new one.')
        setScreen('error')
        return
      }
      if (member.invite_expires_at && new Date(member.invite_expires_at) < new Date()) {
        setErrorMsg('This invite link has expired. Ask your shop owner to resend it.')
        setScreen('error')
        return
      }
      setInvite({
        kind: 'team',
        memberId: member.id,
        shopId: member.shop_id,
        shopName: (member.coffee_shops as any)?.name || 'your shop',
        email: member.email,
        displayName: member.display_name,
        portalRole: member.portal_role,
      })
      setFullName(member.display_name || '')
      setScreen('form')
      return
    }

    setErrorMsg('This invite link is invalid. Please check the link in your email or contact support.')
    setScreen('error')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!invite) return
    setFormError('')

    if (!alreadyHasAccount) {
      if (!fullName.trim()) { setFormError('Please enter your name.'); return }
      if (password.length < 8) { setFormError('Password must be at least 8 characters.'); return }
      if (password !== confirm) { setFormError('Passwords do not match.'); return }
      if (username && !/^[a-z0-9_.]{3,20}$/.test(username)) {
        setFormError('Username must be 3–20 characters: letters, numbers, _ or .')
        return
      }
    } else {
      if (!password) { setFormError('Please enter your existing password.'); return }
    }

    setSubmitting(true)

    if (alreadyHasAccount) {
      await handleExistingAccount()
    } else {
      await handleNewAccount()
    }

    setSubmitting(false)
  }

  async function handleExistingAccount() {
    if (!invite) return
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email: invite.email,
      password,
    })
    if (signInErr || !signInData?.user) {
      setFormError('Incorrect password. Please try again.')
      return
    }
    const userId = signInData.user.id
    await finaliseInvite(userId, invite)
  }

  async function handleNewAccount() {
    if (!invite) return

    const portalOnly = !username.trim()
    const isOwner = invite.kind === 'owner'

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          username: username.trim() || undefined,
          is_portal_only: portalOnly,
          role: isOwner ? 'business' : 'consumer',
          portal_role: isOwner ? 'owner' : invite.kind === 'team' ? (invite as TeamInvite).portalRole : undefined,
          shop_id: isOwner ? invite.shopId : undefined,
          team_shop_id: !isOwner ? invite.shopId : undefined,
        },
      },
    })

    if (signUpErr?.message?.toLowerCase().includes('already registered')) {
      // Race condition — account appeared between probe and signup; fall back to sign-in path
      setAlreadyHasAccount(true)
      setFormError('An account already exists with this email. Please enter your password.')
      return
    }
    if (signUpErr || !signUpData?.user) {
      setFormError(signUpErr?.message || 'Account setup failed. Please try again.')
      return
    }

    let userId = signUpData.user.id

    // If email confirmation is enabled, signUp returns no session — sign in explicitly
    if (!signUpData.session) {
      const { data: siData, error: siErr } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password,
      })
      if (siErr || !siData?.user) {
        setFormError('Account created but sign-in failed. Please sign in at /portal.')
        return
      }
      userId = siData.user.id
    }

    await finaliseInvite(userId, invite)
  }

  async function finaliseInvite(userId: string, inv: Invite) {
    if (inv.kind === 'owner') {
      const shopOwnerPayload: Record<string, unknown> = { profile_id: userId, shop_id: inv.shopId }
      if (inv.initialPunchQuota > 0) shopOwnerPayload.punch_card_quota = inv.initialPunchQuota
      await Promise.all([
        supabase.from('profiles').update({ role: 'business', portal_role: 'owner', shop_id: inv.shopId }).eq('id', userId),
        supabase.from('shop_owners').upsert(shopOwnerPayload, { onConflict: 'profile_id,shop_id' }),
        supabase.from('shop_claims').update({ status: 'accepted' }).eq('id', inv.claimId),
        supabase.from('coffee_shops').update({ claimed_by: userId, claimed_at: new Date().toISOString() }).eq('id', inv.shopId),
      ])
    } else {
      await Promise.all([
        supabase.from('profiles').update({ team_shop_id: inv.shopId, portal_role: inv.portalRole }).eq('id', userId),
        supabase.from('shop_team_members').update({ profile_id: userId, status: 'active' }).eq('id', inv.memberId),
      ])
    }
    setScreen('done')
  }

  // ── Screens ──────────────────────────────────────────────────────

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50">
        <div className="w-8 h-8 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
      </div>
    )
  }

  if (screen === 'error') {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-5">
        <div className="w-full max-w-sm text-center">
          <p className="text-4xl mb-3">😕</p>
          <p className="text-coffee-800 font-semibold text-base mb-2">{errorMsg}</p>
          {errorMsg.includes('already been accepted') && (
            <a href="/portal" className="block mt-3 text-sm text-caramel underline">Go to portal →</a>
          )}
          <a href="/" className="block mt-2 text-caramel text-sm underline">Back to Social Brew</a>
        </div>
      </div>
    )
  }

  if (screen === 'done') {
    const isOwner = invite?.kind === 'owner'
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-5">
        <div className="w-full max-w-sm text-center">
          <p className="text-5xl mb-4">🎉</p>
          <h1 className="font-display font-bold text-coffee-900 text-2xl mb-2">You're all set!</h1>
          <p className="text-coffee-500 text-sm leading-relaxed mb-6">
            {isOwner
              ? `Welcome to Social Brew. Your portal for ${invite?.shopName} is ready.`
              : `You've joined ${invite?.shopName}. Your portal access is ready.`}
          </p>
          <a href="/portal" className="block w-full py-3.5 rounded-2xl text-white font-semibold text-sm text-center" style={{ background: '#c8853a' }}>
            Go to my portal ☕
          </a>
        </div>
      </div>
    )
  }

  // ── Form screen ───────────────────────────────────────────────────
  if (!invite) return null

  const isOwner = invite.kind === 'owner'
  const isTeam = invite.kind === 'team'
  const roleLabel = isTeam ? (invite as TeamInvite).portalRole : 'owner'

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-cream-200 mx-auto mb-4">
            <img src="/icon-192.png" alt="Social Brew" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-display font-bold text-coffee-900 text-2xl">
            {isOwner ? 'Set up your portal' : 'Join your team'}
          </h1>
          <p className="text-coffee-500 text-sm mt-1.5 leading-relaxed">
            {isOwner
              ? <>You've been invited to manage <strong className="text-coffee-700">{invite.shopName}</strong>.</>
              : <>You've been invited as a <strong className="text-coffee-700">{roleLabel}</strong> at <strong className="text-coffee-700">{invite.shopName}</strong>.</>}
          </p>
          {alreadyHasAccount && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-left">
              {isOwner
                ? 'We found an existing Social Brew account with this email. Sign in below to link your shop.'
                : 'We found an existing Social Brew account with this email. Sign in below — your personal account is unchanged.'}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Email — always read-only */}
          <div>
            <label className="block text-xs font-medium text-coffee-600 mb-1">Email</label>
            <div className="w-full bg-cream-100 text-coffee-500 rounded-xl px-4 py-3 text-sm border border-cream-200">
              {invite.email}
            </div>
          </div>

          {/* Name — only for new accounts */}
          {!alreadyHasAccount && (
            <div>
              <label className="block text-xs font-medium text-coffee-600 mb-1">
                {isTeam ? 'Your name (shown to your team)' : 'Your name'}
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
                placeholder="e.g. Sarah"
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-coffee-600 mb-1">
              {alreadyHasAccount ? 'Your Social Brew password' : 'Set a password'}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
              placeholder={alreadyHasAccount ? 'Enter your password' : 'At least 8 characters'}
              autoComplete={alreadyHasAccount ? 'current-password' : 'new-password'}
            />
          </div>

          {!alreadyHasAccount && (
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
          )}

          {/* Optional: consumer username (new accounts only) */}
          {!alreadyHasAccount && (
            <div className="border border-cream-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowConsumerOpt(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-coffee-600 hover:bg-cream-50 transition-colors"
              >
                <span className="font-medium">Want to use Social Brew as a customer too?</span>
                <span className="text-coffee-400 text-xs">{showConsumerOpt ? '▲' : '▼'}</span>
              </button>
              {showConsumerOpt && (
                <div className="px-4 pb-4 space-y-2">
                  <p className="text-xs text-coffee-400 leading-relaxed">
                    Choose a username to appear in the app and discover coffee shops with your friends. You can skip this and set it later in Settings.
                  </p>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 20))}
                    className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
                    placeholder="username (optional)"
                    autoComplete="username"
                  />
                </div>
              )}
            </div>
          )}

          {formError && (
            <p className="text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">{formError}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm disabled:opacity-40 mt-2"
            style={{ background: '#c8853a' }}
          >
            {submitting
              ? 'Setting up…'
              : alreadyHasAccount
                ? 'Sign in & link portal ☕'
                : 'Create account & enter portal ☕'}
          </button>
        </form>
      </div>
    </div>
  )
}
