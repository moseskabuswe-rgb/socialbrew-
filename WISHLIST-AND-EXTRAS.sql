-- ============================================================
-- SOCIAL BREW - Wishlist + Block + Report tables
-- Run in Supabase SQL Editor
-- ============================================================

-- WISHLIST
CREATE TABLE IF NOT EXISTS wishlist (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  drink_name text NOT NULL,
  shop_name text,
  notes text,
  is_fulfilled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Wishlists are public" ON wishlist FOR SELECT USING (true);
CREATE POLICY "Users manage own wishlist" ON wishlist FOR ALL USING (auth.uid() = user_id);

-- BLOCKS
CREATE TABLE IF NOT EXISTS blocks (
  blocker_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own blocks" ON blocks FOR ALL USING (auth.uid() = blocker_id);

-- REPORTS
CREATE TABLE IF NOT EXISTS reports (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  reporter_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating_id uuid REFERENCES ratings(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Allow deleting own ratings
DROP POLICY IF EXISTS "Users can delete their own ratings" ON ratings;
CREATE POLICY "Users can delete their own ratings" ON ratings FOR DELETE USING (auth.uid() = user_id);

-- Allow updating likes_count and comments_count
DROP POLICY IF EXISTS "Anyone can update comment counts" ON ratings;
CREATE POLICY "Users can update any rating counts" ON ratings FOR UPDATE USING (true);
