import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Props {
  shop: { id: string; name: string }
  onClose: () => void
}

const ROLES = ['Owner', 'Co-owner', 'Manager', 'Marketing & Social Media', 'Other']

export default function ClaimShopModal({ shop, onClose }: Props) {
  const { profile } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [message, setMessage] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [existingClaim, setExistingClaim] = useState<string | null>(null)
  const [loadingCheck, setLoadingCheck] = useState(true)

  useEffect(() => {
    async function prefill() {
      if (profile?.full_name) setName(profile.full_name)
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        setEmail(user.email)
        // Check for existing pending/invited claim from this email for this shop
        const { data } = await supabase
          .from('shop_claims')
          .select('claimant_email')
          .eq('shop_id', shop.id)
          .eq('claimant_email', user.email)
          .in('status', ['pending', 'invited'])
          .maybeSingle()
        if (data) setExistingClaim(data.claimant_email)
      }
      setLoadingCheck(false)
    }
    prefill()
  }, [profile, shop.id])

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Your name is required'
    if (!email.trim()) e.email = 'Your email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email address'
    if (!role) e.role = 'Please select your role at this shop'
    if (!agreed) e.agreed = 'You must confirm you are authorized'
    return e
  }

  async function handleSubmit() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSubmitting(true)
    const { error } = await supabase.from('shop_claims').insert({
      shop_id: shop.id,
      user_id: profile?.id || null,
      claimant_name: name.trim(),
      claimant_email: email.trim(),
      claimant_role: role,
      message: message.trim() || null,
      status: 'pending',
    })
    setSubmitting(false)
    if (error) {
      setErrors({ submit: 'Something went wrong. Please try again.' })
    } else {
      setDone(true)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.85)' }}>
      <div className="w-full max-w-sm bg-white rounded-t-3xl animate-slide-up flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <h3 className="font-display font-bold text-coffee-800 text-lg">Claim this shop</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-cream-100 flex items-center justify-center text-coffee-500">
            <X size={14} />
          </button>
        </div>

        {loadingCheck ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
          </div>
        ) : existingClaim ? (
          <div className="px-5 pb-8 text-center">
            <p className="text-4xl mb-3">☕</p>
            <p className="text-coffee-700 font-semibold text-sm mb-1">You've already submitted a claim.</p>
            <p className="text-coffee-400 text-sm">We'll be in touch at <span className="font-medium text-coffee-600">{existingClaim}</span>.</p>
            <button onClick={onClose} className="mt-6 w-full py-3 rounded-2xl bg-cream-100 text-coffee-600 font-semibold text-sm">Close</button>
          </div>
        ) : done ? (
          <div className="px-5 pb-8 text-center">
            <div className="flex justify-center mb-4 mt-2">
              <svg viewBox="0 0 56 68" width={64} height={77}>
                <defs><clipPath id="claim-mug-clip"><rect x="5" y="12" width="38" height="46" rx="5" /></clipPath></defs>
                <rect x="5" y="12" width="38" height="46" rx="5" fill="#f7f0e4" stroke="#c8b090" strokeWidth="1.5" />
                <g clipPath="url(#claim-mug-clip)">
                  <rect x="5" y="12" width="38" height="46" fill="#c8853a" />
                </g>
                <rect x="3" y="8" width="42" height="8" rx="4" fill="#d4b890" />
                <path d="M43 22 Q56 22 56 33 Q56 44 43 44" stroke="#c8b090" strokeWidth="5" fill="none" strokeLinecap="round" />
                <ellipse cx="24" cy="58" rx="19" ry="5" fill="#e8ddc8" />
              </svg>
            </div>
            <p className="text-coffee-800 font-display font-bold text-lg mb-1">Claim submitted!</p>
            <p className="text-coffee-500 text-sm leading-relaxed px-2">
              We'll review it and reach out to{' '}
              <span className="font-semibold text-coffee-700">{email}</span>{' '}
              within 2 business days.
            </p>
            <button onClick={onClose} className="mt-6 w-full py-3 rounded-2xl text-white font-semibold text-sm" style={{ background: '#c8853a' }}>
              Done ☕
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 overflow-y-auto flex-1">
              <p className="text-coffee-400 text-xs mb-4">
                Claiming <span className="font-semibold text-coffee-700">{shop.name}</span> — free on Social Brew.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-coffee-600 mb-1">Your name</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none" />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-coffee-600 mb-1">Your email</label>
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                    className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none" />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-coffee-600 mb-1">Your role at this shop</label>
                  <select value={role} onChange={e => setRole(e.target.value)}
                    className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none">
                    <option value="">Select a role...</option>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-coffee-600 mb-1">
                    Message to our team <span className="text-coffee-400 font-normal">(optional)</span>
                  </label>
                  <textarea value={message} onChange={e => setMessage(e.target.value.slice(0, 500))} rows={3}
                    placeholder="A brief note helps us verify your claim faster..."
                    className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none resize-none" />
                  <p className="text-xs text-coffee-300 text-right mt-0.5">{message.length}/500</p>
                </div>
                <label className="flex items-start gap-3 cursor-pointer py-1">
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                    className="mt-0.5 flex-shrink-0 accent-caramel" />
                  <span className="text-coffee-500 text-xs leading-relaxed">
                    I confirm I am authorized to manage this shop's presence on Social Brew.
                  </span>
                </label>
                {errors.agreed && <p className="text-red-500 text-xs">{errors.agreed}</p>}
                {errors.submit && <p className="text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2 mt-1">{errors.submit}</p>}
              </div>
            </div>
            <div className="px-5 py-4 flex-shrink-0">
              <button onClick={handleSubmit} disabled={submitting}
                className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm disabled:opacity-40"
                style={{ background: '#c8853a' }}>
                {submitting ? 'Submitting...' : 'Submit claim ☕'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
