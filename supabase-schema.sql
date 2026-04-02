-- ============================================
-- SOCIAL BREW - Supabase Database Schema
-- Run this entire file in your Supabase SQL editor
-- ============================================

create extension if not exists "uuid-ossp";

-- PROFILES
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  full_name text,
  avatar_url text,
  bio text,
  role text not null default 'consumer' check (role in ('consumer', 'business', 'admin')),
  email_verified boolean default false,
  tokens integer default 0,
  badge text default 'Coffee Lover',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Public profiles are viewable by everyone" on profiles for select using (true);
create policy "Users can update their own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert their own profile" on profiles for insert with check (auth.uid() = id);

-- COFFEE SHOPS
create table coffee_shops (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  address text,
  city text,
  state text,
  lat double precision,
  lng double precision,
  photo_url text,
  description text,
  vibes text[] default '{}',
  avg_rating double precision default 0,
  total_ratings integer default 0,
  weekly_visits integer default 0,
  is_certified boolean default false,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table coffee_shops enable row level security;
create policy "Coffee shops viewable by everyone" on coffee_shops for select using (true);
create policy "Only admins can insert shops" on coffee_shops for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);
create policy "Only admins can update shops" on coffee_shops for update using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Seed Bloomington-Normal coffee shops
insert into coffee_shops (name, address, city, state, lat, lng, photo_url, vibes, avg_rating, total_ratings, weekly_visits, is_certified) values
('Coffeehouse & Bar', '112 E Beaufort St', 'Normal', 'IL', 40.5142, -88.9906, 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800', '{"Cozy","Social","Date Night"}', 4.7, 234, 312, true),
('Medici', '120 W North St', 'Normal', 'IL', 40.5156, -88.9912, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800', '{"Cozy","Date Night","Social"}', 4.8, 412, 567, true),
('Common Ground Food Co-op', '516 N Main St', 'Bloomington', 'IL', 40.4842, -88.9937, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800', '{"Social","Quiet"}', 4.5, 167, 203, true),
('The Beanery', '211 N Main St', 'Bloomington', 'IL', 40.4851, -88.9941, 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800', '{"Cozy","Quiet"}', 4.3, 156, 189, false),
('Hy-Vee Market Cafe', '1511 E College Ave', 'Normal', 'IL', 40.5089, -88.9756, 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800', '{"Quiet","Cozy"}', 4.2, 89, 145, false),
('Lexington Coffee', '312 W Main St', 'Lexington', 'IL', 40.6417, -88.7873, 'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800', '{"Quiet","Date Night"}', 4.6, 98, 134, false);

-- RATINGS (shop_id nullable to allow Share Moment posts)
create table ratings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  shop_id uuid references coffee_shops(id) on delete set null,
  fill_level integer not null default 50 check (fill_level between 0 and 100),
  drink_name text,
  photo_url text,
  vibe_tags text[] default '{}',
  caption text,
  likes_count integer default 0,
  comments_count integer default 0,
  created_at timestamptz default now()
);

alter table ratings enable row level security;
create policy "Ratings viewable by everyone" on ratings for select using (true);
create policy "Users can create their own ratings" on ratings for insert with check (auth.uid() = user_id);
create policy "Users can update their own ratings" on ratings for update using (auth.uid() = user_id);
create policy "Users can delete their own ratings" on ratings for delete using (auth.uid() = user_id);

-- LIKES
create table likes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  rating_id uuid references ratings(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, rating_id)
);

alter table likes enable row level security;
create policy "Likes viewable by everyone" on likes for select using (true);
create policy "Users can manage their own likes" on likes for all using (auth.uid() = user_id);

-- COMMENTS
create table comments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  rating_id uuid references ratings(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table comments enable row level security;
create policy "Comments viewable by everyone" on comments for select using (true);
create policy "Users can create comments" on comments for insert with check (auth.uid() = user_id);
create policy "Users can delete own comments" on comments for delete using (auth.uid() = user_id);

-- FOLLOWS
create table follows (
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

alter table follows enable row level security;
create policy "Follows viewable by everyone" on follows for select using (true);
create policy "Users can manage their own follows" on follows for all using (auth.uid() = follower_id);

-- USER SHOP VISITS
create table user_shop_visits (
  user_id uuid references profiles(id) on delete cascade not null,
  shop_id uuid references coffee_shops(id) on delete cascade not null,
  visit_count integer default 1,
  last_visited timestamptz default now(),
  primary key (user_id, shop_id)
);

alter table user_shop_visits enable row level security;
create policy "Visits viewable by everyone" on user_shop_visits for select using (true);
create policy "Users can manage their own visits" on user_shop_visits for all using (auth.uid() = user_id);

-- FUNCTION: Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, full_name, email_verified)
  values (
    new.id,
    split_part(new.email, '@', 1),
    new.raw_user_meta_data->>'full_name',
    new.email_confirmed_at is not null
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- FUNCTION: Update shop stats + award tokens on new rating
create or replace function update_shop_rating()
returns trigger as $$
begin
  if new.shop_id is not null then
    update coffee_shops set
      avg_rating = (
        select round(avg(fill_level::float / 20)::numeric, 1)
        from ratings where shop_id = new.shop_id
      ),
      total_ratings = (select count(*) from ratings where shop_id = new.shop_id),
      weekly_visits = weekly_visits + 1
    where id = new.shop_id;

    insert into user_shop_visits (user_id, shop_id, visit_count, last_visited)
    values (new.user_id, new.shop_id, 1, now())
    on conflict (user_id, shop_id) do update set
      visit_count = user_shop_visits.visit_count + 1,
      last_visited = now();
  end if;

  update profiles set tokens = tokens + 10 where id = new.user_id;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_rating_created
  after insert on ratings
  for each row execute procedure update_shop_rating();
