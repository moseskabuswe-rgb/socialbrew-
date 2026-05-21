import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import SkeletonTable from '../components/SkeletonTable'
import ConfirmModal from '../components/ConfirmModal'

interface Props {
  isAdmin: boolean
}

interface Shop {
  id: string
  name: string
  city: string | null
  state: string | null
  address: string | null
  website: string | null
  phone: string | null
  status: string | null
  claimed_by: string | null
  created_at: string
}

interface EditDraft {
  name: string
  city: string
  state: string
  address: string
  website: string
  phone: string
  status: string
}

const PAGE = 25

export default function ShopsTab({ isAdmin }: Props) {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [editTarget, setEditTarget] = useState<Shop | null>(null)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [closeConfirm, setCloseConfirm] = useState<Shop | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addDraft, setAddDraft] = useState<EditDraft>({ name: '', city: '', state: '', address: '', website: '', phone: '', status: 'active' })
  const [working, setWorking] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchShops(q: string, p: number) {
    setLoading(true)
    let query = supabase
      .from('coffee_shops')
      .select('id,name,city,state,address,website,phone,status,claimed_by,created_at', { count: 'exact' })
      .order('name')
      .range(p * PAGE, p * PAGE + PAGE - 1)
    if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%,address.ilike.%${q}%`)
    const { data, count } = await query
    setShops(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  useEffect(() => { fetchShops(search, page) }, [page])

  function handleSearch(val: string) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setPage(0); fetchShops(val, 0) }, 350)
  }

  function openEdit(shop: Shop) {
    setEditTarget(shop)
    setDraft({
      name: shop.name,
      city: shop.city || '',
      state: shop.state || '',
      address: shop.address || '',
      website: shop.website || '',
      phone: shop.phone || '',
      status: shop.status || 'active',
    })
  }

  async function saveEdit() {
    if (!editTarget || !draft) return
    setWorking(true)
    await supabase.from('coffee_shops').update({
      name: draft.name,
      city: draft.city || null,
      state: draft.state || null,
      address: draft.address || null,
      website: draft.website || null,
      phone: draft.phone || null,
      status: draft.status,
    }).eq('id', editTarget.id)
    setWorking(false)
    setEditTarget(null)
    setDraft(null)
    fetchShops(search, page)
  }

  async function markClosed() {
    if (!closeConfirm) return
    setWorking(true)
    await supabase.from('coffee_shops').update({ status: 'closed' }).eq('id', closeConfirm.id)
    setWorking(false)
    setCloseConfirm(null)
    fetchShops(search, page)
  }

  async function addShop() {
    if (!addDraft.name.trim()) return
    setWorking(true)
    await supabase.from('coffee_shops').insert({
      name: addDraft.name,
      city: addDraft.city || null,
      state: addDraft.state || null,
      address: addDraft.address || null,
      website: addDraft.website || null,
      phone: addDraft.phone || null,
      status: addDraft.status || 'active',
    })
    setWorking(false)
    setAddOpen(false)
    setAddDraft({ name: '', city: '', state: '', address: '', website: '', phone: '', status: 'active' })
    fetchShops(search, page)
  }

  const totalPages = Math.ceil(total / PAGE)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Shops</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{total.toLocaleString()} total</span>
          {isAdmin && (
            <button
              onClick={() => setAddOpen(true)}
              className="px-3 py-1.5 bg-caramel text-white text-sm font-medium rounded-lg hover:bg-caramel/90 transition-colors"
            >
              + Add shop
            </button>
          )}
        </div>
      </div>

      <input
        className="w-full mb-4 px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-caramel/30"
        placeholder="Search name, city or address…"
        value={search}
        onChange={e => handleSearch(e.target.value)}
      />

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_80px_80px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>Shop</span>
          <span>Location</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>
        {loading ? (
          <div className="px-4 py-2"><SkeletonTable rows={8} cols={4} /></div>
        ) : shops.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No shops found</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {shops.map(shop => (
              <div key={shop.id} className="grid grid-cols-[1fr_100px_80px_80px] gap-2 px-4 py-3 items-center hover:bg-gray-50/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{shop.name}</p>
                  {shop.address && <p className="text-xs text-gray-400 truncate">{shop.address}</p>}
                </div>
                <span className="text-xs text-gray-500 truncate">{[shop.city, shop.state].filter(Boolean).join(', ') || '—'}</span>
                <span className={`text-xs font-medium capitalize ${shop.status === 'closed' ? 'text-red-500' : shop.status === 'pending' ? 'text-amber-500' : 'text-green-600'}`}>
                  {shop.status || 'active'}
                </span>
                <div className="text-right">
                  <button onClick={() => openEdit(shop)} className="text-xs text-caramel hover:underline font-medium">Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Prev</button>
          <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && draft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-5 pt-5 pb-4">
              <h3 className="font-semibold text-gray-900 text-base mb-4">Edit shop</h3>
              <div className="space-y-3">
                {(['name', 'city', 'state', 'address', 'website', 'phone'] as const).map(field => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-500 mb-1 capitalize">{field}</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-caramel/30"
                      value={draft[field]}
                      onChange={e => setDraft(d => d ? { ...d, [field]: e.target.value } : d)}
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-caramel/30"
                    value={draft.status}
                    onChange={e => setDraft(d => d ? { ...d, status: e.target.value } : d)}
                  >
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 px-5 pb-5">
              <div className="flex gap-2">
                <button onClick={() => { setEditTarget(null); setDraft(null) }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={saveEdit} disabled={working} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-caramel hover:bg-caramel/90">{working ? 'Saving…' : 'Save changes'}</button>
              </div>
              {isAdmin && editTarget.status !== 'closed' && (
                <button onClick={() => { setEditTarget(null); setCloseConfirm(editTarget) }} className="w-full py-2 rounded-xl text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50">Mark as closed</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mark closed confirm */}
      {closeConfirm && (
        <ConfirmModal
          title="Mark shop as closed"
          message={`Mark "${closeConfirm.name}" as permanently closed?`}
          confirmLabel="Mark closed"
          danger
          onConfirm={markClosed}
          onCancel={() => setCloseConfirm(null)}
          loading={working}
        />
      )}

      {/* Add shop modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-5 pt-5 pb-4">
              <h3 className="font-semibold text-gray-900 text-base mb-4">Add new shop</h3>
              <div className="space-y-3">
                {(['name', 'city', 'state', 'address', 'website', 'phone'] as const).map(field => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-500 mb-1 capitalize">{field}{field === 'name' ? ' *' : ''}</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-caramel/30"
                      value={addDraft[field]}
                      onChange={e => setAddDraft(d => ({ ...d, [field]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setAddOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={addShop} disabled={working || !addDraft.name.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-caramel hover:bg-caramel/90 disabled:opacity-50">{working ? 'Adding…' : 'Add shop'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
