import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Coffee, Search } from 'lucide-react'
import PortalTermsPage from './pages/PortalTermsPage'
import PortalPrivacyPage from './pages/PortalPrivacyPage'

interface Props {
  onSuccess: () => void
}

type Mode = 'signin' | 'request'
type RequestStep = 'search' | 'claim' | 'new_shop' | 'done'

const ROLES = ['Owner', 'Co-owner', 'Manager', 'Marketing & Social Media', 'Other']

interface ShopResult {
  id: string
  name: string
  city: string | null
  state: string | null
  is_verified: boolean
}

export default function PortalLogin({ onSuccess }: Props) {
  const claimParam = new URLSearchParams(window.location.search).get('claim')
  const [mode, setMode] = useState<Mode>(claimParam === '1' ? 'request' : 'signin')

  // Sign-in
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signInLoading, setSignInLoading] = useState(false)
  const [signInError, setSignInError] = useState('')

  // Request access
  const [step, setStep] = useState<RequestStep>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ShopResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedShop, setSelectedShop] = useState<ShopResult | null>(null)

  // Contact fields (shared across claim + new_shop steps)
  const [claimName, setClaimName] = useState('')
  const [claimEmail, setClaimEmail] = useState('')
  const [claimRole, setClaimRole] = useState('')
  const [claimMessage, setClaimMessage] = useState('')
  const [claimAgreed, setClaimAgreed] = useState(false)

  // New shop fields
  const [shopName, setShopName] = useState('')
  const [shopCity, setShopCity] = useState('')
  const [shopState, setShopState] = useState('')
  const [shopAddress, setShopAddress] = useState('')
  const [shopWebsite, setShopWebsite] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [legalView, setLegalView] = useState<'none' | 'terms' | 'privacy'>('none')

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setSignInError('')
    setSignInLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setSignInLoading(false)
    if (error) {
      setSignInError(error.message || 'Invalid email or password.')
    } else {
      onSuccess()
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    const { data } = await supabase
      .from('coffee_shops')
      .select('id,name,city,state,is_verified')
      .ilike('name', `%${searchQuery.trim()}%`)
      .eq('is_active', true)
      .order('total_ratings', { ascending: false })
      .limit(10)
    setSearchResults((data as ShopResult[]) || [])
    setSearching(false)
  }

  function selectShop(shop: ShopResult) {
    setSelectedShop(shop)
    setFormError('')
    setStep('claim')
  }

  function goToNewShop() {
    setShopName(searchQuery)
    setFormError('')
    setStep('new_shop')
  }

  function validateContact() {
    if (!claimName.trim()) return 'Your name is required'
    if (!claimEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claimEmail)) return 'A valid email is required'
    if (!claimRole) return 'Please select your role at this shop'
    if (!claimAgreed) return 'You must confirm you are authorized'
    return null
  }

  async function insertClaim(shopId: string) {
    const { error } = await supabase.from('shop_claims').insert({
      shop_id: shopId,
      user_id: null,
      claimant_name: claimName.trim(),
      claimant_email: claimEmail.trim(),
      claimant_role: claimRole,
      message: claimMessage.trim() || null,
      status: 'pending',
    })
    return error
  }

  async function handleClaimSubmit() {
    const err = validateContact()
    if (err) { setFormError(err); return }
    if (!selectedShop) return
    setSubmitting(true)
    setFormError('')

    // Check for existing pending claim from this email for this shop
    const { data: existing } = await supabase
      .from('shop_claims')
      .select('id')
      .eq('shop_id', selectedShop.id)
      .eq('claimant_email', claimEmail.trim())
      .in('status', ['pending', 'invited'])
      .maybeSingle()

    if (existing) {
      setFormError('You already have a pending request for this shop.')
      setSubmitting(false)
      return
    }

    const claimErr = await insertClaim(selectedShop.id)
    setSubmitting(false)
    if (claimErr) {
      setFormError('Something went wrong. Please try again.')
    } else {
      setStep('done')
    }
  }

  async function handleNewShopSubmit() {
    if (!shopName.trim() || !shopCity.trim()) { setFormError('Shop name and city are required'); return }
    const err = validateContact()
    if (err) { setFormError(err); return }

    setSubmitting(true)
    setFormError('')

    // Do NOT create the shop yet — just submit a claim request with the shop details.
    // Admin will review and create the shop when they approve.
    const { error: claimErr } = await supabase.from('shop_claims').insert({
      shop_id: null,
      user_id: null,
      claimant_name: claimName.trim(),
      claimant_email: claimEmail.trim(),
      claimant_role: claimRole,
      message: claimMessage.trim() || null,
      status: 'pending',
      new_shop_data: {
        name: shopName.trim(),
        city: shopCity.trim(),
        state: shopState.trim() || null,
        address: shopAddress.trim() || null,
        website: shopWebsite.trim() || null,
      },
    })

    setSubmitting(false)
    if (claimErr) {
      setFormError('Something went wrong. Please try again.')
    } else {
      setStep('done')
    }
  }

  function resetRequest() {
    setStep('search')
    setSearchQuery('')
    setSearchResults([])
    setSelectedShop(null)
    setClaimName(''); setClaimEmail(''); setClaimRole(''); setClaimMessage(''); setClaimAgreed(false)
    setShopName(''); setShopCity(''); setShopState(''); setShopAddress(''); setShopWebsite('')
    setFormError('')
  }

  if (legalView === 'terms') return <PortalTermsPage onBack={() => setLegalView('none')} />
  if (legalView === 'privacy') return <PortalPrivacyPage onBack={() => setLegalView('none')} />

  // ── Sign in ────────────────────────────────────────────────────────────────
  if (mode === 'signin') {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-5">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <p className="text-5xl mb-3">☕</p>
            <h1 className="font-display font-bold text-coffee-900 text-2xl">Shop Owner Portal</h1>
            <p className="text-coffee-400 text-sm mt-1">Sign in with your owner account</p>
          </div>

          <form onSubmit={handleSignIn} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-coffee-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-coffee-600 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {signInError && (
              <p className="text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">{signInError}</p>
            )}
            <button
              type="submit"
              disabled={signInLoading || !email.trim() || !password}
              className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm disabled:opacity-40 mt-2"
              style={{ background: '#c8853a' }}
            >
              {signInLoading ? 'Signing in...' : 'Sign in ☕'}
            </button>
          </form>

          <div className="mt-6 text-center space-y-1">
            <p className="text-xs text-coffee-400">Don't have a portal account yet?</p>
            <button
              onClick={() => { resetRequest(); setMode('request') }}
              className="text-sm text-caramel font-semibold underline underline-offset-2"
            >
              Request portal access →
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-cream-200 flex items-center justify-center gap-4">
            <button onClick={() => setLegalView('privacy')} className="text-xs text-coffee-400 hover:text-caramel transition-colors">Privacy Policy</button>
            <span className="text-coffee-200 text-xs">·</span>
            <button onClick={() => setLegalView('terms')} className="text-xs text-coffee-400 hover:text-caramel transition-colors">Terms of Service</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center px-5">
        <div className="w-full max-w-sm text-center">
          <p className="text-5xl mb-4">🎉</p>
          <h1 className="font-display font-bold text-coffee-900 text-2xl mb-2">Request submitted!</h1>
          <p className="text-coffee-500 text-sm leading-relaxed">
            We'll review and reach out to
          </p>
          <p className="text-coffee-700 font-semibold text-sm mt-0.5 mb-1">{claimEmail}</p>
          <p className="text-coffee-400 text-xs mb-6">within 2 business days.</p>
          <button
            onClick={() => { resetRequest(); setMode('signin') }}
            className="text-sm text-caramel underline"
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    )
  }

  // ── Request access flow ────────────────────────────────────────────────────
  const stepLabel = step === 'search' ? 'Request Portal Access'
    : step === 'claim' ? 'Claim Your Shop'
    : 'Add Your Shop'

  function handleBack() {
    if (step === 'search') { resetRequest(); setMode('signin'); return }
    setStep('search')
    setSelectedShop(null)
    setFormError('')
  }

  return (
    <div className="min-h-screen bg-cream-50 flex items-start justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleBack}
            className="w-8 h-8 rounded-full bg-cream-200 flex items-center justify-center text-coffee-500 flex-shrink-0"
          >
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 className="font-display font-bold text-coffee-900 text-xl">{stepLabel}</h1>
            {step === 'search' && (
              <p className="text-coffee-400 text-xs mt-0.5">Find your shop to get started</p>
            )}
            {step === 'claim' && selectedShop && (
              <p className="text-coffee-400 text-xs mt-0.5 truncate">{selectedShop.name}</p>
            )}
          </div>
        </div>

        {/* Search step */}
        {step === 'search' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 flex items-center bg-white rounded-xl border border-cream-200 focus-within:border-caramel px-3 gap-2">
                <Search size={14} className="text-coffee-400 flex-shrink-0" />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by shop name..."
                  className="flex-1 bg-transparent text-coffee-800 text-sm py-3 focus:outline-none placeholder-coffee-300"
                  autoFocus
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={!searchQuery.trim() || searching}
                className="px-4 rounded-xl text-white text-sm font-semibold disabled:opacity-40 flex-shrink-0"
                style={{ background: '#c8853a' }}
              >
                {searching ? '...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-1.5">
                {searchResults.map(shop => (
                  <button
                    key={shop.id}
                    onClick={() => selectShop(shop)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-cream-200 hover:border-caramel text-left transition-colors"
                  >
                    <Coffee size={15} className="text-caramel flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-coffee-800 text-sm font-medium truncate">{shop.name}</p>
                      {(shop.city || shop.state) && (
                        <p className="text-coffee-400 text-xs">{[shop.city, shop.state].filter(Boolean).join(', ')}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchResults.length === 0 && searchQuery.trim() && !searching && (
              <p className="text-center text-coffee-400 text-sm py-2">No results for "{searchQuery}"</p>
            )}

            <button
              onClick={goToNewShop}
              className="w-full py-3 rounded-xl border border-dashed border-cream-300 text-coffee-500 text-sm font-medium hover:bg-cream-100 transition-colors"
            >
              My shop isn't listed — add it
            </button>
          </div>
        )}

        {/* Claim existing shop */}
        {step === 'claim' && selectedShop && (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 rounded-xl border border-amber-100">
              <Coffee size={16} className="text-caramel flex-shrink-0" />
              <div>
                <p className="text-coffee-800 text-sm font-semibold">{selectedShop.name}</p>
                {(selectedShop.city || selectedShop.state) && (
                  <p className="text-coffee-400 text-xs">{[selectedShop.city, selectedShop.state].filter(Boolean).join(', ')}</p>
                )}
              </div>
            </div>

            <ContactFields
              name={claimName} onName={setClaimName}
              email={claimEmail} onEmail={setClaimEmail}
              role={claimRole} onRole={setClaimRole}
              message={claimMessage} onMessage={setClaimMessage}
              agreed={claimAgreed} onAgreed={setClaimAgreed}
            />

            {formError && <p className="text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">{formError}</p>}

            <button
              onClick={handleClaimSubmit}
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm disabled:opacity-40"
              style={{ background: '#c8853a' }}
            >
              {submitting ? 'Submitting...' : 'Submit claim ☕'}
            </button>
          </div>
        )}

        {/* Add new shop */}
        {step === 'new_shop' && (
          <div className="space-y-3 max-h-[80vh] overflow-y-auto pb-4">
            <p className="text-coffee-400 text-xs">
              We'll add your shop and review both the listing and your ownership claim together.
            </p>

            <div>
              <label className="block text-xs font-medium text-coffee-600 mb-1">Shop Name <span className="text-red-400">*</span></label>
              <input
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
                placeholder="e.g. Methodical Coffee"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-coffee-600 mb-1">City <span className="text-red-400">*</span></label>
              <input
                value={shopCity}
                onChange={e => setShopCity(e.target.value)}
                className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
                placeholder="e.g. Greenville"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-coffee-600 mb-1">State / Region</label>
              <input
                value={shopState}
                onChange={e => setShopState(e.target.value)}
                className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
                placeholder="e.g. SC"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-coffee-600 mb-1">Address</label>
              <input
                value={shopAddress}
                onChange={e => setShopAddress(e.target.value)}
                className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
                placeholder="e.g. 101 N Main St"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-coffee-600 mb-1">Website</label>
              <input
                value={shopWebsite}
                onChange={e => setShopWebsite(e.target.value)}
                type="url"
                placeholder="https://..."
                className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
              />
            </div>

            <div className="pt-2 border-t border-cream-200">
              <p className="text-xs font-semibold text-coffee-600 mb-2">Your contact details</p>
              <ContactFields
                name={claimName} onName={setClaimName}
                email={claimEmail} onEmail={setClaimEmail}
                role={claimRole} onRole={setClaimRole}
                message={claimMessage} onMessage={setClaimMessage}
                agreed={claimAgreed} onAgreed={setClaimAgreed}
              />
            </div>

            {formError && <p className="text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">{formError}</p>}

            <button
              onClick={handleNewShopSubmit}
              disabled={submitting}
              className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm disabled:opacity-40"
              style={{ background: '#c8853a' }}
            >
              {submitting ? 'Submitting...' : 'Submit shop & claim ☕'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ContactFields({
  name, onName, email, onEmail, role, onRole, message, onMessage, agreed, onAgreed,
}: {
  name: string; onName: (v: string) => void
  email: string; onEmail: (v: string) => void
  role: string; onRole: (v: string) => void
  message: string; onMessage: (v: string) => void
  agreed: boolean; onAgreed: (v: boolean) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-coffee-600 mb-1">Your name</label>
        <input
          value={name}
          onChange={e => onName(e.target.value)}
          placeholder="Full name"
          className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-coffee-600 mb-1">Your email</label>
        <input
          value={email}
          onChange={e => onEmail(e.target.value)}
          type="email"
          placeholder="you@example.com"
          className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-coffee-600 mb-1">Your role at this shop</label>
        <select
          value={role}
          onChange={e => onRole(e.target.value)}
          className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
        >
          <option value="">Select a role...</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-coffee-600 mb-1">
          Message <span className="text-coffee-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={message}
          onChange={e => onMessage(e.target.value.slice(0, 500))}
          rows={2}
          placeholder="A brief note helps us verify your claim faster..."
          className="w-full bg-white text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none resize-none"
        />
      </div>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={e => onAgreed(e.target.checked)}
          className="mt-0.5 flex-shrink-0 accent-caramel"
        />
        <span className="text-coffee-500 text-xs leading-relaxed">
          I confirm I am authorized to manage this shop's presence on Social Brew.
        </span>
      </label>
    </div>
  )
}
