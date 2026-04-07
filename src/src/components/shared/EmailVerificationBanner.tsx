import { Mail, X } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function EmailVerificationBanner() {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [sent, setSent] = useState(false)

  if (dismissed) return null

  async function resend() {
    if (!user?.email) return
    await supabase.auth.resend({ type: 'signup', email: user.email })
    setSent(true)
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3">
      <Mail size={15} className="text-amber-600 flex-shrink-0" />
      <p className="text-amber-700 text-xs flex-1">
        {sent ? 'Verification email sent! Check your inbox.' : 'Please verify your email.'}
        {!sent && (
          <button onClick={resend} className="ml-1.5 underline font-medium">Resend</button>
        )}
      </p>
      <button onClick={() => setDismissed(true)} className="text-amber-500 flex-shrink-0">
        <X size={14} />
      </button>
    </div>
  )
}
