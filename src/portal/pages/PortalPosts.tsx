import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface Shop { id: string; name: string }
interface Props { shop: Shop; userId: string }

interface Post {
  id: string
  title: string
  body: string
  category: string
  status: string
  created_at: string
  rejection_reason: string | null
}

const CATEGORIES = ['Update', 'Promotion', 'Event', 'New menu item', 'Community']
const MAX_TITLE = 80
const MAX_BODY = 600

export default function PortalPosts({ shop }: Props) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  async function loadPosts() {
    setLoading(true)
    const { data } = await supabase
      .from('shop_posts')
      .select('id,title,body,category,status,created_at,rejection_reason')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }

  useEffect(() => { loadPosts() }, [shop.id])

  function validate() {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = 'Title is required'
    else if (title.trim().length > MAX_TITLE) e.title = `Max ${MAX_TITLE} characters`
    if (!body.trim()) e.body = 'Post content is required'
    if (!category) e.category = 'Please select a category'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setSubmitting(true)
    const { error } = await supabase.from('shop_posts').insert({
      shop_id: shop.id,
      title: title.trim(),
      body: body.trim(),
      category,
      status: 'pending',
    })
    setSubmitting(false)
    if (error) { setErrors({ submit: 'Something went wrong. Please try again.' }); return }
    setTitle('')
    setBody('')
    setCategory('')
    setShowForm(false)
    loadPosts()
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Shop Posts</h1>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: '#c8853a' }}
          >
            + New post
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">New post</p>
            <button type="button" onClick={() => { setShowForm(false); setErrors({}) }}
              className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-caramel/30">
              <option value="">Select...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value.slice(0, MAX_TITLE))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-caramel/30"
              placeholder="e.g. New seasonal latte is here!" />
            <p className="text-xs text-gray-400 text-right mt-0.5">{title.length}/{MAX_TITLE}</p>
            {errors.title && <p className="text-red-500 text-xs">{errors.title}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Content</label>
            <textarea value={body} onChange={e => setBody(e.target.value.slice(0, MAX_BODY))} rows={4}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-caramel/30 resize-none"
              placeholder="Share an update with your followers..." />
            <p className="text-xs text-gray-400 text-right mt-0.5">{body.length}/{MAX_BODY}</p>
            {errors.body && <p className="text-red-500 text-xs">{errors.body}</p>}
          </div>
          <p className="text-xs text-gray-400">Posts are reviewed before going live (usually same day).</p>
          {errors.submit && <p className="text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2">{errors.submit}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
            style={{ background: '#c8853a' }}>
            {submitting ? 'Submitting...' : 'Submit for review'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">📢</p>
          <p className="text-gray-500 text-sm">No posts yet. Share an update with your followers!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 leading-tight">{p.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.category} · {new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${statusColors[p.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  {p.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">{p.body}</p>
              {p.rejection_reason && (
                <p className="text-xs text-red-600 mt-2 bg-red-50 rounded-lg px-2 py-1">Reason: {p.rejection_reason}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
