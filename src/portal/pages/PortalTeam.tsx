import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Copy, Check, RefreshCw } from 'lucide-react'

interface Props {
  shop: { id: string; name: string }
  userId: string
}

interface Member {
  id: string
  email: string
  display_name: string
  portal_role: 'manager' | 'barista'
  status: 'invited' | 'active' | 'revoked'
  invite_token: string | null
  invite_expires_at: string | null
  created_at: string
  profile_id: string | null
}

const ROLE_DESCRIPTIONS = {
  manager: 'Can view dashboard, post updates, and use the scanner',
  barista: 'Can use the scanner only',
}

function roleBadge(role: 'manager' | 'barista') {
  return role === 'manager'
    ? 'bg-blue-100 text-blue-700 border border-blue-200'
    : 'bg-gray-100 text-gray-600 border border-gray-200'
}

function inviteUrl(token: string) {
  return `${window.location.origin}/portal/invite?token=${token}`
}

export default function PortalTeam({ shop, userId }: Props) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [showRevoked, setShowRevoked] = useState(false)

  // Invite form
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'manager' | 'barista'>('barista')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Revoke confirm
  const [revokeTarget, setRevokeTarget] = useState<Member | null>(null)
  const [revoking, setRevoking] = useState(false)

  // Role change confirm
  const [roleChangeTarget, setRoleChangeTarget] = useState<{ member: Member; newRole: 'manager' | 'barista' } | null>(null)
  const [changingRole, setChangingRole] = useState(false)

  useEffect(() => { load() }, [shop.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('shop_team_members')
      .select('id,email,display_name,portal_role,status,invite_token,invite_expires_at,created_at,profile_id')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: true })
    setMembers((data as Member[]) || [])
    setLoading(false)
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError('')
    if (!inviteName.trim()) { setInviteError('Please enter their name.'); return }
    if (!inviteEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) {
      setInviteError('Please enter a valid email address.')
      return
    }
    // Check already on team (non-revoked)
    const exists = members.find(m => m.email.toLowerCase() === inviteEmail.toLowerCase().trim() && m.status !== 'revoked')
    if (exists) { setInviteError('This person is already on your team.'); return }

    setInviting(true)
    const token = crypto.randomUUID()
    const expires = new Date(Date.now() + 7 * 86400000).toISOString()

    const { error } = await supabase.from('shop_team_members').insert({
      shop_id: shop.id,
      invited_by: userId,
      email: inviteEmail.trim().toLowerCase(),
      display_name: inviteName.trim(),
      portal_role: inviteRole,
      status: 'invited',
      invite_token: token,
      invite_expires_at: expires,
    })

    setInviting(false)
    if (error) { setInviteError(error.message); return }

    setNewInviteUrl(inviteUrl(token))
    setInviteName('')
    setInviteEmail('')
    setInviteRole('barista')
    load()
  }

  async function resendInvite(member: Member) {
    const token = crypto.randomUUID()
    const expires = new Date(Date.now() + 7 * 86400000).toISOString()
    await supabase.from('shop_team_members').update({
      invite_token: token,
      invite_expires_at: expires,
    }).eq('id', member.id)
    setNewInviteUrl(inviteUrl(token))
    load()
  }

  async function cancelInvite(member: Member) {
    await supabase.from('shop_team_members').delete().eq('id', member.id)
    load()
  }

  async function confirmRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    await Promise.all([
      supabase.from('shop_team_members').update({ status: 'revoked' }).eq('id', revokeTarget.id),
      revokeTarget.profile_id
        ? supabase.from('profiles').update({ team_shop_id: null, portal_role: null }).eq('id', revokeTarget.profile_id)
        : Promise.resolve(),
    ])
    setRevoking(false)
    setRevokeTarget(null)
    load()
  }

  async function confirmRoleChange() {
    if (!roleChangeTarget) return
    setChangingRole(true)
    const { member, newRole } = roleChangeTarget
    await supabase.from('shop_team_members').update({ portal_role: newRole }).eq('id', member.id)
    if (member.profile_id) {
      await supabase.from('profiles').update({ portal_role: newRole }).eq('id', member.profile_id)
    }
    setChangingRole(false)
    setRoleChangeTarget(null)
    load()
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const activeMembers = members.filter(m => m.status !== 'revoked')
  const revokedMembers = members.filter(m => m.status === 'revoked')

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-coffee-900">Your team</h1>
          <p className="text-sm text-coffee-400 mt-0.5">{shop.name}</p>
        </div>
        <button
          onClick={() => { setShowInviteForm(true); setNewInviteUrl(null) }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: '#c8853a' }}
        >
          <Plus size={15} /> Invite
        </button>
      </div>

      {/* Invite form modal */}
      {showInviteForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5">
            {newInviteUrl ? (
              <>
                <h2 className="font-semibold text-coffee-900 mb-1">Invite link ready</h2>
                <p className="text-sm text-coffee-500 mb-4">Send this link to your team member. It expires in 7 days.</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={newInviteUrl}
                    className="flex-1 text-xs bg-cream-50 border border-cream-200 rounded-xl px-3 py-2.5 text-coffee-600 outline-none"
                  />
                  <button
                    onClick={() => copyUrl(newInviteUrl)}
                    className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-semibold text-white flex-shrink-0"
                    style={{ background: '#c8853a' }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-coffee-400 mt-3">Email automation coming soon — for now, send this link manually.</p>
                <button
                  onClick={() => { setShowInviteForm(false); setNewInviteUrl(null) }}
                  className="mt-4 w-full py-2.5 rounded-xl border border-cream-200 text-sm text-coffee-600 hover:bg-cream-50"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-coffee-900">Invite team member</h2>
                  <button onClick={() => setShowInviteForm(false)} className="text-coffee-400 text-lg leading-none">×</button>
                </div>
                <form onSubmit={sendInvite} className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-coffee-600 mb-1">Their name</label>
                    <input
                      value={inviteName}
                      onChange={e => setInviteName(e.target.value)}
                      className="w-full bg-white text-coffee-800 rounded-xl px-4 py-2.5 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
                      placeholder="e.g. Alex"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-coffee-600 mb-1">Their email</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      className="w-full bg-white text-coffee-800 rounded-xl px-4 py-2.5 text-sm border border-cream-200 focus:border-caramel focus:outline-none"
                      placeholder="alex@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-coffee-600 mb-1">Role</label>
                    <div className="space-y-2">
                      {(['manager', 'barista'] as const).map(r => (
                        <label key={r} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${inviteRole === r ? 'border-caramel bg-caramel/5' : 'border-cream-200 hover:bg-cream-50'}`}>
                          <input type="radio" name="role" value={r} checked={inviteRole === r} onChange={() => setInviteRole(r)} className="mt-0.5 accent-caramel" />
                          <div>
                            <p className="text-sm font-semibold text-coffee-800 capitalize">{r}</p>
                            <p className="text-xs text-coffee-400">{ROLE_DESCRIPTIONS[r]}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  {inviteError && <p className="text-red-500 text-xs bg-red-50 rounded-xl px-3 py-2">{inviteError}</p>}
                  <button
                    type="submit"
                    disabled={inviting}
                    className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
                    style={{ background: '#c8853a' }}
                  >
                    {inviting ? 'Creating invite…' : 'Create invite link'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* New invite URL shown inline after resend */}
      {newInviteUrl && !showInviteForm && (
        <div className="bg-cream-50 border border-cream-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-coffee-600 mb-2">New invite link (expires in 7 days)</p>
          <div className="flex gap-2">
            <input readOnly value={newInviteUrl} className="flex-1 text-xs bg-white border border-cream-200 rounded-lg px-3 py-2 text-coffee-600 outline-none" />
            <button onClick={() => copyUrl(newInviteUrl)} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-white" style={{ background: '#c8853a' }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
        </div>
      ) : activeMembers.length === 0 ? (
        <div className="bg-white rounded-xl border border-cream-200 p-8 text-center">
          <p className="text-2xl mb-2">👥</p>
          <p className="text-sm font-medium text-coffee-600">No team members yet</p>
          <p className="text-xs text-coffee-400 mt-1">Invite a manager or barista to give them portal access.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-cream-200 divide-y divide-cream-100">
          {activeMembers.map(m => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-cream-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-coffee-500">
                {m.display_name[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-coffee-800">{m.display_name}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${roleBadge(m.portal_role)}`}>{m.portal_role}</span>
                  {m.status === 'invited' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Awaiting signup</span>
                  )}
                </div>
                <p className="text-xs text-coffee-400 truncate mt-0.5">{m.email}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {m.status === 'active' && (
                  <>
                    <select
                      value={m.portal_role}
                      onChange={e => setRoleChangeTarget({ member: m, newRole: e.target.value as 'manager' | 'barista' })}
                      className="text-xs border border-cream-200 rounded-lg px-2 py-1.5 text-coffee-600 bg-white outline-none focus:border-caramel"
                    >
                      <option value="manager">Manager</option>
                      <option value="barista">Barista</option>
                    </select>
                    <button
                      onClick={() => setRevokeTarget(m)}
                      className="text-xs text-red-500 hover:underline px-2 py-1"
                    >
                      Remove
                    </button>
                  </>
                )}
                {m.status === 'invited' && (
                  <>
                    <button onClick={() => resendInvite(m)} className="text-xs text-caramel hover:underline flex items-center gap-1 px-2 py-1">
                      <RefreshCw size={10} /> Resend
                    </button>
                    <button onClick={() => cancelInvite(m)} className="text-xs text-coffee-400 hover:underline px-2 py-1">
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Former members */}
      {revokedMembers.length > 0 && (
        <div>
          <button onClick={() => setShowRevoked(v => !v)} className="text-xs text-coffee-400 hover:underline">
            {showRevoked ? 'Hide' : 'Show'} {revokedMembers.length} former member{revokedMembers.length !== 1 ? 's' : ''}
          </button>
          {showRevoked && (
            <div className="mt-2 bg-white rounded-xl border border-cream-200 divide-y divide-cream-100">
              {revokedMembers.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 opacity-50">
                  <div className="w-9 h-9 rounded-full bg-cream-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-coffee-400">
                    {m.display_name[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-coffee-600 line-through">{m.display_name}</p>
                    <p className="text-xs text-coffee-400">{m.email}</p>
                  </div>
                  <span className="text-[10px] text-coffee-400">Removed</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Revoke confirmation */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="font-semibold text-coffee-900 mb-2">Remove team member?</h3>
            <p className="text-sm text-coffee-500 mb-4">
              Remove <strong>{revokeTarget.display_name}</strong> from your team? They will immediately lose portal access.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setRevokeTarget(null)} className="flex-1 py-2.5 rounded-xl border border-cream-200 text-sm text-coffee-600">Cancel</button>
              <button onClick={confirmRevoke} disabled={revoking} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-40">
                {revoking ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role change confirmation */}
      {roleChangeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className="font-semibold text-coffee-900 mb-2">Change role?</h3>
            <p className="text-sm text-coffee-500 mb-1">
              Change <strong>{roleChangeTarget.member.display_name}</strong>'s role to <strong className="capitalize">{roleChangeTarget.newRole}</strong>?
            </p>
            <p className="text-xs text-coffee-400 mb-4">{ROLE_DESCRIPTIONS[roleChangeTarget.newRole]}</p>
            <div className="flex gap-2">
              <button onClick={() => setRoleChangeTarget(null)} className="flex-1 py-2.5 rounded-xl border border-cream-200 text-sm text-coffee-600">Cancel</button>
              <button onClick={confirmRoleChange} disabled={changingRole} className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40" style={{ background: '#c8853a' }}>
                {changingRole ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
