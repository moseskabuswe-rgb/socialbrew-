import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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
