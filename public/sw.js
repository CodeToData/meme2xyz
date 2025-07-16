// Service Worker for aggressive image caching
const CACHE_NAME = 'meme2xyz-v1'
const IMAGE_CACHE = 'meme2xyz-images-v1'

// Cache strategy for different resource types
const CACHE_STRATEGIES = {
  images: 'cache-first',
  static: 'stale-while-revalidate',
  api: 'network-first'
}

// Install event - cache critical resources
self.addEventListener('install', event => {
  console.log('🔧 Service worker installing...')
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        '/',
        '/index.html',
        '/assets/index.css',
        '/assets/index.js'
      ])
    })
  )
  
  // Activate immediately
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('✅ Service worker activated')
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== IMAGE_CACHE) {
            console.log('🗑️ Deleting old cache:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  
  // Take control immediately
  self.clients.claim()
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)
  
  // Handle image requests with cache-first strategy
  if (request.destination === 'image' || url.pathname.startsWith('/images/')) {
    event.respondWith(handleImageRequest(request))
    return
  }
  
  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request))
    return
  }
  
  // Handle static assets with stale-while-revalidate
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(handleStaticRequest(request))
    return
  }
  
  // Default: network first with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})

// Cache-first strategy for images
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE)
  const cached = await cache.match(request)
  
  if (cached) {
    // Return cached version immediately
    console.log('📸 Serving cached image:', request.url)
    return cached
  }
  
  try {
    // Fetch from network and cache
    const response = await fetch(request)
    if (response.ok) {
      // Clone response before caching
      cache.put(request, response.clone())
      console.log('📸 Cached new image:', request.url)
    }
    return response
  } catch (error) {
    console.error('❌ Failed to fetch image:', request.url)
    // Return a placeholder or cached fallback if available
    return new Response('Image not available', { status: 404 })
  }
}

// Network-first strategy for API calls
async function handleApiRequest(request) {
  try {
    const response = await fetch(request)
    
    // Cache successful GET requests
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    // Fallback to cache for GET requests
    if (request.method === 'GET') {
      const cached = await caches.match(request)
      if (cached) {
        console.log('📡 Serving cached API response:', request.url)
        return cached
      }
    }
    throw error
  }
}

// Stale-while-revalidate for static assets
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  
  // Fetch in background to update cache
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  }).catch(() => cached) // Fallback to cached version
  
  // Return cached version immediately, or wait for network
  return cached || fetchPromise
}

// Handle cache size limits
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        )
      }).then(() => {
        console.log('🗑️ All caches cleared')
        event.ports[0].postMessage({ success: true })
      })
    )
  }
})
