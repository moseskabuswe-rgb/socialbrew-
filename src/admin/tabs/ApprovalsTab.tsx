import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import SkeletonTable from '../components/SkeletonTable'
import ConfirmModal from '../components/ConfirmModal'

interface Props {
  isAdmin?: boolean
  currentUserId: string
  onPendingChange: () => void
}

interface Claim {
  id: string
  shop_id: string | null
  user_id: string | null
  status: string
  created_at: string
  claimant_name: string | null
  claimant_email: string | null
  claimant_role: string | null
  message: string | null
  new_shop_data: {
    name: string
    city: string
    state?: string | null
    address?: string | null
    website?: string | null
  } | null
  coffee_shops: { name: string; is_verified: boolean; is_active: boolean } | null
  profiles: { username: string } | null
}

interface EditSubmission {
  id: string
  shop_id: string
  submitted_by: string
  status: string
  field_changes: Record<string, { old: unknown; new: unknown }>
  created_at: string
  coffee_shops: { name: string } | null
  profiles: { username: string } | null
  rejection_reason: string | null
}

interface ShopPost {
  id: string
  shop_id: string
  owner_id: string
  content: string
  status: string
  created_at: string
  coffee_shops: { name: string } | null
  profiles: { username: string } | null
}

interface PunchCard {
  id: string
  shop_id: string
  punches_required: number
  reward_description: string
  expiry_days: number | null
  created_at: string
  coffee_shops: { name: string } | null
}

type Section = 'claims' | 'edits' | 'posts' | 'punchcards'

