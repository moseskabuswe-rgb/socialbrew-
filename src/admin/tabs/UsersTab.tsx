import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import SkeletonTable from '../components/SkeletonTable'
import ConfirmModal from '../components/ConfirmModal'

interface Props {
  isAdmin: boolean
  currentUserId: string
}

interface User {
  id: string
  username: string
  full_name: string | null
  role: string
  badge: string | null
  suspended_at: string | null
  suspended_reason: string | null
  created_at: string
  is_portal_only: boolean | null
}

interface Rating {
  id: string
  drink_name: string | null
  fill_level: number
  created_at: string
  coffee_shops: { name: string } | null
}

const PAGE = 25

export default function UsersTab({ isAdmin, currentUserId }: Props) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<User | null>(null)
  const [selectedRatings, setSelectedRatings] = useState<Rating[]>([])
  const [loadingRatings, setLoadingRatings] = useState(false)
  const [confirm, setConfirm] = useState<null | 'suspend' | 'unsuspend' | 'role'>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [targetRole, setTargetRole] = useState('')
  const [working, setWorking] = useState(false)
  const [roleFilter, setRoleFilter] = useState<'all' | 'consumer' | 'business' | 'team' | 'portal_only' | 'brewers' | 'never_brewed'>('all')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchUsers(q: string, p: number, rf = roleFilter) {
    setLoading(true)
    let query = supabase
      .from('profiles')
      .select('id,username,full_name,role,badge,suspended_at,suspended_reason,created_at,is_portal_only', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(p * PAGE, p * PAGE + PAGE - 1)
    if (q) query = query.or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
    if (rf === 'consumer') query = query.eq('role', 'consumer').eq('is_portal_only', false)
    else if (rf === 'business') query = query.eq('role', 'business')
    else if (rf === 'team') query = query.not('team_shop_id', 'is', null)
    else if (rf === 'portal_only') query = query.eq('is_portal_only', true)
    else if (rf === 'brewers' || rf === 'never_brewed') {
      const { data: brewerData } = await supabase.from('ratings').select('user_id').limit(10000)
      const brewerIds = [...new Set((brewerData || []).map(r => r.user_id as string))]
      if (rf === 'brewers') {
        if (brewerIds.length === 0) {
          setUsers([])
          setTotal(0)
          setLoading(false)
          return
        }
        query = query.in('id', brewerIds)
      } else {
        if (brewerIds.length > 0) {
          query = query.not('id', 'in', `(${brewerIds.join(',')})`)
        }
      }
    }
    const { data, count } = await query
    setUsers(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers(search, page)
  }, [page])

  function handleSearch(val: string) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setPage(0)
      fetchUsers(val, 0)
    }, 350)
  }

  function handleRoleFilter(rf: typeof roleFilter) {
    setRoleFilter(rf)
    setPage(0)
    fetchUsers(search, 0, rf)
  }

  async function openUser(user: User) {
    setSelected(user)
    setLoadingRatings(true)
    const { data } = await supabase
      .from('ratings')
      .select('id,drink_name,fill_level,created_at,coffee_shops(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    setSelectedRatings((data as any) || [])
    setLoadingRatings(false)
  }

  async function doSuspend() {
    if (!selected) return
    setWorking(true)
    await supabase
      .from('profiles')
      .update({ suspended_at: new Date().toISOString(), suspended_reason: suspendReason })
      .eq('id', selected.id)
    setWorking(false)
    setConfirm(null)
    setSuspendReason('')
    fetchUsers(search, page)
    setSelected(prev => prev ? { ...prev, suspended_at: new Date().toISOString(), suspended_reason: suspendReason } : prev)
  }

  async function doUnsuspend() {
    if (!selected) return
    setWorking(true)
    await supabase
      .from('profiles')
      .update({ suspended_at: null, suspended_reason: null })
      .eq('id', selected.id)
    setWorking(false)
    setConfirm(null)
    fetchUsers(search, page)
    setSelected(prev => prev ? { ...prev, suspended_at: null, suspended_reason: null } : prev)
  }

  async function doRoleChange() {
    if (!selected || !targetRole) return
    setWorking(true)
    await supabase.from('profiles').update({ role: targetRole }).eq('id', selected.id)
    setWorking(false)
    setConfirm(null)
    fetchUsers(search, page)
    setSelected(prev => prev ? { ...prev, role: targetRole } : prev)
  }

  const totalPages = Math.ceil(total / PAGE)

  function canSuspend(user: User) {
    if (user.id === currentUserId) return false
    if (isAdmin) return true
    // moderators can only suspend consumers
    return user.role === 'consumer'
  }

  function roleOptions() {
    const roles = ['consumer', 'business', 'moderator']
    if (isAdmin) roles.push('admin')
    return roles.filter(r => r !== selected?.role)
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Users</h1>
        <span className="text-sm text-gray-400">{total.toLocaleString()} total</span>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {(['all','consumer','business','team','portal_only','brewers','never_brewed'] as const).map(f => (
          <button
            key={f}
            onClick={() => handleRoleFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${roleFilter === f ? 'bg-caramel text-white border-caramel' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {f === 'all' ? 'All users'
              : f === 'consumer' ? 'Consumers'
              : f === 'business' ? 'Business owners'
              : f === 'team' ? 'Team members'
              : f === 'portal_only' ? 'Portal only'
              : f === 'brewers' ? '☕ Brewers'
              : '👤 Never brewed'}
          </button>
        ))}
      </div>
      <input
        className="w-full mb-4 px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-caramel/30"
        placeholder="Search username, name or email…"
        value={search}
        onChange={e => handleSearch(e.target.value)}
      />

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>User</span>
          <span>Role</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>

        {loading ? (
          <div className="px-4 py-2"><SkeletonTable rows={8} cols={4} /></div>
        ) : users.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No users found</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {users.map(user => (
              <div key={user.id} className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-4 py-3 items-center hover:bg-gray-50/50">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-800 truncate">@{user.username}</p>
                    {user.is_portal_only && (
                      <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">Portal only</span>
                    )}
                  </div>
                  {user.full_name && (
                    <p className="text-xs text-gray-400 truncate">{user.full_name}</p>
                  )}
                </div>
                <span className="text-xs text-gray-600 capitalize">{user.role}</span>
                <span className={`text-xs font-medium ${user.suspended_at ? 'text-red-500' : 'text-green-600'}`}>
                  {user.suspended_at ? 'Suspended' : 'Active'}
                </span>
                <div className="text-right">
                  <button
                    onClick={() => openUser(user)}
                    className="text-xs text-caramel hover:underline font-medium"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      {/* User detail panel */}
      {selected && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1 bg-black/30" onClick={() => setSelected(null)} />
          <div className="w-80 bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">@{selected.username}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-4 flex-1">
              <div className="space-y-1 text-sm">
                {selected.full_name && <p className="text-gray-700">{selected.full_name}</p>}
                <p className="text-gray-400 text-xs capitalize">Role: {selected.role}</p>
                {selected.badge && <p className="text-gray-400 text-xs">Badge: {selected.badge}</p>}
                <p className="text-gray-400 text-xs">Joined: {new Date(selected.created_at).toLocaleDateString()}</p>
                {selected.suspended_at && (
                  <div className="mt-2 p-2 bg-red-50 rounded-lg text-xs text-red-700">
                    <p className="font-medium">Suspended {new Date(selected.suspended_at).toLocaleDateString()}</p>
                    {selected.suspended_reason && <p className="mt-0.5">{selected.suspended_reason}</p>}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Last 5 ratings</p>
                {loadingRatings ? (
                  <SkeletonTable rows={3} cols={2} />
                ) : selectedRatings.length === 0 ? (
                  <p className="text-xs text-gray-400">No ratings yet</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedRatings.map(r => (
                      <div key={r.id} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                        <p className="font-medium">{r.coffee_shops?.name || 'Unknown shop'}</p>
                        <p className="text-gray-400">{r.drink_name || 'Drink'} · {r.fill_level}/5 mugs</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-100 space-y-2">
              {isAdmin && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Change role to</p>
                  <div className="flex flex-wrap gap-1.5">
                    {roleOptions().map(r => (
                      <button
                        key={r}
                        onClick={() => { setTargetRole(r); setConfirm('role') }}
                        className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 hover:bg-gray-100 capitalize"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {canSuspend(selected) && (
                selected.suspended_at ? (
                  <button
                    onClick={() => setConfirm('unsuspend')}
                    className="w-full py-2 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors"
                  >
                    Unsuspend
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirm('suspend')}
                    className="w-full py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    Suspend
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {confirm === 'suspend' && (
        <ConfirmModal
          title="Suspend user"
          message={`Suspend @${selected?.username}? They won't be able to post or interact.`}
          confirmLabel="Suspend"
          danger
          onConfirm={doSuspend}
          onCancel={() => { setConfirm(null); setSuspendReason('') }}
          loading={working}
        >
          <textarea
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-200 resize-none"
            rows={3}
            placeholder="Reason (optional)"
            value={suspendReason}
            onChange={e => setSuspendReason(e.target.value)}
          />
        </ConfirmModal>
      )}

      {confirm === 'unsuspend' && (
        <ConfirmModal
          title="Unsuspend user"
          message={`Restore access for @${selected?.username}?`}
          confirmLabel="Unsuspend"
          onConfirm={doUnsuspend}
          onCancel={() => setConfirm(null)}
          loading={working}
        />
      )}

      {confirm === 'role' && (
        <ConfirmModal
          title="Change role"
          message={`Change @${selected?.username}'s role from ${selected?.role} to ${targetRole}?`}
          confirmLabel="Change role"
          onConfirm={doRoleChange}
          onCancel={() => setConfirm(null)}
          loading={working}
        />
      )}
    </div>
  )
}
