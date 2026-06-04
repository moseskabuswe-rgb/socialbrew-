import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import ReportViewer from './ReportViewer'

interface TierFeatures {
  tier: string
  effective_tier: string
  report_monthly: boolean
  report_weekly: boolean
  report_consistency: boolean
  report_custom: boolean
  punch_card_limit: number
  priority_discover: boolean
  founding_expires_at: string | null
}

interface Props {
  shop: { id: string; name: string; city: string | null }
  userId: string
}

type ReportType = 'monthly' | 'weekly' | 'consistency' | 'custom'

const REPORT_CARDS: { type: ReportType; icon: string; name: string; description: string; tierRequired: string }[] = [
  { type: 'monthly', icon: '📅', name: 'Monthly Insights', description: 'A full breakdown of last month.', tierRequired: '' },
  { type: 'weekly', icon: '📊', name: 'Weekly Insights', description: 'Your week at a glance.', tierRequired: 'Middle ($34.99/mo)' },
  { type: 'consistency', icon: '🎯', name: 'Consistency Score', description: 'How consistent is your drink quality?', tierRequired: 'Premium ($74.99/mo)' },
  { type: 'custom', icon: '📈', name: 'Custom Report', description: 'Choose your window.', tierRequired: 'Premium ($74.99/mo)' },
]

export default function PortalReports({ shop, userId }: Props) {
  const [features, setFeatures] = useState<TierFeatures | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeReport, setActiveReport] = useState<ReportType | null>(null)
  const [customMonths, setCustomMonths] = useState(1)
  const [requestModal, setRequestModal] = useState<ReportType | null>(null)
  const [requestMessage, setRequestMessage] = useState('')
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const [requestDone, setRequestDone] = useState<Set<ReportType>>(new Set())

  useEffect(() => {
    supabase.rpc('get_shop_tier_features', { p_shop_id: shop.id }).then(({ data }) => {
      setFeatures(data as TierFeatures)
      setLoading(false)
    })
  }, [shop.id])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!features) return null

  function canAccess(type: ReportType): boolean {
    if (!features) return false
    if (type === 'monthly') return features.report_monthly
    if (type === 'weekly') return features.report_weekly
    if (type === 'consistency') return features.report_consistency
    if (type === 'custom') return features.report_custom
    return false
  }

  function FoundingBanner() {
    if (!features || !features.founding_expires_at) return null
    const expires = new Date(features.founding_expires_at)
    const daysLeft = Math.ceil((expires.getTime() - Date.now()) / 86400000)

    // Expired founding — function returns tier:'basic' but founding_expires_at is still set and in the past
    if (daysLeft <= 0) {
      return (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
          Your Founding period ended. You now have Basic access. Contact us to continue.
        </div>
      )
    }
    // Active founding, expiring within 30 days
    if (features.tier === 'founding' && daysLeft <= 30) {
      return (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700">
          Your Founding Partner period ends {expires.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Choose a plan to keep full access.
        </div>
      )
    }
    return null
  }

  async function submitRequest(type: ReportType) {
    setRequestSubmitting(true)
    await supabase.from('shop_addon_requests').insert({
      shop_id: shop.id,
      profile_id: userId,
      request_type: `report_${type}`,
      message: requestMessage,
      status: 'pending',
    })
    setRequestSubmitting(false)
    setRequestDone(s => new Set([...s, type]))
    setRequestModal(null)
    setRequestMessage('')
  }

  if (activeReport) {
    return (
      <ReportViewer
        shopId={shop.id}
        shopName={shop.name}
        shopCity={shop.city ?? undefined}
        reportType={activeReport}
        monthsBack={customMonths}
        onClose={() => setActiveReport(null)}
      />
    )
  }

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="font-display text-2xl font-bold text-coffee-900 mb-1">Reports</h1>
      <p className="text-coffee-400 text-sm mb-5">Insights from your customers' visits.</p>

      <FoundingBanner />

      <div className="space-y-3">
        {REPORT_CARDS.map(card => {
          const accessible = canAccess(card.type)
          const done = requestDone.has(card.type)
          return (
            <div key={card.type} className="bg-white border border-cream-200 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-2xl leading-none mt-0.5">{card.icon}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-coffee-800 text-sm">{card.name}</p>
                    <p className="text-coffee-400 text-xs mt-0.5">{card.description}</p>
                    {card.type === 'custom' && accessible && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="text-xs text-coffee-500">Months back:</label>
                        <input
                          type="number"
                          min={1}
                          max={24}
                          value={customMonths}
                          onChange={e => setCustomMonths(Math.min(24, Math.max(1, Number(e.target.value))))}
                          className="w-16 border border-cream-200 rounded-lg px-2 py-1 text-xs text-coffee-800 focus:outline-none focus:border-caramel"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  {accessible ? (
                    <button
                      onClick={() => setActiveReport(card.type)}
                      className="bg-caramel text-white text-xs font-semibold px-3 py-1.5 rounded-xl active:scale-95 transition-transform whitespace-nowrap"
                    >
                      Generate →
                    </button>
                  ) : (
                    <>
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap">
                        {card.tierRequired}
                      </span>
                      <button
                        disabled={done}
                        onClick={() => !done && setRequestModal(card.type)}
                        className="text-caramel text-xs font-medium underline disabled:opacity-50 disabled:no-underline"
                      >
                        {done ? 'Requested ✓' : 'Request Access'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {requestModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end"
          onClick={e => e.target === e.currentTarget && setRequestModal(null)}
        >
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
            <p className="font-display font-bold text-coffee-800 text-lg mb-1">Request Access</p>
            <p className="text-coffee-400 text-sm mb-4">
              You're requesting{' '}
              <span className="text-coffee-700 font-medium">
                {REPORT_CARDS.find(c => c.type === requestModal)?.name}
              </span>
              . We'll review and be in touch.
            </p>
            <textarea
              value={requestMessage}
              onChange={e => setRequestMessage(e.target.value)}
              placeholder="Tell us a bit about your shop and what you're hoping to learn..."
              rows={4}
              className="w-full border border-cream-200 rounded-2xl px-4 py-3 text-sm text-coffee-800 focus:outline-none focus:border-caramel resize-none mb-4"
            />
            <button
              disabled={requestSubmitting}
              onClick={() => submitRequest(requestModal)}
              className="w-full bg-caramel text-white font-semibold rounded-2xl py-3 text-sm disabled:opacity-50 active:scale-95 transition-transform"
            >
              {requestSubmitting ? 'Sending...' : "We'll be in touch soon ☕"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
