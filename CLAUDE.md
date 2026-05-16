# Social Brew — Claude Code Standing Instructions

## Who I am
Moses Kabuswe — solo non-technical founder of Social Brew.
I am not a developer. Plain language explanations are essential.

## What Social Brew is
A mobile-first PWA for independent coffee shop discovery and social sharing.
React + TypeScript + Tailwind CSS frontend. Supabase backend. Deployed via Cloudflare Pages → GitHub.
No chains (Starbucks, Dunkin, etc.) — independent shops only. This is a core brand value.

## CRITICAL RULES — follow these on every single task

### Before touching any file:
- Read the file completely first
- Tell me what you found, what line you're adding to, and what you're adding
- Wait for me to say "go ahead" before making changes (unless I've explicitly said to proceed automatically)

### Making changes:
- Additions only — do not remove, rewrite, restructure, or refactor existing code
- If a function already exists, add to it — never replace it
- If an import already exists, don't duplicate it
- Do not rename, move, or delete any files
- Do not change CSS classes, Tailwind classes, or styling unless explicitly asked
- Do not change Supabase queries, table names, or column names unless explicitly asked
- One file at a time — never batch-edit multiple files simultaneously

### After every single file change:
- Run npm run build immediately
- If build fails, revert that file before touching anything else
- Only move to the next file after a clean build

### Git — only when I say so:
- Never run git add . — only stage specific files that were changed
- List the exact files before staging
- Only commit and push when I explicitly say to

### If unsure about anything:
- Ask before guessing — wrong guesses have caused bugs before

---

## Tech stack
- React + TypeScript + Tailwind CSS
- Supabase — project ID: pifpkfuulfnweeiqufbq
- Cloudflare Pages (deployment, connected to GitHub)
- Firebase (push notifications) — project: social-brew-206d3
- PostHog (analytics)
- OpenStreetMap Overpass API + Nominatim (shop discovery)

## Storage
- All images in avatars bucket
- avatars/avatars/ — profile photos
- avatars/moments/ — post photos
- No photos bucket exists — do not upload there

## Files never to touch unless explicitly instructed:
- src/lib/supabase.ts
- src/lib/push.ts
- src/contexts/AuthContext.tsx
- src/App.tsx
- public/firebase-messaging-sw.js
- public/manifest.json
- src/components/home/HomeTab.tsx
- src/components/profile/ProfileTab.tsx
- src/components/shared/PostDetailModal.tsx
- src/components/shared/UserProfilePage.tsx
- src/components/trending/TrendingTab.tsx

## Key features to never break:
- Mug fill rating mechanic — brand signature
- Anonymous feedback modal for low ratings (≤50%)
- Badge progression system
- Multi-photo upload (up to 4) in MugRating
- Push notifications via Firebase FCM + Supabase Edge Function
- OSM shop discovery in DiscoverTab
- Drink search in DrinkSearchTab
- Price fields in ratings (drink_price, price_perception, show_price)

## Database columns in ratings table:
fill_level, drink_name, vibe_tags, caption, visit_time, visited_at,
photo_url, photo_urls, drink_price, price_perception, show_price,
is_quick_sip, user_id, shop_id, created_at
