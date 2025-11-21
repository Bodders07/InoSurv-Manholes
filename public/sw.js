const APP_SHELL_CACHE = 'app-shell-v3'
const RUNTIME_CACHE = 'runtime-v3'
const PRECACHE_ROUTES = [
  '/',
  '/offline.html',
  '/favicon.ico',
  '/manifest.json',
  '/chambers/add',
  '/chambers/add?embed=1',
  '/manholes/add',
  '/manholes/add?embed=1',
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
          // Try exact match, then ignore search (handles ?embed=1), then no trailing slash, then root, then offline
          const pathNoSlash = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname
          const cached =
            (await cache.match(request)) ||
            (await cache.match(url.pathname, { ignoreSearch: true })) ||
            (await cache.match(pathNoSlash, { ignoreSearch: true })) ||
            (await cache.match('/')) ||
            (await cache.match('/offline.html'))
          if (cached) return cached
          return Response.error()
        }
      })(),
    )
    return
  }

  // Same-origin assets: cache-first with small runtime cache
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE))
    return
  }

  // For cross-origin, just let it pass through
})