export default function ApprovalsTab({ currentUserId, onPendingChange }: Props) {
  const [open, setOpen] = useState<Section>('claims')
  const [claims, setClaims] = useState<Claim[]>([])
  const [edits, setEdits] = useState<EditSubmission[]>([])
  const [posts, setPosts] = useState<ShopPost[]>([])
  const [punchCards, setPunchCards] = useState<PunchCard[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<{ type: Section; id: string; name: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [approvedToken, setApprovedToken] = useState<string | null>(null)
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null)

  async function fetchAll() {
    setLoading(true)

    // Fetch claims WITHOUT the coffee_shops join so null shop_id rows are never filtered out
    const claimsRes = await supabase
      .from('shop_claims')
      .select('id,shop_id,user_id,status,created_at,claimant_name,claimant_email,claimant_role,message,new_shop_data')
      .eq('status', 'pending')
      .order('created_at')

    const rawClaims: Claim[] = (claimsRes.data as any) || []

    // For claims that have an existing shop_id, fetch shop details separately
    const existingShopIds = rawClaims.map(c => c.shop_id).filter(Boolean) as string[]
    let shopMap: Record<string, { name: string; is_verified: boolean; is_active: boolean }> = {}
    if (existingShopIds.length > 0) {
      const { data: shops } = await supabase
        .from('coffee_shops')
        .select('id,name,is_verified,is_active')
        .in('id', existingShopIds)
      if (shops) {
        for (const s of shops) shopMap[s.id] = s
      }
    }

    const mergedClaims = rawClaims.map(c => ({
      ...c,
      coffee_shops: c.shop_id ? (shopMap[c.shop_id] || null) : null,
      profiles: null,
    }))

    const [editsRes, postsRes, punchCardsRes] = await Promise.all([
      supabase.from('shop_edit_submissions').select('id,shop_id,submitted_by,status,field_changes,created_at,rejection_reason,coffee_shops(name),profiles(username)').eq('status', 'pending').order('created_at'),
      supabase.from('shop_posts').select('id,shop_id,owner_id,content,status,created_at,coffee_shops(name),profiles(username)').eq('status', 'pending').order('created_at'),
      supabase.from('punch_cards').select('id,shop_id,punches_required,reward_description,expiry_days,created_at,coffee_shops(name)').eq('is_active', false).is('approved_by', null).order('created_at'),
    ])
    setClaims(mergedClaims)
    setEdits((editsRes.data as any) || [])
    setPosts((postsRes.data as any) || [])
    setPunchCards((punchCardsRes.data as any) || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function approveClaim(claim: Claim) {
    setWorking(true)

    let shopId = claim.shop_id

    // New shop claim — create the shop now that admin has approved
    if (!shopId && claim.new_shop_data) {
      const nd = claim.new_shop_data
      const { data: newShop, error: shopErr } = await supabase
        .from('coffee_shops')
        .insert({
          name: nd.name,
          city: nd.city,
          state: nd.state || null,
          address: nd.address || null,
          website: nd.website || null,
          is_verified: true,
          is_active: true,
          avg_rating: 0,
          total_ratings: 0,
          weekly_visits: 0,
          vibes: [],
        })
        .select('id')
        .single()

      if (shopErr || !newShop) {
        alert('Failed to create shop. Please try again.')
        setWorking(false)
        return
      }
      shopId = newShop.id
    }

    const inviteToken = crypto.randomUUID()
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    await supabase.from('shop_claims').update({
      shop_id: shopId,
      status: 'invited',
      reviewed_by: currentUserId,
      reviewed_at: new Date().toISOString(),
      invite_token: inviteToken,
      invite_expires_at: expiry,
    }).eq('id', claim.id)

    // If claiming an existing shop that's inactive/unverified, activate it
    if (claim.shop_id) {
      const shopData = claim.coffee_shops as any
      const shopUpdates: Record<string, boolean> = {}
      if (!shopData?.is_active) shopUpdates.is_active = true
      if (!shopData?.is_verified) shopUpdates.is_verified = true
      if (Object.keys(shopUpdates).length > 0) {
        await supabase.from('coffee_shops').update(shopUpdates).eq('id', claim.shop_id)
      }
    }

    setApprovedToken(inviteToken)
    setWorking(false)
    fetchAll()
    onPendingChange()
  }

  async function rejectClaim(id: string) {
    setWorking(true)
    await supabase.from('shop_claims').update({
      status: 'rejected',
      reviewed_by: currentUserId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)
    setWorking(false)
    setRejectTarget(null)
    setRejectReason('')
    fetchAll()
    onPendingChange()
  }

  async function approveEdit(edit: EditSubmission) {
    setWorking(true)
    // Apply changes to coffee_shops
    const updates: Record<string, unknown> = {}
    for (const [field, change] of Object.entries(edit.field_changes)) {
      updates[field] = change.new
    }
    await supabase.from('coffee_shops').update(updates).eq('id', edit.shop_id)
    await supabase.from('shop_edit_submissions').update({
      status: 'approved',
      reviewed_by: currentUserId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', edit.id)
    setWorking(false)
    fetchAll()
    onPendingChange()
  }

  async function rejectEdit(id: string) {
    setWorking(true)
    await supabase.from('shop_edit_submissions').update({
      status: 'rejected',
      reviewed_by: currentUserId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectReason,
    }).eq('id', id)
    setWorking(false)
    setRejectTarget(null)
    setRejectReason('')
    fetchAll()
    onPendingChange()
  }

  async function approvePost(post: ShopPost) {
    setWorking(true)
    await supabase.from('shop_posts').update({
      status: 'approved',
      reviewed_by: currentUserId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', post.id)
    // Notify all followers of this shop about the new post
    const { data: followers } = await supabase
      .from('shop_follows').select('user_id').eq('shop_id', post.shop_id)
    if (followers && followers.length > 0) {
      await supabase.from('notifications').insert(
        followers.map((f: any) => ({
          user_id: f.user_id,
          actor_id: null,
          type: 'shop_post',
          rating_id: null,
          read: false,
        }))
      )
    }
    setWorking(false)
    fetchAll()
    onPendingChange()
  }

  async function rejectPost(id: string) {
    setWorking(true)
    await supabase.from('shop_posts').update({
      status: 'rejected',
      reviewed_by: currentUserId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: rejectReason,
    }).eq('id', id)
    setWorking(false)
    setRejectTarget(null)
    setRejectReason('')
    fetchAll()
    onPendingChange()
  }

  async function notifyShopOwner(shopId: string, type: 'punch_card_approved' | 'punch_card_rejected', data: Record<string, any>) {
    const { data: owner } = await supabase
      .from('shop_owners').select('profile_id').eq('shop_id', shopId).maybeSingle()
    if (owner?.profile_id) {
      await supabase.from('notifications').insert({
        user_id: owner.profile_id,
        actor_id: currentUserId,
        type,
        data,
      })
    }
  }

  async function approvePunchCard(card: PunchCard) {
    setWorking(true)
    await supabase.from('punch_cards').update({
      is_active: true,
      approved_by: currentUserId,
      approved_at: new Date().toISOString(),
    }).eq('id', card.id)
    await notifyShopOwner(card.shop_id, 'punch_card_approved', {
      shop_name: (card.coffee_shops as any)?.name,
      reward_description: card.reward_description,
    })
    setWorking(false)
    fetchAll()
    onPendingChange()
  }

  async function rejectPunchCard(id: string) {
    const card = punchCards.find(c => c.id === id)
    setWorking(true)
    await supabase.from('punch_cards').update({
      is_active: false,
      rejection_reason: rejectReason,
      approved_by: currentUserId,
      approved_at: new Date().toISOString(),
    }).eq('id', id)
    if (card) {
      await notifyShopOwner(card.shop_id, 'punch_card_rejected', {
        shop_name: (card.coffee_shops as any)?.name,
        rejection_reason: rejectReason || null,
      })
    }
    setWorking(false)
    setRejectTarget(null)
    setRejectReason('')
    fetchAll()
    onPendingChange()
  }

  function handleRejectConfirm() {
    if (!rejectTarget) return
    if (rejectTarget.type === 'claims') rejectClaim(rejectTarget.id)
    else if (rejectTarget.type === 'edits') rejectEdit(rejectTarget.id)
    else if (rejectTarget.type === 'punchcards') rejectPunchCard(rejectTarget.id)
    else rejectPost(rejectTarget.id)
  }

  const sections: { id: Section; label: string; count: number }[] = [
    { id: 'claims', label: 'Shop Claims', count: claims.length },
    { id: 'edits', label: 'Edit Submissions', count: edits.length },
    { id: 'posts', label: 'Shop Posts', count: posts.length },
    { id: 'punchcards', label: 'Punch Cards', count: punchCards.length },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Approvals</h1>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setOpen(s.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5
              ${open === s.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {s.label}
            {s.count > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {s.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <SkeletonTable rows={4} cols={4} />
        </div>
      ) : (
        <>
          {/* Claims */}
          {open === 'claims' && (
            <div className="space-y-2">
              {claims.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400">No pending claims</div>
              ) : claims.map(claim => {
                const isNewShop = !claim.shop_id && !!claim.new_shop_data
                const shopName = isNewShop ? claim.new_shop_data!.name : ((claim.coffee_shops as any)?.name || '—')
                return (
                  <button
                    key={claim.id}
                    onClick={() => setSelectedClaim(claim)}
                    className="w-full text-left bg-white rounded-xl border border-gray-100 p-4 hover:border-caramel/40 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-medium text-gray-900 text-sm">{shopName}</p>
                          {isNewShop
                            ? <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-full">New shop</span>
                            : !(claim.coffee_shops as any)?.is_verified && (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 rounded-full">Unverified</span>
                            )
                          }
                        </div>
                        <p className="text-xs text-gray-500">{claim.claimant_name} · {claim.claimant_email}</p>
                        <p className="text-xs text-gray-400">{claim.claimant_role} · {new Date(claim.created_at).toLocaleDateString()}</p>
                        {claim.message && <p className="text-xs text-gray-400 mt-1 italic line-clamp-1">"{claim.message}"</p>}
                      </div>
                      <span className="text-xs text-gray-300 group-hover:text-caramel transition-colors flex-shrink-0 mt-0.5">View →</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Edit submissions */}
          {open === 'edits' && (
            <div className="space-y-2">
              {edits.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400">No pending edits</div>
              ) : edits.map(edit => (
                <div key={edit.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{(edit.coffee_shops as any)?.name || edit.shop_id}</p>
                      <p className="text-xs text-gray-500 mt-0.5">By @{(edit.profiles as any)?.username || edit.submitted_by}</p>
                      <p className="text-xs text-gray-300 mt-0.5">{new Date(edit.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => setRejectTarget({ type: 'edits', id: edit.id, name: (edit.coffee_shops as any)?.name || '' })} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Reject</button>
                      <button onClick={() => approveEdit(edit)} disabled={working} className="px-3 py-1.5 text-xs font-medium text-white bg-caramel rounded-lg hover:bg-caramel/90 disabled:opacity-50">Approve</button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(edit.field_changes || {}).map(([field, change]) => (
                      <div key={field} className="text-xs bg-gray-50 rounded-lg p-2.5">
                        <p className="font-semibold text-gray-600 capitalize mb-1.5">{field.replace(/_/g, ' ')}</p>
                        <div className="flex gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-400 mb-0.5">Before</p>
                            <p className="text-red-500 line-through break-words">{String(change.old) || '—'}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-400 mb-0.5">After</p>
                            <p className="text-green-600 break-words">{String(change.new) || '—'}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Shop posts */}
          {open === 'posts' && (
            <div className="space-y-2">
              {posts.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400">No pending posts</div>
              ) : posts.map(post => (
                <div key={post.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-sm">{(post.coffee_shops as any)?.name || post.shop_id}</p>
                      <p className="text-xs text-gray-500 mt-0.5">By @{(post.profiles as any)?.username || post.owner_id} · {new Date(post.created_at).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{post.content}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => setRejectTarget({ type: 'posts', id: post.id, name: (post.coffee_shops as any)?.name || '' })} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Reject</button>
                      <button onClick={() => approvePost(post)} disabled={working} className="px-3 py-1.5 text-xs font-medium text-white bg-caramel rounded-lg hover:bg-caramel/90 disabled:opacity-50">Approve</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Punch card configs */}
          {open === 'punchcards' && (
            <div className="space-y-2">
              {punchCards.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400">No pending punch card configs</div>
              ) : punchCards.map(card => (
                <div key={card.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{(card.coffee_shops as any)?.name || card.shop_id}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-xs font-semibold text-caramel">{card.punches_required} punches required</span>
                        {card.expiry_days && <span className="text-xs text-gray-400">Expires {card.expiry_days}d after earn</span>}
                      </div>
                      <p className="text-sm text-gray-700 mt-1.5">🎁 {card.reward_description}</p>
                      <p className="text-xs text-gray-300 mt-1">{new Date(card.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => setRejectTarget({ type: 'punchcards', id: card.id, name: (card.coffee_shops as any)?.name || '' })} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Reject</button>
                      <button onClick={() => approvePunchCard(card)} disabled={working} className="px-3 py-1.5 text-xs font-medium text-white bg-caramel rounded-lg hover:bg-caramel/90 disabled:opacity-50">Approve</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Claim detail panel ─────────────────────────────────── */}
      {selectedClaim && (() => {
        const c = selectedClaim
        const isNewShop = !c.shop_id && !!c.new_shop_data
        const shopName = isNewShop ? c.new_shop_data!.name : ((c.coffee_shops as any)?.name || '—')
        return (
          <div className="fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div className="flex-1 bg-black/40" onClick={() => setSelectedClaim(null)} />
            {/* Panel */}
            <div className="w-full max-w-md bg-white h-full overflow-y-auto flex flex-col shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
                <div>
                  <h2 className="font-semibold text-gray-900 text-base">{shopName}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Shop claim · {new Date(c.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <button onClick={() => setSelectedClaim(null)} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 text-sm">✕</button>
              </div>

              <div className="flex-1 px-5 py-4 space-y-5">
                {/* Shop info */}
                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Shop</p>
                  <div className={`rounded-xl p-3 space-y-1.5 ${isNewShop ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{shopName}</p>
                      {isNewShop
                        ? <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full">NEW — not yet created</span>
                        : <span className="px-1.5 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 rounded-full">Existing shop</span>
                      }
                    </div>
                    {isNewShop && c.new_shop_data && (
                      <>
                        {(c.new_shop_data.city || c.new_shop_data.state) && (
                          <p className="text-xs text-gray-600">📍 {[c.new_shop_data.city, c.new_shop_data.state].filter(Boolean).join(', ')}</p>
                        )}
                        {c.new_shop_data.address && (
                          <p className="text-xs text-gray-600">🏠 {c.new_shop_data.address}</p>
                        )}
                        {c.new_shop_data.website && (
                          <p className="text-xs text-gray-600">🌐{' '}
                            <a href={c.new_shop_data.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{c.new_shop_data.website}</a>
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </section>

                {/* Claimant info */}
                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Claimant</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <Row label="Name" value={c.claimant_name || '—'} />
                    <Row label="Email" value={c.claimant_email || '—'} copyable />
                    <Row label="Role" value={c.claimant_role || '—'} />
                  </div>
                </section>

                {/* Message */}
                {c.message && (
                  <section>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Their message</p>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-sm text-gray-700 leading-relaxed italic">"{c.message}"</p>
                    </div>
                  </section>
                )}

                {/* Meta */}
                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Submission</p>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    <Row label="Submitted" value={new Date(c.created_at).toLocaleString()} />
                    <Row label="Status" value="Pending review" />
                    <Row label="Claim ID" value={c.id} mono />
                  </div>
                </section>
              </div>

              {/* Action buttons */}
              <div className="px-5 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white">
                <button
                  onClick={() => {
                    setSelectedClaim(null)
                    setRejectTarget({ type: 'claims', id: c.id, name: shopName })
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-medium text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => { setSelectedClaim(null); approveClaim(c) }}
                  disabled={working}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-caramel hover:bg-caramel/90 disabled:opacity-50 transition-colors"
                >
                  {working ? 'Approving…' : '✓ Approve'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Approved token toast */}
      {approvedToken && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl max-w-sm w-full mx-4">
          <p className="text-xs font-medium mb-1">✅ Claim approved — send this invite link (expires 7 days):</p>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs font-mono flex-1 truncate text-amber-300">{window.location.origin}/portal/invite?token={approvedToken}</code>
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/portal/invite?token=${approvedToken}`)}
              className="text-xs text-gray-400 hover:text-white flex-shrink-0 border border-gray-600 rounded px-2 py-1"
            >
              Copy
            </button>
          </div>
          <button onClick={() => setApprovedToken(null)} className="mt-2 text-xs text-gray-500 hover:text-white">Dismiss</button>
        </div>
      )}

      {/* Reject confirm */}
      {rejectTarget && (
        <ConfirmModal
          title="Reject submission"
          message={`Reject this ${rejectTarget.type === 'claims' ? 'claim' : rejectTarget.type === 'edits' ? 'edit' : rejectTarget.type === 'punchcards' ? 'punch card config' : 'post'} for "${rejectTarget.name}"?`}
          confirmLabel="Reject"
          danger
          onConfirm={handleRejectConfirm}
          onCancel={() => { setRejectTarget(null); setRejectReason('') }}
          loading={working}
        >
          <textarea
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-red-200 resize-none"
            rows={3}
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
        </ConfirmModal>
      )}
    </div>
  )
}

// ── Small helper for detail panel rows ──────────────────────────────────────
function Row({ label, value, copyable, mono }: { label: string; value: string; copyable?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-gray-400 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-xs text-gray-800 text-right break-all ${mono ? 'font-mono text-[11px] text-gray-500' : ''}`}>{value}</span>
        {copyable && value !== '—' && (
          <button
            onClick={() => navigator.clipboard.writeText(value)}
            className="text-[10px] text-gray-300 hover:text-caramel flex-shrink-0 border border-gray-200 rounded px-1 py-0.5"
            title="Copy"
          >
            copy
          </button>
        )}
      </div>
    </div>
  )
}
