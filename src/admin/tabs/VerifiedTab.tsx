import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import VerifiedBadge from '../../components/shared/VerifiedBadge'

interface UserRow {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  verified: boolean
}

interface ShopRow {
  id: string
  name: string
  city: string | null
  state: string | null
  photo_url: string | null
  verified: boolean
}

type Mode = 'users' | 'shops'

export default function VerifiedTab() {
  const [mode, setMode] = useState<Mode>('users')

  // Currently verified list
  const [verified, setVerified] = useState<(UserRow | ShopRow)[]>([])
  const [loadingVerified, setLoadingVerified] = useState(false)

  // Search / grant
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<(UserRow | ShopRow)[]>([])
  const [loadingSearch, setLoadingSearch] = useState(false)
  const [working, setWorking] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchVerified(m: Mode) {
    setLoadingVerified(true)
    if (m === 'users') {
      const { data } = await supabase
        .from('profiles')
        .select('id,username,full_name,avatar_url,verified')
        .eq('verified', true)
        .order('username')
        .limit(200)
      setVerified(data || [])
    } else {
      const { data } = await supabase
        .from('coffee_shops')
        .select('id,name,city,state,photo_url,verified')
        .eq('verified', true)
        .order('name')
        .limit(200)
      setVerified(data || [])
    }
    setLoadingVerified(false)
  }

  async function doSearch(q: string, m: Mode) {
    if (!q.trim()) { setSearchResults([]); return }
    setLoadingSearch(true)
    if (m === 'users') {
      const { data } = await supabase
        .from('profiles')
        .select('id,username,full_name,avatar_url,verified')
        .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
        .order('username')
        .limit(30)
      setSearchResults(data || [])
    } else {
      const { data } = await supabase
        .from('coffee_shops')
        .select('id,name,city,state,photo_url,verified')
        .or(`name.ilike.%${q}%,city.ilike.%${q}%`)
        .order('name')
        .limit(30)
      setSearchResults(data || [])
    }
    setLoadingSearch(false)
  }

  useEffect(() => {
    setSearch('')
    setSearchResults([])
    fetchVerified(mode)
  }, [mode])

  function handleSearch(val: string) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => doSearch(val, mode), 350)
  }

  async function setVerifiedStatus(id: string, grant: boolean, m: Mode) {
    setWorking(id)
    const table = m === 'users' ? 'profiles' : 'coffee_shops'
    await supabase.from(table).update({ verified: grant }).eq('id', id)

    // Update both lists
    const patch = (row: UserRow | ShopRow) => row.id === id ? { ...row, verified: grant } : row
    setVerified(prev => grant ? prev : prev.filter(r => r.id !== id))
    setSearchResults(prev => prev.map(patch))

    // If granting, refresh verified list to include the new entry
    if (grant) fetchVerified(m)
    setWorking(null)
  }

  function UserCard({ u, m }: { u: UserRow; m: Mode }) {
    return (
      <div className="flex items-center gap-3 bg-white rounded-xl border border-cream-200 px-4 py-3">
        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-caramel to-coffee-500 flex items-center justify-center">
          {u.avatar_url
            ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-white font-bold text-sm">{u.username?.[0]?.toUpperCase()}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-coffee-800 truncate">{u.username}</p>
            {u.verified && <VerifiedBadge size={14} />}
          </div>
          {u.full_name && <p className="text-xs text-coffee-400 truncate">{u.full_name}</p>}
        </div>
        <button
          disabled={working === u.id}
          onClick={() => setVerifiedStatus(u.id, !u.verified, m)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 disabled:opacity-50 ${
            u.verified
              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
          }`}
        >
          {working === u.id ? '…' : u.verified ? 'Revoke' : 'Grant'}
        </button>
      </div>
    )
  }

  function ShopCard({ s, m }: { s: ShopRow; m: Mode }) {
    return (
      <div className="flex items-center gap-3 bg-white rounded-xl border border-cream-200 px-4 py-3">
        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-cream-200 flex items-center justify-center">
          {s.photo_url
            ? <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
            : <span className="text-lg">☕</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-coffee-800 truncate">{s.name}</p>
            {s.verified && <VerifiedBadge size={14} />}
          </div>
          {(s.city || s.state) && (
            <p className="text-xs text-coffee-400 truncate">{[s.city, s.state].filter(Boolean).join(', ')}</p>
          )}
        </div>
        <button
          disabled={working === s.id}
          onClick={() => setVerifiedStatus(s.id, !s.verified, m)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0 disabled:opacity-50 ${
            s.verified
              ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
              : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
          }`}
        >
          {working === s.id ? '…' : s.verified ? 'Revoke' : 'Grant'}
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-coffee-900">Verified</h1>
        <p className="text-sm text-coffee-400 mt-0.5">Grant or revoke verified badges for users and shops.</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        {(['users', 'shops'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              mode === m ? 'text-white' : 'bg-cream-100 text-coffee-600 hover:bg-cream-200'
            }`}
            style={mode === m ? { background: 'linear-gradient(135deg,#c8853a,#9b5e1a)' } : {}}
          >
            {m === 'users' ? '👤 Users' : '☕ Shops'}
          </button>
        ))}
      </div>

      {/* Search to assign */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold text-coffee-500 uppercase tracking-wide mb-2">Assign checkmark</p>
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder={mode === 'users' ? 'Search by username or name…' : 'Search by shop name or city…'}
            className="w-full px-4 py-2.5 rounded-xl border border-cream-200 bg-white text-sm text-coffee-800 placeholder-coffee-300 focus:outline-none focus:ring-2 focus:ring-caramel/30"
          />
        </div>

        {loadingSearch && (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
          </div>
        )}

        {!loadingSearch && search && searchResults.length === 0 && (
          <p className="text-sm text-coffee-400 text-center py-3">No results found.</p>
        )}

        {!loadingSearch && searchResults.length > 0 && (
          <div className="space-y-2">
            {mode === 'users'
              ? (searchResults as UserRow[]).map(u => <UserCard key={u.id} u={u} m={mode} />)
              : (searchResults as ShopRow[]).map(s => <ShopCard key={s.id} s={s} m={mode} />)}
          </div>
        )}
      </div>

      {/* Currently verified */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-coffee-500 uppercase tracking-wide">
          Currently verified {mode} ({verified.length})
        </p>

        {loadingVerified ? (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
          </div>
        ) : verified.length === 0 ? (
          <p className="text-sm text-coffee-400 text-center py-6">No verified {mode} yet.</p>
        ) : mode === 'users' ? (
          <div className="space-y-2">
            {(verified as UserRow[]).map(u => <UserCard key={u.id} u={u} m={mode} />)}
          </div>
        ) : (
          <div className="space-y-2">
            {(verified as ShopRow[]).map(s => <ShopCard key={s.id} s={s} m={mode} />)}
          </div>
        )}
      </div>
    </div>
  )
}
