import { useState } from 'react'
import { ArrowLeft, UserMinus } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Member {
  user_id: string | null
  profiles?: { id: string; username: string; avatar_url: string | null } | null
}

interface Props {
  conversationId: string
  conversationName: string | null
  members: Member[]
  currentUserId: string
  createdBy: string | null
  onBack: () => void
  onLeave: () => void
  onNameUpdated: (name: string) => void
}

export default function GroupSettings({
  conversationId,
  conversationName,
  members,
  currentUserId,
  createdBy,
  onBack,
  onLeave,
  onNameUpdated,
}: Props) {
  const [name, setName] = useState(conversationName || '')
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const isCreator = createdBy === currentUserId

  async function handleSaveName() {
    if (!name.trim() || saving) return
    setSaving(true)
    await supabase.from('conversations').update({ name: name.trim() }).eq('id', conversationId)
    onNameUpdated(name.trim())
    setSaving(false)
  }

  async function handleRemoveMember(userId: string) {
    if (!isCreator || userId === currentUserId) return
    await supabase.from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
  }

  async function handleLeave() {
    setLeaving(true)
    await supabase.from('conversation_members')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', currentUserId)
    setLeaving(false)
    onLeave()
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <button onClick={onBack} className="text-coffee-500 p-1">
          <ArrowLeft size={20} />
        </button>
        <p className="font-semibold text-coffee-800 text-sm flex-1">Group settings</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Group name */}
        <div className="px-4 py-4 border-b border-gray-100">
          <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Group name</label>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-caramel/30"
              placeholder="Group name"
            />
            <button
              onClick={handleSaveName}
              disabled={saving || name.trim() === conversationName || !name.trim()}
              className="px-3 py-2 rounded-xl text-white text-xs font-semibold disabled:opacity-40"
              style={{ background: '#c8853a' }}
            >
              {saving ? '...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Members */}
        <div className="px-4 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">{members.length} members</p>
          <div className="space-y-1">
            {members.map(m => {
              const profile = m.profiles as any
              const isCurrentUser = m.user_id === currentUserId
              const isCreatorMember = m.user_id === createdBy
              return (
                <div key={m.user_id} className="flex items-center gap-3 py-2">
                  <div className="w-9 h-9 rounded-full bg-amber-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-sm font-bold text-amber-700">{profile?.username?.[0]?.toUpperCase()}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">@{profile?.username || '?'}</p>
                    {(isCurrentUser || isCreatorMember) && (
                      <p className="text-xs text-gray-400">{isCurrentUser ? 'You' : ''}{isCurrentUser && isCreatorMember ? ' · ' : ''}{isCreatorMember ? 'Admin' : ''}</p>
                    )}
                  </div>
                  {isCreator && !isCurrentUser && (
                    <button
                      onClick={() => m.user_id && handleRemoveMember(m.user_id)}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1"
                    >
                      <UserMinus size={15} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 border-t border-gray-100 flex-shrink-0">
        <button
          onClick={handleLeave}
          disabled={leaving}
          className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40"
        >
          {leaving ? 'Leaving...' : 'Leave group'}
        </button>
      </div>
    </div>
  )
}
