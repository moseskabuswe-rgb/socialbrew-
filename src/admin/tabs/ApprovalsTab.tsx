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
  shop_id: string
  user_id: string
  status: string
  created_at: string
  coffee_shops: { name: string } | null
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

type Section = 'claims' | 'edits' | 'posts'

export default function ApprovalsTab({ currentUserId, onPendingChange }: Props) {
  const [open, setOpen] = useState<Section>('claims')
  const [claims, setClaims] = useState<Claim[]>([])
  const [edits, setEdits] = useState<EditSubmission[]>([])
  const [posts, setPosts] = useState<ShopPost[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<{ type: Section; id: string; name: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [approvedToken, setApprovedToken] = useState<string | null>(null)

  async function fetchAll() {
    setLoading(true)
    const [claimsRes, editsRes, postsRes] = await Promise.all([
      supabase.from('shop_claims').select('id,shop_id,user_id,status,created_at,coffee_shops(name),profiles(username)').eq('status', 'pending').order('created_at'),
      supabase.from('shop_edit_submissions').select('id,shop_id,submitted_by,status,field_changes,created_at,rejection_reason,coffee_shops(name),profiles(username)').eq('status', 'pending').order('created_at'),
      supabase.from('shop_posts').select('id,shop_id,owner_id,content,status,created_at,coffee_shops(name),profiles(username)').eq('status', 'pending').order('created_at'),
    ])
    setClaims((claimsRes.data as any) || [])
    setEdits((editsRes.data as any) || [])
    setPosts((postsRes.data as any) || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function approveClaim(claim: Claim) {
    setWorking(true)
    const inviteToken = crypto.randomUUID()
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    await supabase.from('shop_claims').update({
      status: 'approved',
      reviewed_by: currentUserId,
      reviewed_at: new Date().toISOString(),
      invite_token: inviteToken,
      invite_expires_at: expiry,
    }).eq('id', claim.id)
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

  function handleRejectConfirm() {
    if (!rejectTarget) return
    if (rejectTarget.type === 'claims') rejectClaim(rejectTarget.id)
    else if (rejectTarget.type === 'edits') rejectEdit(rejectTarget.id)
    else rejectPost(rejectTarget.id)
  }

  const sections: { id: Section; label: string; count: number }[] = [
    { id: 'claims', label: 'Shop Claims', count: claims.length },
    { id: 'edits', label: 'Edit Submissions', count: edits.length },
    { id: 'posts', label: 'Shop Posts', count: posts.length },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Approvals</h1>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
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
            <div className="space-y-3">
              {claims.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400">No pending claims</div>
              ) : claims.map(claim => (
                <div key={claim.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{(claim.coffee_shops as any)?.name || claim.shop_id}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Claimed by @{(claim.profiles as any)?.username || claim.user_id}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(claim.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => setRejectTarget({ type: 'claims', id: claim.id, name: (claim.coffee_shops as any)?.name || '' })} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Reject</button>
                      <button onClick={() => approveClaim(claim)} disabled={working} className="px-3 py-1.5 text-xs font-medium text-white bg-caramel rounded-lg hover:bg-caramel/90 disabled:opacity-50">Approve</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Edit submissions */}
          {open === 'edits' && (
            <div className="space-y-3">
              {edits.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400">No pending edits</div>
              ) : edits.map(edit => (
                <div key={edit.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{(edit.coffee_shops as any)?.name || edit.shop_id}</p>
                      <p className="text-xs text-gray-500 mt-0.5">By @{(edit.profiles as any)?.username || edit.submitted_by}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => setRejectTarget({ type: 'edits', id: edit.id, name: (edit.coffee_shops as any)?.name || '' })} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Reject</button>
                      <button onClick={() => approveEdit(edit)} disabled={working} className="px-3 py-1.5 text-xs font-medium text-white bg-caramel rounded-lg hover:bg-caramel/90 disabled:opacity-50">Approve</button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(edit.field_changes || {}).map(([field, change]) => (
                      <div key={field} className="text-xs bg-gray-50 rounded-lg p-2">
                        <p className="font-medium text-gray-600 capitalize mb-1">{field}</p>
                        <div className="flex gap-3">
                          <span className="text-red-500 line-through flex-1">{String(change.old) || '—'}</span>
                          <span className="text-green-600 flex-1">{String(change.new) || '—'}</span>
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
            <div className="space-y-3">
              {posts.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 py-10 text-center text-sm text-gray-400">No pending posts</div>
              ) : posts.map(post => (
                <div key={post.id} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{(post.coffee_shops as any)?.name || post.shop_id}</p>
                      <p className="text-xs text-gray-500 mt-0.5">By @{(post.profiles as any)?.username || post.owner_id}</p>
                      <p className="text-sm text-gray-700 mt-2 line-clamp-3">{post.content}</p>
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
        </>
      )}

      {/* Approved token toast */}
      {approvedToken && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl max-w-sm w-full mx-4">
          <p className="text-xs font-medium mb-1">Claim approved — invite token (7 days):</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono flex-1 truncate text-amber-300">{approvedToken}</code>
            <button
              onClick={() => { navigator.clipboard.writeText(approvedToken); }}
              className="text-xs text-gray-400 hover:text-white flex-shrink-0"
            >
              Copy
            </button>
          </div>
          <button onClick={() => setApprovedToken(null)} className="mt-2 text-xs text-gray-400 hover:text-white">Dismiss</button>
        </div>
      )}

      {/* Reject confirm */}
      {rejectTarget && (
        <ConfirmModal
          title="Reject submission"
          message={`Reject this ${rejectTarget.type === 'claims' ? 'claim' : rejectTarget.type === 'edits' ? 'edit' : 'post'} for "${rejectTarget.name}"?`}
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
