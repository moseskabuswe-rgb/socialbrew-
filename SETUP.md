# Social Brew — Setup & Deployment Guide

Follow these steps in order. Each step takes about 5 minutes.
You do not need to understand code to do any of this.

---

## STEP 1 — Create Your Supabase Project (the database)

1. Go to https://supabase.com and sign up for a free account
2. Click "New Project"
3. Name it: `social-brew`
4. Choose a strong database password (save it somewhere)
5. Select region: US East (closest to Illinois)
6. Click "Create new project" — wait about 2 minutes for it to set up

---

## STEP 2 — Set Up the Database

1. In your Supabase dashboard, click "SQL Editor" in the left sidebar
2. Click "New query"
3. Open the file `supabase-schema.sql` from this project folder
4. Copy ALL the contents and paste into the SQL editor
5. Click "Run" (the green button)
6. You should see "Success. No rows returned" — that means it worked
7. The database is now set up with all tables AND pre-loaded with 6 Bloomington-Normal coffee shops

---

## STEP 3 — Get Your Supabase Keys

1. In Supabase, click "Project Settings" (gear icon, bottom left)
2. Click "API"
3. Copy these two values — you'll need them in Step 4:
   - **Project URL** (looks like: https://xxxxxxxxxxxx.supabase.co)
   - **anon public key** (long string starting with "eyJ...")

---

## STEP 4 — Connect the App to Your Database

1. In your project folder, find the file called `.env.example`
2. Make a copy of it and rename the copy to `.env`
3. Open `.env` and replace the placeholder values:

```
VITE_SUPABASE_URL=https://your-actual-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
```

Save the file.

---

## STEP 5 — Push to GitHub

1. Go to https://github.com and create a new repository
2. Name it: `social-brew`
3. Set it to Private
4. Open Terminal (Mac) or Command Prompt (Windows) in your project folder
5. Run these commands one at a time:

```bash
git init
git add .
git commit -m "Initial Social Brew build"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/social-brew.git
git push -u origin main
```

Replace YOUR_USERNAME with your actual GitHub username.

---

## STEP 6 — Deploy to Vercel (makes it live on the internet)

1. Go to https://vercel.com and sign up with your GitHub account
2. Click "Add New Project"
3. Find and select your `social-brew` repository
4. Click "Import"
5. Before clicking Deploy, click "Environment Variables" and add:
   - Name: `VITE_SUPABASE_URL` / Value: your Supabase project URL
   - Name: `VITE_SUPABASE_ANON_KEY` / Value: your Supabase anon key
6. Click "Deploy"
7. Wait about 1 minute
8. Vercel gives you a URL like: `social-brew-xyz.vercel.app`

That URL IS your app. Send it to anyone.

---

## STEP 7 — Install on Your Phone as a PWA

**iPhone:**
1. Open Safari (must be Safari, not Chrome)
2. Go to your Vercel URL
3. Tap the Share button (box with arrow pointing up)
4. Scroll down and tap "Add to Home Screen"
5. Tap "Add"
6. Social Brew now appears on your home screen like a real app

**Android:**
1. Open Chrome
2. Go to your Vercel URL
3. Tap the three dots menu
4. Tap "Add to Home screen"
5. Tap "Add"

---

## STEP 8 — Create Your Admin Account

1. Open the app and sign up with your email
2. In Supabase SQL Editor, run this to make yourself admin:

```sql
UPDATE profiles SET role = 'admin' WHERE username = 'your_username_here';
```

Replace `your_username_here` with whatever username you signed up with.

---

## STEP 9 — Set Up Posthog (usage tracking)

1. Go to https://posthog.com — free up to 1 million events/month
2. Sign up and create a project
3. They give you a snippet to add — let your developer or Claude know
   and we'll wire it in together in the next session.

---

## What's Already in the App

✅ Full authentication (signup, login, logout)
✅ Email verification banner
✅ Home feed with Top Tasters leaderboard
✅ Mug rating mechanic with color psychology (blue → amber → caramel → espresso)
✅ Vibe tags (Cozy, Warm, Loved, Quiet, Social, Date Night...)
✅ Shop selector (only independent shops, no chains)
✅ Discover tab with vibe filtering and search
✅ City Pulse / Trending tab with Spotlight + Movers & Shakers
✅ Profile tab with Coffee Sips history + Coffee Map placeholder
✅ Token rewards system (10 tokens per rating)
✅ Badge progression (Coffee Lover → Regular → Connoisseur → Brew Master)
✅ Gift a Drink and Order Ahead buttons (visible, marked Coming Soon)
✅ Bottom navigation with centered Brew button
✅ PWA manifest (installable on home screen)
✅ Vercel deployment config
✅ 6 pre-loaded Bloomington-Normal coffee shops

---

## Next Steps (future sessions)

- [ ] Posthog analytics integration
- [ ] Photo upload for Share Moment (Supabase Storage)
- [ ] Comments on posts
- [ ] Follow / unfollow users
- [ ] Push notifications
- [ ] Real interactive map (Mapbox or Google Maps)
- [ ] Custom domain (socialbrew.app)
- [ ] Admin dashboard for managing shops

---

## If Something Breaks

Tell Claude exactly what you see on screen — the error message, which tab you're on,
what you tried to do. You don't need to understand the code. Just describe what happened
and we'll fix it together.
