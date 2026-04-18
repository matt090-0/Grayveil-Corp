// Grayveil PWA Service Worker
// Strategy:
//   - Navigations: network-first with offline.html fallback
//   - Hashed build assets (/assets/*): cache-first (immutable)
//   - Brand/static assets: stale-while-revalidate
//   - Supabase / API: pass-through (always network)
// Updates: new SW installs but waits — client sends SKIP_WAITING when user accepts.

const VERSION = 'v5'
const RUNTIME_CACHE = `grayveil-runtime-${VERSION}`
const STATIC_CACHE  = `grayveil-static-${VERSION}`
const CORE_ASSETS = [
  '/',
  '/offline.html',
  '/favicon.svg',
  '/manifest.json',
  '/brand/icon.png',
  '/brand/background.png',
  '/brand/logo.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(CORE_ASSETS).catch(() => {}))
  )
  // One-time auto-skip: recover clients stuck on a prior SW that cached
  // HTML (Vercel's SPA fallback) in place of /assets/*.js during a deploy
  // race. Holding back for a user banner click is pointless when the app
  // can't boot to show the banner.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Cross-origin: only touch Google Fonts CSS, pass everything else (Supabase, gstatic, etc.)
  if (url.origin !== self.location.origin) {
    if (url.host === 'fonts.googleapis.com') {
      event.respondWith(staleWhileRevalidate(request))
    }
    return
  }

  // Navigation requests — network first, fallback to cached / offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(r => r || caches.match('/offline.html'))
      )
    )
    return
  }

  // Hashed build assets — cache-first, immutable, but validate MIME
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstValidated(request, RUNTIME_CACHE, url.pathname))
    return
  }

  // Brand / favicon / manifest — stale-while-revalidate
  if (
    url.pathname.startsWith('/brand/') ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
    return
  }
})

async function cacheFirst(request, cacheName = RUNTIME_CACHE) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  try {
    const res = await fetch(request)
    if (res && res.status === 200) cache.put(request, res.clone())
    return res
  } catch {
    return cached || Response.error()
  }
}

// Same as cacheFirst but rejects (and evicts) any cached response whose
// Content-Type disagrees with the request path. This guards against a
// prior SW cycle that cached Vercel's SPA fallback (text/html) for a
// /assets/*.js URL during a brief deploy race — once that happens the
// cache-first branch would keep returning HTML for the JS forever,
// producing "Failed to load module script: ... MIME type text/html".
function expectedMime(pathname) {
  if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) return 'javascript'
  if (pathname.endsWith('.css')) return 'css'
  return null
}
function hasAcceptableType(res, expected) {
  if (!expected) return true
  const ct = (res.headers.get('content-type') || '').toLowerCase()
  return ct.includes(expected)
}
async function cacheFirstValidated(request, cacheName, pathname) {
  const cache = await caches.open(cacheName)
  const expected = expectedMime(pathname)
  const cached = await cache.match(request)
  if (cached && hasAcceptableType(cached, expected)) return cached
  if (cached) await cache.delete(request)
  try {
    const res = await fetch(request)
    if (res && res.status === 200 && hasAcceptableType(res, expected)) {
      cache.put(request, res.clone())
    }
    return res
  } catch {
    return Response.error()
  }
}

async function staleWhileRevalidate(request, cacheName = RUNTIME_CACHE) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const networkPromise = fetch(request).then(res => {
    if (res && res.status === 200) cache.put(request, res.clone())
    return res
  }).catch(() => null)
  return cached || networkPromise || Response.error()
}
