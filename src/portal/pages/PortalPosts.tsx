import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

interface Shop { id: string; name: string }
interface Props { shop: Shop; userId: string }

interface Post {
  id: string
  title: string
  body: string
  photo_url: string | null
  category: string
  created_at: string
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'update', label: 'Update' },
  { value: 'event', label: 'Event' },
  { value: 'menu', label: 'New menu item' },
  { value: 'special', label: 'Special' },
]
const MAX_TITLE = 80
const MAX_BODY = 600

export default function PortalPosts({ shop }: Props) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function loadPosts() {
    setLoading(true)
    const { data } = await supabase
      .from('shop_posts')
      .select('id,title,body,photo_url,category,created_at')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }

  useEffect(() => { loadPosts() }, [shop.id])

  function onImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

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

    let photoUrl: string | null = null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${shop.id}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('shop-posts')
        .upload(path, imageFile, { upsert: true, contentType: imageFile.type })
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('shop-posts').getPublicUrl(path)
        photoUrl = publicUrl
      }
    }

    const { error } = await supabase.from('shop_posts').insert({
      shop_id: shop.id,
      title: title.trim(),
      body: body.trim(),
      photo_url: photoUrl,
      category,
      status: 'approved',
    })
    setSubmitting(false)
    if (error) { setErrors({ submit: error.message || 'Something went wrong. Please try again.' }); return }
    setTitle('')
    setBody('')
    setCategory('')
    clearImage()
    setShowForm(false)
    loadPosts()
  }

  function cancelForm() {
    setShowForm(false)
    setErrors({})
    clearImage()
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-coffee-900">Shop Posts</h1>
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
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-cream-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-coffee-800">New post</p>
            <button type="button" onClick={cancelForm} className="text-xs text-coffee-400 hover:text-coffee-600">Cancel</button>
          </div>
          <div>
            <label className="block text-xs font-medium text-coffee-600 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full text-sm border border-cream-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-caramel/30 bg-cream-50">
              <option value="">Select...</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-coffee-600 mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value.slice(0, MAX_TITLE))}
              className="w-full text-sm border border-cream-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-caramel/30 bg-cream-50"
              placeholder="e.g. New seasonal latte is here!" />
            <p className="text-xs text-coffee-400 text-right mt-0.5">{title.length}/{MAX_TITLE}</p>
            {errors.title && <p className="text-red-500 text-xs">{errors.title}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-coffee-600 mb-1">Content</label>
            <textarea value={body} onChange={e => setBody(e.target.value.slice(0, MAX_BODY))} rows={4}
              className="w-full text-sm border border-cream-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-caramel/30 resize-none bg-cream-50"
              placeholder="Share an update with your followers..." />
            <p className="text-xs text-coffee-400 text-right mt-0.5">{body.length}/{MAX_BODY}</p>
            {errors.body && <p className="text-red-500 text-xs">{errors.body}</p>}
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-xs font-medium text-coffee-600 mb-1">
              Photo <span className="text-coffee-400 font-normal">(optional)</span>
            </label>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-xl border border-cream-200" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs"
                >✕</button>
              </div>
            ) : (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageChange} className="hidden" id="post-image" />
                <label
                  htmlFor="post-image"
                  className="flex items-center justify-center gap-2 w-full py-3 border border-dashed border-cream-300 rounded-xl text-xs text-coffee-500 cursor-pointer hover:bg-cream-50 transition-colors"
                >
                  📷 Add a photo
                </label>
              </>
            )}
          </div>

          <p className="text-xs text-coffee-400">Posts go live immediately.</p>
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
          <p className="text-coffee-500 text-sm">No posts yet. Share an update with your followers!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-cream-200 p-4">
              <div className="mb-2">
                <p className="text-sm font-semibold text-coffee-800 leading-tight">{p.title}</p>
                <p className="text-xs text-coffee-400 mt-0.5">{CATEGORIES.find(c => c.value === p.category)?.label ?? p.category} · {new Date(p.created_at).toLocaleDateString()}</p>
              </div>
              {p.photo_url && (
                <img src={p.photo_url} alt="" className="w-full h-36 object-cover rounded-lg mb-2 border border-cream-100" />
              )}
              <p className="text-sm text-coffee-600 leading-relaxed line-clamp-3">{p.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
