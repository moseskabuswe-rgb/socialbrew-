import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import ShopPostCard from './ShopPostCard'
import ShopDetailPage from '../shared/ShopDetailPage'

interface Props {
  profileId: string | null
}

interface Post {
  id: string
  shop_id: string
  title: string
  body: string
  photo_url: string | null
  category: string
  created_at: string
  approved_at: string | null
  coffee_shops: {
    id: string
    name: string
    city: string | null
    state: string | null
    photo_url: string | null
  } | null
}

export default function ShopsFeed({ profileId }: Props) {
  const [posts, setPosts] = useState<Post[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [selectedShop, setSelectedShop] = useState<any>(null)

  useEffect(() => {
    async function load() {
      // Load approved shop posts from followed shops (or all if not logged in)
      let postQuery = supabase
        .from('shop_posts')
        .select('id,shop_id,title,body,photo_url,category,created_at,approved_at,coffee_shops(id,name,city,state,photo_url)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(40)

      if (profileId) {
        // Filter to shops the user follows
        const { data: follows } = await supabase
          .from('shop_follows')
          .select('shop_id')
          .eq('user_id', profileId)
        const followedIds = (follows || []).map((f: any) => f.shop_id)
        if (followedIds.length > 0) {
          postQuery = postQuery.in('shop_id', followedIds)
        }
        // Also load liked post IDs
        const { data: liked } = await supabase
          .from('shop_post_likes')
          .select('post_id')
          .eq('user_id', profileId)
        setLikedIds(new Set((liked || []).map((l: any) => l.post_id)))
      }

      const { data } = await postQuery
      const loadedPosts = (data as any) || []
      setPosts(loadedPosts)

      // Load like counts for loaded posts
      if (loadedPosts.length > 0) {
        const postIds = loadedPosts.map((p: any) => p.id)
        const { data: counts } = await supabase
          .from('shop_post_likes')
          .select('post_id')
          .in('post_id', postIds)
        if (counts) {
          const countMap: Record<string, number> = {}
          counts.forEach((c: any) => { countMap[c.post_id] = (countMap[c.post_id] || 0) + 1 })
          setLikeCounts(countMap)
        }
      }

      setLoading(false)
    }
    load()
  }, [profileId])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 rounded-full border-2 border-caramel border-t-transparent animate-spin" />
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-16 px-8">
        <p className="text-4xl mb-3">☕</p>
        <p className="text-coffee-700 font-display text-lg">No shop posts yet</p>
        <p className="text-coffee-400 text-sm mt-2 leading-relaxed">
          Follow shops to see their updates here.{'\n'}Discover shops in the Discover tab.
        </p>
      </div>
    )
  }

  return (
    <div className="pt-2 pb-6">
      {posts.map(post => (
        <ShopPostCard
          key={post.id}
          post={post}
          likedByMe={likedIds.has(post.id)}
          likeCount={likeCounts[post.id] || 0}
          profileId={profileId}
          onShopClick={shop => setSelectedShop(shop)}
        />
      ))}
      {selectedShop && (
        <ShopDetailPage
          shop={selectedShop}
          onBack={() => setSelectedShop(null)}
        />
      )}
    </div>
  )
}
