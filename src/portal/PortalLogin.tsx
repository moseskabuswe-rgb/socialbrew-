import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  onSuccess: () => void
}

export default function PortalLogin({ onSuccess }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setLoading(false)
    if (err) {
      setError(err.message || 'Invalid email or password.')
    } else {
      onSuccess()
    }
  }

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-5xl mb-3">☕</p>
          <h1 className="font-display font-bold text-coffee-900 text-2xl">Shop Owner Portal</h1>
          <p className="text-coffee-400 text-sm mt-1">Invitation only — sign in with your owner account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
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
          {error && (
            <p className="text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm disabled:opacity-40 mt-2"
            style={{ background: '#c8853a' }}
          >
            {loading ? 'Signing in...' : 'Sign in ☕'}
          </button>
        </form>

        <p className="text-center text-xs text-coffee-400 mt-6">
          Don't have an account?{' '}
          <a href="/" className="text-caramel underline">Claim your shop</a>{' '}
          on Social Brew.
        </p>
      </div>
    </div>
  )
}
