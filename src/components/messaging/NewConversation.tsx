import { useState } from 'react'
import { ArrowLeft, Search, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface Profile {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
}

interface Props {
  currentUserId: string
  onConversationCreated: (conversationId: string, name: string | null, otherUser?: { username: string; avatar_url: string | null }) => void
  onBack: () => void
}

export default function NewConversation({ currentUserId, onConversationCreated, onBack }: Props) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [selected, setSelected] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleSearch(val: string) {
    setSearch(val)
    if (!val.trim() || val.trim().length < 2) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id,username,full_name,avatar_url')
      .ilike('username', `%${val.trim()}%`)
      .neq('id', currentUserId)
      .eq('is_portal_only', false)
      .limit(10)
    setResults(data || [])
    setSearching(false)
  }

  function toggleSelect(p: Profile) {
    setSelected(prev =>
      prev.some(s => s.id === p.id) ? prev.filter(s => s.id !== p.id) : [...prev, p]
    )
  }

  async function handleCreate() {
    if (selected.length === 0 || creating) return
    setCreating(true)
    const isGroup = selected.length > 1
    const convName = isGroup ? (groupName.trim() || selected.map(p => p.username).join(', ')) : null

    // Check if a 1:1 DM already exists
    if (!isGroup) {
      const { data: existing } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', currentUserId)
      const myConvIds = (existing || []).map((c: any) => c.conversation_id)

      if (myConvIds.length > 0) {
        const { data: shared } = await supabase
          .from('conversation_members')
          .select('conversation_id,conversations!inner(type)')
          .eq('user_id', selected[0].id)
          .in('conversation_id', myConvIds)
        const dm = (shared as any)?.find((c: any) => (c.conversations as any)?.type === 'dm')
        if (dm) {
          setCreating(false)
          onConversationCreated(dm.conversation_id, null, { username: selected[0].username, avatar_url: selected[0].avatar_url })
          return
        }
      }
    }

    // Create new conversation
    const { data: conv } = await supabase
      .from('conversations')
      .insert({
        type: isGroup ? 'group' : 'dm',
        name: convName,
        created_by: currentUserId,
      })
      .select('id')
      .single()

    if (!conv) { setCreating(false); return }

    // Add all members including current user
    const members = [
      { conversation_id: conv.id, user_id: currentUserId },
      ...selected.map(p => ({ conversation_id: conv.id, user_id: p.id })),
    ]
    await supabase.from('conversation_members').insert(members)

    setCreating(false)
    onConversationCreated(conv.id, convName, !isGroup ? { username: selected[0].username, avatar_url: selected[0].avatar_url } : undefined)
  }

  const isGroup = selected.length > 1

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <button onClick={onBack} className="text-coffee-500 p-1">
          <ArrowLeft size={20} />
        </button>
        <p className="font-semibold text-coffee-800 text-sm flex-1">New message</p>
        {selected.length > 0 && (
          <button
            onClick={handleCreate}
            disabled={creating}
            className="text-caramel text-sm font-semibold disabled:opacity-40"
          >
            {creating ? 'Creating...' : isGroup ? 'Create group' : 'Start chat'}
          </button>
        )}
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-gray-50">
          {selected.map(p => (
            <button
              key={p.id}
              onClick={() => toggleSelect(p)}
              className="flex items-center gap-1 bg-caramel/10 text-caramel px-2.5 py-1 rounded-full text-xs font-medium"
            >
              @{p.username}
              <X size={10} />
            </button>
          ))}
        </div>
      )}

      {/* Group name (only when 2+ people selected) */}
      {isGroup && (
        <div className="px-4 py-2 border-b border-gray-50">
          <input
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="Group name (optional)"
            className="w-full text-sm bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-caramel/30"
          />
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100">
        <Search size={15} className="text-gray-400 flex-shrink-0" />
        <input
          value={search}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Search people..."
          autoFocus
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
        />
        {searching && <div className="w-4 h-4 rounded-full border-2 border-caramel border-t-transparent animate-spin flex-shrink-0" />}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && search.length >= 2 && !searching && (
          <p className="text-center text-sm text-gray-400 py-8">No users found</p>
        )}
        {results.map(p => {
          const isSelected = selected.some(s => s.id === p.id)
          return (
            <button
              key={p.id}
              onClick={() => toggleSelect(p)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-caramel/5' : ''}`}
            >
              <div className="w-9 h-9 rounded-full bg-amber-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-sm font-bold text-amber-700">{p.username[0]?.toUpperCase()}</span>
                }
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-800">@{p.username}</p>
                {p.full_name && <p className="text-xs text-gray-400 truncate">{p.full_name}</p>}
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-caramel flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs">✓</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
