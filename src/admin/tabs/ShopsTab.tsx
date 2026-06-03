import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import SkeletonTable from '../components/SkeletonTable'
import ConfirmModal from '../components/ConfirmModal'

interface Props {
  isAdmin: boolean
}

interface ShopOwner {
  founding_partner: boolean
  punches_issued_total: number
  punches_issued_this_month: number
  punch_quota_reset_at: string | null
  punch_card_quota: number | null
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
  zip: string | null
  lat: number | null
  lng: number | null
  country: string | null
  shop_owners: ShopOwner | null
}

interface TeamMember {
  id: string
  profile_id: string | null
  email: string
  display_name: string
  portal_role: string
  status: string
}

interface EditDraft {
  name: string
  city: string
  state: string
  address: string
  website: string
  phone: string
  status: string
  zip: string
  lat: string
  lng: string
  country: string
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
  const [deleteConfirm, setDeleteConfirm] = useState<Shop | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addDraft, setAddDraft] = useState<EditDraft>({ name: '', city: '', state: '', address: '', website: '', phone: '', status: 'active', zip: '', lat: '', lng: '', country: '' })
  const [working, setWorking] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [foundingConfirm, setFoundingConfirm] = useState<{ shopId: string; shopName: string; enable: boolean } | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [revokeConfirm, setRevokeConfirm] = useState<TeamMember | null>(null)
  const [quotaInput, setQuotaInput] = useState<string>('')
  const [savingQuota, setSavingQuota] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchShops(q: string, p: number) {
    setLoading(true)
    let query = supabase
      .from('coffee_shops')
      .select('id,name,city,state,address,website,phone,zip,lat,lng,country,status,claimed_by,created_at,shop_owners(founding_partner,punches_issued_total,punches_issued_this_month,punch_quota_reset_at,punch_card_quota)', { count: 'exact' })
      .order('name')
      .range(p * PAGE, p * PAGE + PAGE - 1)
    if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%,address.ilike.%${q}%`)
    const { data, count } = await query
    setShops((data || []) as any as Shop[])
    setTotal(count || 0)
    setLoading(false)
  }

  useEffect(() => { fetchShops(search, page) }, [page])

  function handleSearch(val: string) {
    setSearch(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setPage(0); fetchShops(val, 0) }, 350)
  }

  async function loadTeamMembers(shopId: string) {
    setLoadingTeam(true)
    const { data } = await supabase
      .from('shop_team_members')
      .select('id,profile_id,email,display_name,portal_role,status')
      .eq('shop_id', shopId)
      .in('status', ['invited', 'active'])
      .order('created_at', { ascending: true })
    setTeamMembers((data || []) as TeamMember[])
    setLoadingTeam(false)
  }

  async function doRevokeTeamMember() {
    if (!revokeConfirm) return
    setWorking(true)
    await supabase
      .from('shop_team_members')
      .update({ status: 'revoked' })
      .eq('id', revokeConfirm.id)
    if (revokeConfirm.profile_id) {
      await supabase
        .from('profiles')
        .update({ team_shop_id: null, portal_role: null })
        .eq('id', revokeConfirm.profile_id)
    }
    setWorking(false)
    setRevokeConfirm(null)
    if (editTarget) loadTeamMembers(editTarget.id)
  }

  async function saveQuota() {
    if (!editTarget) return
    const newQuota = parseInt(quotaInput, 10)
    if (isNaN(newQuota) || newQuota < 0) return
    setSavingQuota(true)
    if (editTarget.shop_owners) {
      await supabase.from('shop_owners').update({ punch_card_quota: newQuota }).eq('shop_id', editTarget.id)
    } else {
      await supabase.from('shop_owners').insert({ shop_id: editTarget.id, punch_card_quota: newQuota })
    }
    setSavingQuota(false)
    const { data } = await supabase
      .from('coffee_shops')
      .select('id,name,city,state,address,website,phone,zip,lat,lng,country,status,claimed_by,created_at,shop_owners(founding_partner,punches_issued_total,punches_issued_this_month,punch_quota_reset_at,punch_card_quota)')
      .eq('id', editTarget.id)
      .single()
    if (data) setEditTarget(data as any)
    fetchShops(search, page)
  }

  function openEdit(shop: Shop) {
    setSaveError(null)
    setEditTarget(shop)
    setQuotaInput(String(shop.shop_owners?.punch_card_quota ?? 0))
    setTeamMembers([])
    loadTeamMembers(shop.id)
    setDraft({
      name: shop.name,
      city: shop.city || '',
      state: shop.state || '',
      address: shop.address || '',
      website: shop.website || '',
      phone: shop.phone || '',
      status: shop.status || 'active',
      zip: shop.zip || '',
      lat: shop.lat != null ? String(shop.lat) : '',
      lng: shop.lng != null ? String(shop.lng) : '',
      country: shop.country || '',
    })
  }

  async function saveEdit() {
    if (!editTarget || !draft) return
    setWorking(true)
    const { error } = await supabase.from('coffee_shops').update({
      name: draft.name,
      city: draft.city || null,
      state: draft.state || null,
      address: draft.address || null,
      website: draft.website || null,
      phone: draft.phone || null,
      status: draft.status,
      zip: draft.zip || null,
      lat: draft.lat ? parseFloat(draft.lat) : null,
      lng: draft.lng ? parseFloat(draft.lng) : null,
      country: draft.country || null,
    }).eq('id', editTarget.id)
    setWorking(false)
    if (error) { setSaveError(error.message); return }
    setEditTarget(null)
    setDraft(null)
    fetchShops(search, page)
  }

  async function deleteShop() {
    if (!deleteConfirm) return
    setDeleteError(null)
    setWorking(true)
    const { error } = await supabase.from('coffee_shops').delete().eq('id', deleteConfirm.id)
    setWorking(false)
    if (error) { setDeleteError(error.message); return }
    setDeleteConfirm(null)
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
    setSaveError(null)
    setWorking(true)
    const { data, error } = await supabase.from('coffee_shops').insert({
      name: addDraft.name.trim(),
      city: addDraft.city.trim() || null,
      state: addDraft.state.trim() || null,
      address: addDraft.address.trim() || null,
      website: addDraft.website.trim() || null,
      phone: addDraft.phone.trim() || null,
      status: addDraft.status || 'active',
      zip: addDraft.zip.trim() || null,
      lat: addDraft.lat ? parseFloat(addDraft.lat) : null,
      lng: addDraft.lng ? parseFloat(addDraft.lng) : null,
      country: addDraft.country.trim() || null,
      is_active: true,
      is_verified: true,
      avg_rating: 0,
      total_ratings: 0,
      weekly_visits: 0,
      avg_fill: 0,
      vibes: [],
    }).select('id').single()
    setWorking(false)
    if (error || !data) {
      setSaveError(error?.message || 'Insert failed — the shop was not saved. Check your connection and try again.')
      return
    }
    setAddOpen(false)
    setAddDraft({ name: '', city: '', state: '', address: '', website: '', phone: '', status: 'active', zip: '', lat: '', lng: '', country: '' })
    fetchShops(search, page)
  }

  async function toggleFoundingPartner() {
    if (!foundingConfirm) return
    setWorking(true)
    const { shopId, enable } = foundingConfirm
    const existing = shops.find(s => s.id === shopId)
    if (existing?.shop_owners) {
      await supabase.from('shop_owners').update({ founding_partner: enable }).eq('shop_id', shopId)
    } else {
      await supabase.from('shop_owners').insert({ shop_id: shopId, founding_partner: enable })
    }
    setWorking(false)
    setFoundingConfirm(null)
    const { data } = await supabase
      .from('coffee_shops')
      .select('id,name,city,state,address,website,phone,zip,lat,lng,country,status,claimed_by,created_at,shop_owners(founding_partner,punches_issued_total,punches_issued_this_month,punch_quota_reset_at,punch_card_quota)')
      .eq('id', shopId)
      .single()
    if (data && editTarget?.id === shopId) setEditTarget(data as any)
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
                  <div className="flex items-center gap-1">
                    <p className="text-sm font-medium text-gray-800">{shop.name}</p>
                    {shop.shop_owners?.founding_partner && (
                      <span title="Founding Partner" className="text-amber-400 text-xs leading-none">⭐</span>
                    )}
                  </div>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="px-5 pt-5 pb-1 flex-shrink-0">
              <h3 className="font-semibold text-gray-900 text-base">Edit shop</h3>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1">
              <div className="space-y-3">
                {(['name', 'city', 'state', 'address', 'zip', 'website', 'phone', 'country'] as const).map(field => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-500 mb-1 capitalize">{field === 'zip' ? 'Zip / Postal Code' : field}</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-caramel/30"
                      value={draft[field]}
                      onChange={e => setDraft(d => d ? { ...d, [field]: e.target.value } : d)}
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Latitude</label>
                    <input type="number" step="any"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-caramel/30"
                      value={draft.lat}
                      onChange={e => setDraft(d => d ? { ...d, lat: e.target.value } : d)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Longitude</label>
                    <input type="number" step="any"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-caramel/30"
                      value={draft.lng}
                      onChange={e => setDraft(d => d ? { ...d, lng: e.target.value } : d)}
                    />
                  </div>
                </div>
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
                {isAdmin && (
                  <div className="border border-amber-200 rounded-xl p-3 bg-amber-50/40">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-700">Founding Partner</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {editTarget.shop_owners?.founding_partner
                            ? `${50 - (editTarget.shop_owners.punches_issued_total || 0)} of 50 total punches remaining`
                            : '10 punches/month standard quota'}
                        </p>
                      </div>
                      <button
                        onClick={() => setFoundingConfirm({ shopId: editTarget.id, shopName: editTarget.name, enable: !editTarget.shop_owners?.founding_partner })}
                        className={`flex-shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          editTarget.shop_owners?.founding_partner
                            ? 'bg-amber-200 text-amber-800 hover:bg-amber-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {editTarget.shop_owners?.founding_partner ? '⭐ Founding' : 'Make Founding'}
                      </button>
                    </div>
                  </div>
                )}
                {/* Punch card quota */}
                {isAdmin && editTarget.claimed_by && (
                  <div className="border border-blue-200 rounded-xl p-3 bg-blue-50/40 space-y-2">
                    <p className="text-xs font-semibold text-gray-700">Punch Card Quota</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Used: <span className="font-semibold text-gray-800">{editTarget.shop_owners?.punches_issued_total ?? 0}</span></span>
                      <span>·</span>
                      <span>Current quota: <span className="font-semibold text-gray-800">{editTarget.shop_owners?.punch_card_quota ?? 0}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQuotaInput(v => String(Math.max(0, parseInt(v || '0', 10) - 5)))}
                        className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 font-bold hover:bg-gray-50 flex items-center justify-center text-sm"
                      >−</button>
                      <input
                        type="number"
                        min={0}
                        value={quotaInput}
                        onChange={e => setQuotaInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-center outline-none focus:ring-2 focus:ring-caramel/30"
                      />
                      <button
                        onClick={() => setQuotaInput(v => String(parseInt(v || '0', 10) + 5))}
                        className="w-8 h-8 rounded-lg border border-gray-200 bg-white text-gray-600 font-bold hover:bg-gray-50 flex items-center justify-center text-sm"
                      >+</button>
                      <button
                        onClick={saveQuota}
                        disabled={savingQuota || quotaInput === String(editTarget.shop_owners?.punch_card_quota ?? 0)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-caramel rounded-lg hover:bg-caramel/90 disabled:opacity-40"
                      >{savingQuota ? '…' : 'Set'}</button>
                    </div>
                  </div>
                )}

                {/* Team members */}
                <div className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-700">Team members</p>
                  {loadingTeam ? (
                    <p className="text-xs text-gray-400">Loading…</p>
                  ) : teamMembers.length === 0 ? (
                    <p className="text-xs text-gray-400">No active team members</p>
                  ) : (
                    <div className="space-y-1.5">
                      {teamMembers.map(m => (
                        <div key={m.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-2.5 py-2">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{m.display_name}</p>
                            <p className="text-[10px] text-gray-400 truncate">{m.email} · <span className="capitalize">{m.portal_role}</span></p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {m.status === 'active' ? 'Active' : 'Invited'}
                            </span>
                            <button
                              onClick={() => setRevokeConfirm(m)}
                              className="text-[10px] font-medium text-red-500 hover:text-red-700 px-2 py-0.5 rounded border border-red-200 hover:bg-red-50 transition-colors"
                            >
                              Revoke
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {saveError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>}
              </div>
            </div>
            <div className="flex flex-col gap-2 px-5 pb-5 flex-shrink-0">
              <div className="flex gap-2">
                <button onClick={() => { setEditTarget(null); setDraft(null); setSaveError(null) }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={saveEdit} disabled={working} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-caramel hover:bg-caramel/90">{working ? 'Saving…' : 'Save changes'}</button>
              </div>
              {isAdmin && editTarget.status !== 'closed' && (
                <button onClick={() => { setEditTarget(null); setDraft(null); setSaveError(null); setCloseConfirm(editTarget) }} className="w-full py-2 rounded-xl text-sm font-medium text-red-500 border border-red-200 hover:bg-red-50">Mark as closed</button>
              )}
              {isAdmin && (
                <button onClick={() => { setEditTarget(null); setDraft(null); setSaveError(null); setDeleteConfirm(editTarget) }} className="w-full py-2 rounded-xl text-sm font-medium text-red-700 border border-red-300 hover:bg-red-50">Delete shop permanently</button>
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

      {/* Delete confirm */}
      {deleteConfirm && (
        <ConfirmModal
          title="Delete shop"
          message={`Permanently delete "${deleteConfirm.name}"? This removes the shop and all its data from the database and cannot be undone.`}
          confirmLabel="Delete permanently"
          danger
          onConfirm={deleteShop}
          onCancel={() => { setDeleteConfirm(null); setDeleteError(null) }}
          loading={working}
        >
          {deleteError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{deleteError}</p>
          )}
        </ConfirmModal>
      )}

      {/* Add shop modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
            <div className="px-5 pt-5 pb-1 flex-shrink-0">
              <h3 className="font-semibold text-gray-900 text-base">Add new shop</h3>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1">
              <div className="space-y-3">
                {(['name', 'city', 'state', 'address', 'zip', 'website', 'phone', 'country'] as const).map(field => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-500 mb-1 capitalize">{field === 'name' ? 'Name *' : field === 'zip' ? 'Zip / Postal Code' : field}</label>
                    <input
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-caramel/30"
                      value={addDraft[field]}
                      onChange={e => setAddDraft(d => ({ ...d, [field]: e.target.value }))}
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Latitude</label>
                    <input type="number" step="any"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-caramel/30"
                      value={addDraft.lat}
                      onChange={e => setAddDraft(d => ({ ...d, lat: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Longitude</label>
                    <input type="number" step="any"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-caramel/30"
                      value={addDraft.lng}
                      onChange={e => setAddDraft(d => ({ ...d, lng: e.target.value }))}
                    />
                  </div>
                </div>
                {saveError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>}
              </div>
            </div>
            <div className="flex gap-2 px-5 pb-5 flex-shrink-0">
              <button onClick={() => { setAddOpen(false); setSaveError(null) }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={addShop} disabled={working || !addDraft.name.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-caramel hover:bg-caramel/90 disabled:opacity-50">{working ? 'Adding…' : 'Add shop'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency revoke team member */}
      {revokeConfirm && (
        <ConfirmModal
          title="Emergency revoke"
          message={`Revoke portal access for ${revokeConfirm.display_name} (${revokeConfirm.email})? They will immediately lose access to the portal.`}
          confirmLabel="Revoke access"
          danger
          onConfirm={doRevokeTeamMember}
          onCancel={() => setRevokeConfirm(null)}
          loading={working}
        />
      )}

      {/* Founding partner confirm */}
      {foundingConfirm && (
        <ConfirmModal
          title={foundingConfirm.enable ? 'Grant founding partner status?' : 'Remove founding partner status?'}
          message={foundingConfirm.enable
            ? `"${foundingConfirm.shopName}" will receive 50 total lifetime punches instead of the standard 10/month.`
            : `Remove founding partner status from "${foundingConfirm.shopName}"? They revert to 10 punches/month.`}
          confirmLabel={foundingConfirm.enable ? 'Grant status' : 'Remove status'}
          danger={!foundingConfirm.enable}
          onConfirm={toggleFoundingPartner}
          onCancel={() => setFoundingConfirm(null)}
          loading={working}
        />
      )}
    </div>
  )
}
