import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Coffee } from 'lucide-react'

export default function AuthForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const { signIn, signUp } = useAuth()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) setError(error.message)
    } else {
      if (username.length < 3) { setError('Username must be at least 3 characters'); setLoading(false); return }
      const { error } = await signUp(email, password, username, fullName)
      if (error) setError(error.message)
      else setSuccess('Account created! Check your email to verify, or sign in directly.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-espresso flex flex-col items-center justify-center p-6"
      style={{ background: 'radial-gradient(ellipse at top, #2a1f0e 0%, #0d0904 100%)' }}>

      {/* Logo */}
      <div className="flex flex-col items-center mb-10 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-caramel flex items-center justify-center mb-4 shadow-lg"
          style={{ boxShadow: '0 0 40px rgba(200,133,58,0.3)' }}>
          <Coffee size={36} className="text-white" />
        </div>
        <h1 className="text-white font-display text-4xl font-bold tracking-tight">Social Brew</h1>
        <p className="text-coffee-200 text-sm mt-1 tracking-widest uppercase">Your coffee community</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-coffee-700 rounded-2xl p-6 shadow-2xl animate-slide-up">
        {/* Tab toggle */}
        <div className="flex bg-coffee-800 rounded-xl p-1 mb-6">
          {(['login', 'signup'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${mode === m ? 'bg-caramel text-white shadow' : 'text-coffee-200 hover:text-white'}`}>
              {m === 'login' ? 'Sign In' : 'Join'}
            </button>
          ))}
        </div>

        {success && (
          <div className="bg-green-900/40 border border-green-600/40 rounded-xl p-3 mb-4 text-green-300 text-sm">{success}</div>
        )}
        {error && (
          <div className="bg-red-900/40 border border-red-600/40 rounded-xl p-3 mb-4 text-red-300 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label className="text-coffee-200 text-xs uppercase tracking-wider mb-1 block">Full Name</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} required
                  placeholder="Your name"
                  className="w-full bg-coffee-800 text-white rounded-xl px-4 py-3 text-sm border border-coffee-600 focus:border-caramel focus:outline-none placeholder-coffee-400 transition-colors" />
              </div>
              <div>
                <label className="text-coffee-200 text-xs uppercase tracking-wider mb-1 block">Username</label>
                <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} required
                  placeholder="your_handle"
                  className="w-full bg-coffee-800 text-white rounded-xl px-4 py-3 text-sm border border-coffee-600 focus:border-caramel focus:outline-none placeholder-coffee-400 transition-colors" />
              </div>
            </>
          )}

          <div>
            <label className="text-coffee-200 text-xs uppercase tracking-wider mb-1 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="you@example.com"
              className="w-full bg-coffee-800 text-white rounded-xl px-4 py-3 text-sm border border-coffee-600 focus:border-caramel focus:outline-none placeholder-coffee-400 transition-colors" />
          </div>

          <div>
            <label className="text-coffee-200 text-xs uppercase tracking-wider mb-1 block">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••"
              className="w-full bg-coffee-800 text-white rounded-xl px-4 py-3 text-sm border border-coffee-600 focus:border-caramel focus:outline-none placeholder-coffee-400 transition-colors" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-caramel hover:bg-amber-600 text-white font-semibold py-3 rounded-xl transition-all duration-200 mt-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            style={{ boxShadow: loading ? 'none' : '0 4px 20px rgba(200,133,58,0.4)' }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>

      <p className="text-coffee-400 text-xs mt-8 text-center">
        Independent coffee shops only. No chains. Just community.
      </p>
    </div>
  )
}
