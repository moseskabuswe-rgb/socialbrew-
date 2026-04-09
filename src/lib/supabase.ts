import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://euxyleckowsfuyzgximo.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1eHlsZWNrb3dzZnV5emd4aW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MTM3OTksImV4cCI6MjA5MDQ4OTc5OX0.ldXAqGq4o1L4aTTCL_rBE8GqcVjnzcV6iRP064U9pFs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Profile = {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  role: 'consumer' | 'business' | 'admin'
  email_verified: boolean
  tokens: number
  badge: string
  created_at: string
}

export type CoffeeShop = {
  id: string
  name: string
  address: string
  city: string
  state: string
  lat: number
  lng: number
  photo_url: string | null
  description: string | null
  vibes: string[]
  avg_rating: number
  total_ratings: number
  weekly_visits: number
  is_certified: boolean
}

export type Rating = {
  id: string
  user_id: string
  shop_id: string
  fill_level: number
  drink_name: string | null
  photo_url: string | null
  vibe_tags: string[]
  caption: string | null
  likes_count: number
  comments_count: number
  created_at: string
  profiles?: Profile
  coffee_shops?: CoffeeShop
}
