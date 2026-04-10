import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Coffee, Eye, EyeOff } from 'lucide-react'

function friendlyError(msg: string): string {
  if (!msg) return 'Something went wrong. Please try again.'
  const m = msg.toLowerCase()
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Incorrect email or password. Please try again.'
  if (m.includes('email not confirmed')) return 'Please check your email and click the confirmation link first.'
  if (m.includes('user already registered') || m.includes('already been registered')) return 'An account with this email already exists. Try signing in instead.'
  if (m.includes('password should be')) return 'Password must be at least 6 characters.'
  if (m.includes('rate limit') || m.includes('email rate limit') || m.includes('too many requests') || m.includes('over_email_send_rate_limit')) {
    return 'Too many attempts. Please wait a few minutes before trying again.'
  }
  if (m.includes('network') || m.includes('fetch')) return 'Connection error. Please check your internet and try again.'
  if (m.includes('username') && m.includes('taken')) return 'That username is taken. Please choose another.'
  return msg
}

export default function AuthForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { signIn, signUp } = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Client-side validation
    if (mode === 'signup') {
      if (username.length < 3) { setError('Username must be at least 3 characters'); return }
      if (username.length > 20) { setError('Username must be 20 characters or less'); return }
      if (!/^[a-z0-9_.]+$/.test(username)) { setError('Username can only contain letters, numbers, underscores, and dots'); return }
      if (password.length < 6) { setError('Password must be at least 6 characters'); return }
      if (!fullName.trim()) { setError('Please enter your name'); return }
    }

    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email.trim().toLowerCase(), password)
      if (error) setError(friendlyError(error.message))
    } else {
      const { error } = await signUp(email.trim().toLowerCase(), password, username.trim(), fullName.trim())
      if (error) {
        setError(friendlyError(error.message))
      } else {
        setSuccess('Account created! You can sign in now.')
        setMode('login')
        setPassword('')
        setUsername('')
        setFullName('')
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'linear-gradient(160deg, #fdfaf5 0%, #f5ead8 50%, #efe0c4 100%)' }}>

      {/* Logo */}
      <div className="flex flex-col items-center mb-10 animate-fade-in">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-md"
          style={{ background: 'linear-gradient(135deg, #c8853a, #a06428)' }}>
          <Coffee size={36} className="text-white" />
        </div>
        <h1 className="font-display text-4xl font-bold text-coffee-800 tracking-tight">Social Brew</h1>
        <p className="text-coffee-400 text-sm mt-1.5 tracking-widest uppercase">Your Coffee Community</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-lg border border-cream-200 animate-slide-up">
        {/* Tab toggle */}
        <div className="flex bg-cream-100 rounded-xl p-1 mb-6 border border-cream-200">
          {(['login', 'signup'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${mode === m ? 'bg-caramel text-white shadow' : 'text-coffee-500 hover:text-coffee-700'}`}>
              {m === 'login' ? 'Sign In' : 'Join'}
            </button>
          ))}
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-green-700 text-sm flex items-start gap-2">
            <span className="text-lg">✅</span>
            <span>{success}</span>
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-600 text-sm flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label className="text-coffee-500 text-xs uppercase tracking-wider mb-1.5 block">Full Name</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} required
                  placeholder="Your name"
                  className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300 transition-colors" />
              </div>
              <div>
                <label className="text-coffee-500 text-xs uppercase tracking-wider mb-1.5 block">Username</label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-coffee-400 text-sm">@</span>
                  <input value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                    required placeholder="your_handle"
                    className="w-full bg-cream-50 text-coffee-800 rounded-xl pl-8 pr-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300 transition-colors" />
                </div>
                <p className="text-coffee-400 text-xs mt-1">Letters, numbers, underscores, dots only</p>
              </div>
            </>
          )}

          <div>
            <label className="text-coffee-500 text-xs uppercase tracking-wider mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="you@example.com" autoComplete="email"
              className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300 transition-colors" />
          </div>

          <div>
            <label className="text-coffee-500 text-xs uppercase tracking-wider mb-1.5 block">Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 pr-11 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300 transition-colors" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-coffee-400 hover:text-coffee-600">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {mode === 'signup' && <p className="text-coffee-400 text-xs mt-1">At least 6 characters</p>}
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200 mt-2 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #c8853a, #a06428)', boxShadow: loading ? 'none' : '0 4px 16px rgba(200,133,58,0.35)' }}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Please wait...
              </span>
            ) : mode === 'login' ? 'Sign In ☕' : 'Create Account ☕'}
          </button>
        </form>

        <p className="text-center text-coffee-400 text-xs mt-5">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setSuccess('') }}
            className="text-caramel font-semibold hover:underline">
            {mode === 'login' ? 'Join now' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
