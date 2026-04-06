// ─────────────────────────────────────────────────────────
// Social Brew Service Worker
// Strategy: Cache First, Network Fallback
// Update mechanism: Self-destruct on new version detection
// ─────────────────────────────────────────────────────────

// INCREMENT THIS VERSION STRING every time you push to GitHub.
// The SW checks this against what's cached — if it differs,
// it clears all caches and forces every client to hard reload.
// Format: YYYY-MM-DD.N  (e.g. 2025-04-06.2 for second deploy today)
const VERSION = '2025-04-06.1';
const CACHE_NAME = `social-brew-v${VERSION}`;

// Assets to pre-cache on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
];

// ── INSTALL ──────────────────────────────────────────────
// Pre-cache the app shell immediately
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      // Skip waiting — activate immediately without waiting
      // for existing clients to close
      return self.skipWaiting();
    })
  );
});

// ── ACTIVATE ─────────────────────────────────────────────
// Delete ALL old caches when a new SW takes over.
// This is the self-destruct: any cache that doesn't match
// current VERSION is wiped, forcing fresh asset loads.
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${VERSION} — purging old caches`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => {
      // Take control of all open clients immediately
      return self.clients.claim();
    }).then(() => {
      // Tell all open tabs/windows to reload so they get fresh code
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          // Only reload if the page is already loaded (not mid-navigation)
          if (client.url && 'navigate' in client) {
            console.log(`[SW] Signaling client to reload: ${client.url}`);
            client.postMessage({ type: 'SW_UPDATED', version: VERSION });
          }
        });
      });
    })
  );
});

// ── FETCH: CACHE FIRST, NETWORK FALLBACK ─────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  // Let API calls, Supabase, analytics, external resources pass through
  if (
    request.method !== 'GET' ||
    !url.origin === self.location.origin ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('posthog.com') ||
    url.hostname.includes('overpass-api.de') ||
    url.hostname.includes('openstreetmap.org') ||
    url.hostname.includes('unsplash.com')
  ) {
    return; // Let it go to the network unintercepted
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Cache hit — return immediately, then update in background
        // (stale-while-revalidate for non-HTML assets)
        if (!request.url.endsWith('.html') && !request.url.endsWith('/')) {
          fetchAndCache(request); // background refresh
        }
        return cachedResponse;
      }

      // Cache miss — fetch from network and cache the result
      return fetchAndCache(request);
    }).catch(() => {
      // Both cache and network failed — return offline fallback
      if (request.destination === 'document') {
        return caches.match('/index.html');
      }
    })
  );
});

async function fetchAndCache(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log(`[SW] Network fetch failed for: ${request.url}`);
    throw error;
  }
}

// ── MESSAGE HANDLER ───────────────────────────────────────
// Listen for messages from the app (e.g. manual cache clear)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
