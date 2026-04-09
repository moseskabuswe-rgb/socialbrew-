const loadFeed = useCallback(async () => {
  if (!profile) return

  // Load who I follow
  const { data: followData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', profile.id)

  const followingSet = new Set((followData || []).map((f: any) => f.following_id))
  setFollowingIds(followingSet)

  // Load posts
  const { data } = await supabase
    .from('ratings')
    .select('*, profiles(*), coffee_shops(*)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (data) {
    const filtered = data.filter((r: any) => {
      const authorId = r.profiles?.id
      const isPrivate = r.profiles?.is_private

      // 1. Always show your own posts
      if (authorId === profile.id) return true

      // 2. Treat NULL as public (THIS IS THE FIX)
      if (isPrivate === false || isPrivate === null || isPrivate === undefined) return true

      // 3. If private, only show if following
      return followingSet.has(authorId)
    })

    setRatings(filtered)
  }

  setLoading(false)
}, [profile])
