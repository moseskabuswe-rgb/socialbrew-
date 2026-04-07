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
      else setSuccess('Account created! Check your email or sign in now.')
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
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-green-700 text-sm">{success}</div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-600 text-sm">{error}</div>
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
                <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} required
                  placeholder="your_handle"
                  className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300 transition-colors" />
              </div>
            </>
          )}

          <div>
            <label className="text-coffee-500 text-xs uppercase tracking-wider mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="you@example.com"
              className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300 transition-colors" />
          </div>

          <div>
            <label className="text-coffee-500 text-xs uppercase tracking-wider mb-1.5 block">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••"
              className="w-full bg-cream-50 text-coffee-800 rounded-xl px-4 py-3 text-sm border border-cream-200 focus:border-caramel focus:outline-none placeholder-coffee-300 transition-colors" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold text-white transition-all duration-200 mt-2 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #c8853a, #a06428)', boxShadow: loading ? 'none' : '0 4px 16px rgba(200,133,58,0.35)' }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>

      <p className="text-coffee-400 text-xs mt-8 text-center italic">
        Brewing connections, one sip at a time.
      </p>
    </div>
  )
}
