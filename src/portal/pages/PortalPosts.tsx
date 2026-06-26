import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { compressPhoto } from '../../lib/compressImage'

interface Shop { id: string; name: string }
interface Props { shop: Shop; userId: string }

interface Post {
  id: string
  title: string
  body: string
  photo_url: string | null
  category: string
  status: string
  created_at: string
  updated_at: string
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

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null)
  const [editOriginalPhotoUrl, setEditOriginalPhotoUrl] = useState<string | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const editFileInputRef = useRef<HTMLInputElement>(null)

  // Delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function loadPosts() {
    setLoading(true)
    const { data } = await supabase
      .from('shop_posts')
      .select('id,title,body,photo_url,category,status,created_at,updated_at')
      .eq('shop_id', shop.id)
      .order('created_at', { ascending: false })
    setPosts(data || [])
    setLoading(false)
  }

  useEffect(() => { loadPosts() }, [shop.id])

  // ── New post helpers ───────────────────────────────────────────────────────
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
      const compressed = await compressPhoto(imageFile).catch(() => imageFile)
      const ext = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${shop.id}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('shop-posts')
        .upload(path, compressed, { upsert: true, contentType: compressed.type })
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('shop-posts').getPublicUrl(path)
        photoUrl = publicUrl
      }
    }

    const { data: newPost, error } = await supabase.from('shop_posts').insert({
      shop_id: shop.id,
      title: title.trim(),
      body: body.trim(),
      photo_url: photoUrl,
      category,
      status: 'approved',
      approved_at: new Date().toISOString(),
    }).select('id').single()
    setSubmitting(false)
    if (error) { setErrors({ submit: error.message || 'Something went wrong. Please try again.' }); return }

    if (newPost) {
      const { data: followers } = await supabase
        .from('shop_follows')
        .select('user_id')
        .eq('shop_id', shop.id)
      if (followers && followers.length > 0) {
        await supabase.from('notifications').insert(
          followers.map((f: any) => ({
            user_id: f.user_id,
            actor_id: null,
            type: 'shop_post',
            data: { shop_id: shop.id, shop_name: shop.name, post_id: newPost.id, post_title: title.trim() },
          }))
        )
      }
    }
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

  // ── Edit helpers ───────────────────────────────────────────────────────────
  function startEdit(post: Post) {
    setEditingId(post.id)
    setEditTitle(post.title)
    setEditBody(post.body || '')
    setEditCategory(post.category)
    setEditImageFile(null)
    setEditImagePreview(post.photo_url)
    setEditOriginalPhotoUrl(post.photo_url)
    setEditErrors({})
  }

  function cancelEdit() {
    setEditingId(null)
    setEditImageFile(null)
    setEditImagePreview(null)
    setEditOriginalPhotoUrl(null)
    setEditErrors({})
  }

  function onEditImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEditImageFile(file)
    setEditImagePreview(URL.createObjectURL(file))
  }

  function clearEditImage() {
    setEditImageFile(null)
    setEditImagePreview(null)
    if (editFileInputRef.current) editFileInputRef.current.value = ''
  }

  async function handleEditSave(post: Post) {
    const errs: Record<string, string> = {}
    if (!editTitle.trim()) errs.title = 'Title is required'
    if (!editBody.trim()) errs.body = 'Content is required'
    if (!editCategory) errs.category = 'Category is required'
    if (Object.keys(errs).length) { setEditErrors(errs); return }

    setEditSubmitting(true)

    let photoUrl: string | null = editOriginalPhotoUrl

    if (editImageFile) {
      const compressed = await compressPhoto(editImageFile).catch(() => editImageFile)
      const ext = editImageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${shop.id}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('shop-posts')
        .upload(path, compressed, { upsert: true, contentType: compressed.type })
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('shop-posts').getPublicUrl(path)
        photoUrl = publicUrl
      }
    } else if (editImagePreview === null && editOriginalPhotoUrl) {
      // Photo was removed by the user
      photoUrl = null
    }

    const { error } = await supabase
      .from('shop_posts')
      .update({
        title: editTitle.trim(),
        body: editBody.trim(),
        category: editCategory,
        photo_url: photoUrl,
        // Re-queue for review if previously approved
        status: post.status === 'approved' ? 'pending' : post.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id)

    setEditSubmitting(false)
    if (error) { setEditErrors({ submit: error.message || 'Could not save changes.' }); return }
    cancelEdit()
    loadPosts()
  }

  // ── Delete helpers ─────────────────────────────────────────────────────────
  async function handleDelete(post: Post) {
    setDeleting(true)
    if (post.photo_url) {
      try {
        const marker = '/storage/v1/object/public/shop-posts/'
        const idx = post.photo_url.indexOf(marker)
        if (idx !== -1) {
          const storagePath = post.photo_url.slice(idx + marker.length)
          await supabase.storage.from('shop-posts').remove([storagePath])
        }
      } catch {}
    }
    await supabase.from('shop_posts').delete().eq('id', post.id)
    setDeleting(false)
    setConfirmDeleteId(null)
    loadPosts()
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

          {/* Photo upload with aspect-ratio preview */}
          <div>
            <label className="block text-xs font-medium text-coffee-600 mb-1">
              Photo <span className="text-coffee-400 font-normal">(optional)</span>
            </label>
            {imagePreview ? (
              <div className="relative w-full aspect-video overflow-hidden rounded-xl border border-cream-200">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
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
            <p className="text-xs text-coffee-400 mt-1">For best results, use landscape or square photos.</p>
          </div>

          <p className="text-xs text-coffee-400">Posts go live immediately.</p>
          {errors.submit && <p className="text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2">{errors.submit}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
            style={{ background: '#c8853a' }}>
            {submitting ? 'Posting...' : 'Post now'}
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
            <div key={p.id}>
              {editingId === p.id ? (
                /* ── Inline edit form ── */
                <div className="bg-white rounded-xl border-2 border-caramel/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-coffee-800">Edit post</p>
                    <button type="button" onClick={cancelEdit} className="text-xs text-coffee-400 hover:text-coffee-600">Cancel</button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-coffee-600 mb-1">Category</label>
                    <select value={editCategory} onChange={e => setEditCategory(e.target.value)}
                      className="w-full text-sm border border-cream-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-caramel/30 bg-cream-50">
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    {editErrors.category && <p className="text-red-500 text-xs mt-1">{editErrors.category}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-coffee-600 mb-1">Title</label>
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value.slice(0, MAX_TITLE))}
                      className="w-full text-sm border border-cream-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-caramel/30 bg-cream-50" />
                    <p className="text-xs text-coffee-400 text-right mt-0.5">{editTitle.length}/{MAX_TITLE}</p>
                    {editErrors.title && <p className="text-red-500 text-xs">{editErrors.title}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-coffee-600 mb-1">Content</label>
                    <textarea value={editBody} onChange={e => setEditBody(e.target.value.slice(0, MAX_BODY))} rows={4}
                      className="w-full text-sm border border-cream-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-caramel/30 resize-none bg-cream-50" />
                    <p className="text-xs text-coffee-400 text-right mt-0.5">{editBody.length}/{MAX_BODY}</p>
                    {editErrors.body && <p className="text-red-500 text-xs">{editErrors.body}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-coffee-600 mb-1">Photo</label>
                    {editImagePreview ? (
                      <div className="relative w-full aspect-video overflow-hidden rounded-xl border border-cream-200">
                        <img src={editImagePreview} alt="" className="w-full h-full object-cover" />
                        <button type="button" onClick={clearEditImage}
                          className="absolute top-2 right-2 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center text-xs">✕</button>
                      </div>
                    ) : (
                      <>
                        <input ref={editFileInputRef} type="file" accept="image/*" onChange={onEditImageChange} className="hidden" id="edit-post-image" />
                        <label htmlFor="edit-post-image"
                          className="flex items-center justify-center gap-2 w-full py-3 border border-dashed border-cream-300 rounded-xl text-xs text-coffee-500 cursor-pointer hover:bg-cream-50 transition-colors">
                          📷 Add a photo
                        </label>
                      </>
                    )}
                  </div>
                  {p.status === 'approved' && (
                    <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                      Editing an approved post will send it back for review before going live again.
                    </p>
                  )}
                  {editErrors.submit && <p className="text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2">{editErrors.submit}</p>}
                  <button onClick={() => handleEditSave(p)} disabled={editSubmitting}
                    className="w-full py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-40"
                    style={{ background: '#c8853a' }}>
                    {editSubmitting ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              ) : (
                /* ── Post card ── */
                <div className="bg-white rounded-xl border border-cream-200 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-coffee-800 leading-tight">{p.title}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <p className="text-xs text-coffee-400">
                          {CATEGORIES.find(c => c.value === p.category)?.label ?? p.category} · {new Date(p.created_at).toLocaleDateString()}
                        </p>
                        {p.status === 'pending' && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Pending review</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => startEdit(p)}
                        className="px-2.5 py-1 text-xs font-medium text-coffee-600 border border-cream-200 rounded-lg hover:bg-cream-50 transition-colors">
                        Edit
                      </button>
                      <button onClick={() => setConfirmDeleteId(p.id)}
                        className="px-2.5 py-1 text-xs font-medium text-red-500 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                  {p.photo_url && (
                    <div className="w-full aspect-video overflow-hidden rounded-lg mb-2 border border-cream-100">
                      <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <p className="text-sm text-coffee-600 leading-relaxed line-clamp-3">{p.body}</p>
                </div>
              )}

              {/* Delete confirmation */}
              {confirmDeleteId === p.id && (
                <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-red-700">Delete this post?</p>
                  <p className="text-xs text-red-500">This cannot be undone. The post and its photo will be permanently removed.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDeleteId(null)}
                      className="flex-1 py-2 rounded-xl text-sm font-medium text-coffee-600 bg-white border border-cream-200">
                      Cancel
                    </button>
                    <button onClick={() => handleDelete(p)} disabled={deleting}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 disabled:opacity-50">
                      {deleting ? 'Deleting...' : 'Yes, delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
