const APP_SHELL_CACHE = 'app-shell-v2'
const RUNTIME_CACHE = 'runtime-v2'
const PRECACHE_ROUTES = [
  '/',
  '/offline.html',
  '/favicon.ico',
  '/manifest.json',
  '/chambers/add',
  '/chambers/add?embed=1',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      cache.addAll(PRECACHE_ROUTES),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('app-shell-') || key.startsWith('runtime-'))
          .filter((key) => key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ),
  )
  self.clients.claim()
})

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.status === 200) {
    cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Navigation: try network, then cached shell, then offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(request)
          const cache = await caches.open(APP_SHELL_CACHE)
          cache.put(request, network.clone())
          return network
        } catch (err) {
          const cache = await caches.open(APP_SHELL_CACHE)
          const cached = (await cache.match(request)) || (await cache.match('/'))
          if (cached) return cached
          const offline = await cache.match('/offline.html')
          return offline || Response.error()
        }
      })(),
    )
    return
  }

  // Same-origin assets: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE))
    return
  }

  // For cross-origin, just let it pass through
})
