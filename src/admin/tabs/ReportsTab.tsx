import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import SkeletonTable from '../components/SkeletonTable'
import ConfirmModal from '../components/ConfirmModal'

interface Props {
  currentUserId: string
  onPendingChange: () => void
}

interface UserReport {
  id: string
  reporter_id: string
  rating_id: string
  reason: string
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  type: 'user'
  reporter_profile: { username: string } | null
  resolver_profile: { username: string } | null
  rating: {
    drink_name: string | null
    caption: string | null
    user_id: string
    profiles: { username: string } | null
  } | null
}

interface ShopPostReport {
  id: string
  reporter_id: string
  post_id: string
  reason: string
  resolved: boolean
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  type: 'shop'
  reporter_profile: { username: string } | null
  resolver_profile: { username: string } | null
  shop_post: {
    content: string
    owner_id: string
    profiles: { username: string } | null
  } | null
}

type AnyReport = UserReport | ShopPostReport
type FilterTab = 'open' | 'user' | 'shop' | 'resolved'

export default function ReportsTab({ currentUserId, onPendingChange }: Props) {
  const [filter, setFilter] = useState<FilterTab>('open')
  const [reports, setReports] = useState<AnyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [removeConfirm, setRemoveConfirm] = useState<AnyReport | null>(null)
  const [dismissConfirm, setDismissConfirm] = useState<AnyReport | null>(null)

  async function fetchReports() {
    setLoading(true)
    const [userRes, shopRes] = await Promise.all([
      supabase
        .from('reports')
        .select(`
          id, reporter_id, rating_id, reason, resolved, resolved_by, resolved_at, created_at,
          reporter_profile:profiles!reporter_id(username),
          resolver_profile:profiles!resolved_by(username),
          rating:ratings(drink_name, caption, user_id, profiles(username))
        `)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('shop_post_reports')
        .select(`
          id, reporter_id, post_id, reason, resolved, resolved_by, resolved_at, created_at,
          reporter_profile:profiles!reporter_id(username),
          resolver_profile:profiles!resolved_by(username),
          shop_post:shop_posts(content, owner_id, profiles(username))
        `)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    const userReports: AnyReport[] = ((userRes.data || []) as any[]).map((r: any) => ({ ...r, type: 'user' as const }))
    const shopReports: AnyReport[] = ((shopRes.data || []) as any[]).map((r: any) => ({ ...r, type: 'shop' as const }))
    const all = [...userReports, ...shopReports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setReports(all)
    setLoading(false)
  }

  useEffect(() => { fetchReports() }, [])

  function filtered() {
    if (filter === 'open') return reports.filter(r => !r.resolved)
    if (filter === 'user') return reports.filter(r => r.type === 'user' && !r.resolved)
    if (filter === 'shop') return reports.filter(r => r.type === 'shop' && !r.resolved)
    return reports.filter(r => r.resolved)
  }

  async function removeContent(report: AnyReport) {
    setWorking(true)
    if (report.type === 'user') {
      const ur = report as UserReport
      await supabase.from('ratings').delete().eq('id', ur.rating_id)
      await supabase.from('reports').update({ resolved: true, resolved_by: currentUserId, resolved_at: new Date().toISOString() }).eq('id', ur.id)
    } else {
      const sr = report as ShopPostReport
      await supabase.from('shop_posts').delete().eq('id', sr.post_id)
      await supabase.from('shop_post_reports').update({ resolved: true, resolved_by: currentUserId, resolved_at: new Date().toISOString() }).eq('id', sr.id)
    }
    setWorking(false)
    setRemoveConfirm(null)
    fetchReports()
    onPendingChange()
  }

  async function dismiss(report: AnyReport) {
    setWorking(true)
    const table = report.type === 'user' ? 'reports' : 'shop_post_reports'
    await supabase.from(table as any).update({ resolved: true, resolved_by: currentUserId, resolved_at: new Date().toISOString() }).eq('id', report.id)
    setWorking(false)
    setDismissConfirm(null)
    fetchReports()
    onPendingChange()
  }

  function reportTitle(r: AnyReport) {
    if (r.type === 'user') {
      const ur = r as UserReport
      return `Rating by @${(ur.rating as any)?.profiles?.username || 'unknown'}`
    } else {
      const sr = r as ShopPostReport
      return `Shop post by @${(sr.shop_post as any)?.profiles?.username || 'unknown'}`
    }
  }

  function reportPreview(r: AnyReport) {
    if (r.type === 'user') {
      const ur = r as UserReport
      return ur.rating?.caption || ur.rating?.drink_name || '—'
    } else {
      const sr = r as ShopPostReport
      return sr.shop_post?.content || '—'
    }
  }

  const displayedReports = filtered()
  const openCount = reports.filter(r => !r.resolved).length
  const resolvedCount = reports.filter(r => r.resolved).length

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'open', label: `Open (${openCount})` },
    { id: 'user', label: 'User posts' },
    { id: 'shop', label: 'Shop posts' },
    { id: 'resolved', label: `Resolved (${resolvedCount})` },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Reports</h1>
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${filter === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <SkeletonTable rows={5} cols={3} />
        </div>
      ) : displayedReports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 py-12 text-center text-sm text-gray-400">
          No reports here
        </div>
      ) : (
        <div className="space-y-3">
          {displayedReports.map(report => (
            <div
              key={`${report.type}-${report.id}`}
              className={`bg-white rounded-xl border p-4 ${report.resolved ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${report.type === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                      {report.type === 'user' ? 'Post' : 'Shop post'}
                    </span>
                    {report.resolved && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-100 text-green-700">Resolved</span>
                    )}
                  </div>
                  <p className="font-medium text-gray-900 text-sm">{reportTitle(report)}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{reportPreview(report)}</p>
                  <p className="text-xs text-amber-700 mt-1.5 bg-amber-50 rounded px-2 py-1 inline-block">
                    "{report.reason}"
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Reported by @{(report as any).reporter_profile?.username || '?'} · {new Date(report.created_at).toLocaleDateString()}
                  </p>
                  {report.resolved && report.resolved_at && (
                    <p className="text-xs text-gray-400">
                      Resolved by @{(report as any).resolver_profile?.username || '?'} · {new Date(report.resolved_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {!report.resolved && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setRemoveConfirm(report)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
                    >
                      Remove
                    </button>
                    <button
                      onClick={() => setDismissConfirm(report)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {removeConfirm && (
        <ConfirmModal
          title="Remove content"
          message="This will permanently delete the post and resolve the report. This cannot be undone."
          confirmLabel="Remove content"
          danger
          onConfirm={() => removeContent(removeConfirm)}
          onCancel={() => setRemoveConfirm(null)}
          loading={working}
        />
      )}

      {dismissConfirm && (
        <ConfirmModal
          title="Dismiss report"
          message="Mark this report as resolved without removing any content."
          confirmLabel="Dismiss"
          onConfirm={() => dismiss(dismissConfirm)}
          onCancel={() => setDismissConfirm(null)}
          loading={working}
        />
      )}
    </div>
  )
}
