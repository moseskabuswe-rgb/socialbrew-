import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface Shop { id: string; name: string }
interface Props { shop: Shop }

interface Rating {
  id: string
  fill_level: number
  drink_name: string | null
  caption: string | null
  vibe_tags: string[]
  created_at: string
  profiles: { username: string; avatar_url: string | null } | null
}

const PAGE = 20

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

function FillBar({ fill }: { fill: number }) {
  const color = fill >= 80 ? '#4e2008' : fill >= 60 ? '#7a3e10' : fill >= 40 ? '#a06428' : fill >= 20 ? '#c8924a' : '#b0c4d4'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${fill}%`, background: color }} />
      </div>
      <span className="text-xs text-gray-600 font-medium">{fill}%</span>
    </div>
  )
}

export default function PortalMentions({ shop }: Props) {
  const [ratings, setRatings] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, count } = await supabase
        .from('ratings')
        .select('id,fill_level,drink_name,caption,vibe_tags,created_at,profiles!ratings_user_id_fkey(username,avatar_url)', { count: 'exact' })
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1)
      setRatings((data as any) || [])
      setTotal(count || 0)
      setLoading(false)
    }
    load()
  }, [shop.id, page])

  const totalPages = Math.ceil(total / PAGE)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Reviews</h1>
        <span className="text-sm text-gray-400">{total.toLocaleString()} total</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
        </div>
      ) : ratings.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">☕</p>
          <p className="text-gray-500 text-sm">No reviews yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ratings.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-full bg-amber-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {r.profiles?.avatar_url
                    ? <img src={r.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-sm font-bold text-amber-700">{r.profiles?.username?.[0]?.toUpperCase()}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">@{r.profiles?.username || 'user'}</p>
                  <p className="text-xs text-gray-400">{timeAgo(r.created_at)}</p>
                </div>
                <FillBar fill={r.fill_level} />
              </div>
              {r.drink_name && <p className="text-xs text-gray-500 mb-1">☕ {r.drink_name}</p>}
              {r.vibe_tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {r.vibe_tags.map(v => (
                    <span key={v} className="bg-amber-50 border border-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs">{v}</span>
                  ))}
                </div>
              )}
              {r.caption && <p className="text-sm text-gray-600 italic">"{r.caption}"</p>}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Prev</button>
          <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
        </div>
      )}
    </div>
  )
}
