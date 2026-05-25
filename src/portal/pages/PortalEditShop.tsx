import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface Shop {
  id: string
  name: string
  city: string | null
  state: string | null
  photo_url: string | null
}

interface Props {
  shop: Shop
  onShopUpdate: (shop: any) => void
}

interface Submission {
  id: string
  status: string
  proposed_changes: any
  created_at: string
  reviewed_at: string | null
  rejection_reason: string | null
}

const FIELDS = [
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'city', label: 'City', type: 'text' },
  { key: 'state', label: 'State', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'tel' },
  { key: 'website', label: 'Website', type: 'url' },
  { key: 'opening_hours', label: 'Opening hours', type: 'text' },
  { key: 'description', label: 'Description', type: 'textarea' },
]

export default function PortalEditShop({ shop }: Props) {
  const [current, setCurrent] = useState<any>({})
  const [draft, setDraft] = useState<any>({})
  const [history, setHistory] = useState<Submission[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('coffee_shops')
        .select('address,city,state,phone,website,opening_hours,description')
        .eq('id', shop.id)
        .single()
      if (data) { setCurrent(data); setDraft(data) }

      const { data: subs } = await supabase
        .from('shop_edit_submissions')
        .select('id,status,proposed_changes,created_at,reviewed_at,rejection_reason')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(5)
      setHistory(subs || [])
    }
    load()
  }, [shop.id])

  function hasChanges() {
    return FIELDS.some(f => (draft[f.key] ?? '') !== (current[f.key] ?? ''))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasChanges()) return
    setError('')
    setSubmitting(true)
    const proposed: any = {}
    FIELDS.forEach(f => { if ((draft[f.key] ?? '') !== (current[f.key] ?? '')) proposed[f.key] = draft[f.key] })
    const { data: { user } } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('shop_edit_submissions').insert({
      shop_id: shop.id,
      submitted_by: user?.id || null,
      proposed_changes: proposed,
      status: 'pending',
    })
    setSubmitting(false)
    if (err) { setError('Failed to submit. Please try again.'); return }
    setSuccess(true)
    // Reload history
    const { data: subs } = await supabase
      .from('shop_edit_submissions')
      .select('id,status,proposed_changes,created_at,reviewed_at,rejection_reason')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
      .limit(5)
    setHistory(subs || [])
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold text-gray-900">Edit Shop Info</h1>

      {success ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-green-800 font-semibold text-sm">Edit request submitted!</p>
          <p className="text-green-600 text-xs mt-1">We'll review it and update your shop within 1–2 business days.</p>
          <button onClick={() => setSuccess(false)} className="mt-3 text-xs text-caramel underline">Make another edit</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          {FIELDS.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              {f.type === 'textarea' ? (
                <textarea
                  value={draft[f.key] || ''}
                  onChange={e => setDraft((d: any) => ({ ...d, [f.key]: e.target.value }))}
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-caramel/30 resize-none"
                />
              ) : (
                <input
                  type={f.type}
                  value={draft[f.key] || ''}
                  onChange={e => setDraft((d: any) => ({ ...d, [f.key]: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-caramel/30"
                />
              )}
            </div>
          ))}
          {error && <p className="text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={submitting || !hasChanges()}
            className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
            style={{ background: '#c8853a' }}
          >
            {submitting ? 'Submitting...' : 'Submit changes for review'}
          </button>
        </form>
      )}

      {history.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-3">Recent edit requests</p>
          <div className="space-y-2">
            {history.map(sub => (
              <div key={sub.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${statusColors[sub.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {sub.status}
                  </span>
                  <span className="text-xs text-gray-400">{new Date(sub.created_at).toLocaleDateString()}</span>
                </div>
                <div className="space-y-1">
                  {Object.entries(sub.proposed_changes || {}).map(([k, v]) => (
                    <p key={k} className="text-xs text-gray-600"><span className="font-medium capitalize">{k.replace('_', ' ')}: </span>{String(v)}</p>
                  ))}
                </div>
                {sub.rejection_reason && (
                  <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg px-2 py-1">{sub.rejection_reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
