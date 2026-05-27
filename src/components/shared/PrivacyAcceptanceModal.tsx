import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import PrivacyPolicyPage from './PrivacyPolicyPage'
import TermsPage from './TermsPage'

export const CURRENT_POLICY_VERSION = '2026-05-27'

type View = 'modal' | 'privacy' | 'terms'

interface Props {
  userId: string
  onAccepted: () => void
}

export default function PrivacyAcceptanceModal({ userId, onAccepted }: Props) {
  const [view, setView] = useState<View>('modal')
  const [accepting, setAccepting] = useState(false)

  if (view === 'privacy') return <PrivacyPolicyPage onBack={() => setView('modal')} />
  if (view === 'terms') return <TermsPage onBack={() => setView('modal')} />

  async function accept() {
    setAccepting(true)
    await supabase.from('profiles').update({
      privacy_accepted_at: new Date().toISOString(),
      privacy_policy_version: CURRENT_POLICY_VERSION,
    }).eq('id', userId)
    setAccepting(false)
    onAccepted()
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center" style={{ background: 'rgba(8,4,1,0.85)' }}>
      <div
        className="w-full max-w-sm rounded-t-3xl animate-slide-up overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #fdfaf5, #f5ead8)' }}
      >
        <div className="px-6 pt-7 pb-6 space-y-4">
          <div className="text-center">
            <p className="text-4xl mb-3">☕</p>
            <h2 className="font-display text-2xl font-bold text-coffee-800">Welcome to Social Brew</h2>
            <p className="text-coffee-500 text-sm mt-2 leading-relaxed">Before you continue, please review and accept our policies.</p>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-cream-200 space-y-2">
            <button
              onClick={() => setView('privacy')}
              className="w-full flex items-center justify-between py-2 text-left"
            >
              <div>
                <p className="text-coffee-800 font-semibold text-sm">Privacy Policy</p>
                <p className="text-coffee-400 text-xs">How we collect and use your data</p>
              </div>
              <span className="text-caramel text-sm">Read →</span>
            </button>
            <div className="h-px bg-cream-200" />
            <button
              onClick={() => setView('terms')}
              className="w-full flex items-center justify-between py-2 text-left"
            >
              <div>
                <p className="text-coffee-800 font-semibold text-sm">Terms of Service</p>
                <p className="text-coffee-400 text-xs">Rules for using Social Brew</p>
              </div>
              <span className="text-caramel text-sm">Read →</span>
            </button>
          </div>

          <p className="text-coffee-400 text-xs text-center leading-relaxed">
            By tapping Accept, you agree to our Privacy Policy and Terms of Service. You must be 13 or older to use this app.
          </p>

          <button
            onClick={accept}
            disabled={accepting}
            className="w-full py-4 rounded-2xl text-white font-bold text-base disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #c8853a, #9b5e1a)' }}
          >
            {accepting ? 'Saving...' : 'Accept & Continue ☕'}
          </button>
        </div>
      </div>
    </div>
  )
}
