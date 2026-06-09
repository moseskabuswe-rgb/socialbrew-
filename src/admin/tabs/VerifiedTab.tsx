// src/admin/tabs/VerifiedTab.tsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface VerUser {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  verified: boolean
}

interface VerShop {
  id: string
  name: string
  city: string | null
  state: string | null
  verified: boolean
}

export default function VerifiedTab() {
  const [mode, setMode] = useState<'users' | 'shops'>('users')

  // Users
  const [userSearch, setUserSearch] = useState('')
  const [users, setUsers] = useState<VerUser[]>([])
  const [userLoading, setUserLoading] = useState(true)
  const [userToggling, setUserToggling] = useState<string | null>(null)
  const [userSaved, setUserSaved] = useState<string | null>(null)
  const userDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Shops
  const [shopSearch, setShopSearch] = useState('')
  const [shops, setShops] = useState<VerShop[]>([])
  const [shopLoading, setShopLoading] = useState(false)
  const [shopToggling, setShopToggling] = useState<string | null>(null)
  const [shopSaved, setShopSaved] = useState<string | null>(null)
  const shopDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load users on mount
  useEffect(() => {
    loadUsers('')
  }, [])

  // Switch modes
  useEffect(() => {
    if (mode === 'users') loadUsers(userSearch)
    else loadShops(shopSearch)
  }, [mode])

  async function loadUsers(q: string) {
    setUserLoading(true)
    let query = supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, verified')
      .order('username')
      .limit(50)
    if (q.trim().length >= 2) {
      query = query.ilike('username', `%${q.trim()}%`)
    }
    const { data } = await query
    setUsers((data || []) as VerUser[])
    setUserLoading(false)
  }

  async function loadShops(q: string) {
    setShopLoading(true)
    let query = supabase
      .from('coffee_shops')
      .select('id, name, city, state, verified')
      .order('name')
      .limit(50)
    if (q.trim().length >= 2) {
      query = query.ilike('name', `%${q.trim()}%`)
    }
    const { data } = await query
    setShops((data || []) as VerShop[])
    setShopLoading(false)
  }

  function onUserSearch(q: string) {
    setUserSearch(q)
    if (userDebounce.current) clearTimeout(userDebounce.current)
    userDebounce.current = setTimeout(() => loadUsers(q), 300)
  }

  function onShopSearch(q: string) {
    setShopSearch(q)
    if (shopDebounce.current) clearTimeout(shopDebounce.current)
    shopDebounce.current = setTimeout(() => loadShops(q), 300)
  }

  async function toggleUser(u: VerUser) {
    setUserToggling(u.id)
    const { error } = await supabase
      .from('profiles')
      .update({ verified: !u.verified })
      .eq('id', u.id)
    setUserToggling(null)
    if (!error) {
      setUsers(prev => prev.map(r => r.id === u.id ? { ...r, verified: !r.verified } : r))
      setUserSaved(u.id)
      setTimeout(() => setUserSaved(null), 2000)
    }
  }

  async function toggleShop(s: VerShop) {
    setShopToggling(s.id)
    const { error } = await supabase
      .from('coffee_shops')
      .update({ verified: !s.verified })
      .eq('id', s.id)
    setShopToggling(null)
    if (!error) {
      setShops(prev => prev.map(r => r.id === s.id ? { ...r, verified: !r.verified } : r))
      setShopSaved(s.id)
      setTimeout(() => setShopSaved(null), 2000)
    }
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h2 className="text-coffee-800 font-display font-bold text-lg mb-1">Verified Badges</h2>
      <p className="text-coffee-400 text-xs mb-4">Assign or revoke the verified checkmark for users and shops.</p>

      {/* Mode toggle */}
      <div className="flex rounded-xl bg-cream-100 p-1 mb-5 border border-cream-200">
        {(['users', 'shops'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
              mode === m ? 'bg-white shadow text-coffee-800' : 'text-coffee-400'
            }`}
          >
            {m === 'users' ? '👤 Users' : '☕ Shops'}
          </button>
        ))}
      </div>

      {/* USERS */}
      {mode === 'users' && (
        <div>
          <input
            value={userSearch}
            onChange={e => onUserSearch(e.target.value)}
            placeholder="Search by username…"
            className="w-full border border-cream-200 rounded-xl px-3 py-2.5 text-sm text-coffee-800 focus:outline-none focus:border-caramel mb-3"
          />
          {userLoading ? (
            <p className="text-coffee-400 text-sm text-center py-8">Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-coffee-400 text-sm text-center py-8">No users found</p>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-cream-200">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-caramel to-coffee-500 flex items-center justify-center">
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-white font-bold text-sm">{u.username[0]?.toUpperCase()}</span>
                    }
                  </div>
                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-coffee-800 font-semibold text-sm truncate">{u.username}</p>
                    {u.full_name && <p className="text-coffee-400 text-xs truncate">{u.full_name}</p>}
                  </div>
                  {/* Saved indicator */}
                  {userSaved === u.id && (
                    <span className="text-green-600 text-xs font-semibold">✓ Saved</span>
                  )}
                  {/* Toggle */}
                  <button
                    onClick={() => toggleUser(u)}
                    disabled={userToggling === u.id}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 disabled:opacity-50 ${
                      u.verified
                        ? 'bg-teal-50 text-teal-700 border-teal-300'
                        : 'bg-cream-100 text-coffee-500 border-cream-300'
                    }`}
                  >
                    {userToggling === u.id ? '…' : u.verified ? '✓ Verified' : 'Verify'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SHOPS */}
      {mode === 'shops' && (
        <div>
          <input
            value={shopSearch}
            onChange={e => onShopSearch(e.target.value)}
            placeholder="Search by shop name…"
            className="w-full border border-cream-200 rounded-xl px-3 py-2.5 text-sm text-coffee-800 focus:outline-none focus:border-caramel mb-3"
          />
          {shopLoading ? (
            <p className="text-coffee-400 text-sm text-center py-8">Loading…</p>
          ) : shops.length === 0 ? (
            <p className="text-coffee-400 text-sm text-center py-8">No shops found</p>
          ) : (
            <div className="space-y-2">
              {shops.map(s => (
                <div key={s.id} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-cream-200">
                  <div className="w-9 h-9 rounded-xl bg-coffee-100 flex items-center justify-center flex-shrink-0 text-lg">
                    ☕
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-coffee-800 font-semibold text-sm truncate">{s.name}</p>
                    {(s.city || s.state) && (
                      <p className="text-coffee-400 text-xs">{[s.city, s.state].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                  {shopSaved === s.id && (
                    <span className="text-green-600 text-xs font-semibold">✓ Saved</span>
                  )}
                  <button
                    onClick={() => toggleShop(s)}
                    disabled={shopToggling === s.id}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 disabled:opacity-50 ${
                      s.verified
                        ? 'bg-teal-50 text-teal-700 border-teal-300'
                        : 'bg-cream-100 text-coffee-500 border-cream-300'
                    }`}
                  >
                    {shopToggling === s.id ? '…' : s.verified ? '✓ Verified' : 'Verify'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
