// Grayveil PWA Service Worker
const CACHE_NAME = 'grayveil-v1'
const CORE_ASSETS = [
  '/',
  '/brand/icon.png',
  '/brand/background.png',
  '/favicon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Network-first for API/Supabase calls
  if (request.url.includes('supabase.co') || request.url.includes('/api/')) {
    return // let network handle it
  }

  // Cache-first for static assets
  if (request.method === 'GET' && (
    request.url.includes('/brand/') ||
    request.url.includes('/favicon') ||
    request.url.match(/\.(js|css|woff2?|png|jpg|svg)$/)
  )) {
    event.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(res => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          return res
        }).catch(() => cached)
      )
    )
  }
})
