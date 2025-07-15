// IndexedDB-based image caching utility
class ImageCache {
  constructor() {
    this.dbName = 'meme2xyz-image-cache'
    this.dbVersion = 1
    this.storeName = 'images'
    this.db = null
  }

  // Initialize the IndexedDB database
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'url' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  // Get cached image as blob URL
  async getCachedImage(url) {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(url)
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const result = request.result
        if (result && result.blob) {
          // Update access time
          this.updateAccessTime(url)
          // Create blob URL for the cached image
          const blobUrl = URL.createObjectURL(result.blob)
          resolve(blobUrl)
        } else {
          resolve(null)
        }
      }
    })
  }

  // Cache an image by fetching and storing it
  async cacheImage(url) {
    if (!this.db) await this.init()
    
    try {
      console.log('Caching image:', url)
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Failed to fetch ${url}`)
      
      const blob = await response.blob()
      const imageData = {
        url: url,
        blob: blob,
        timestamp: Date.now(),
        lastAccessed: Date.now(),
        size: blob.size
      }
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite')
        const store = transaction.objectStore(this.storeName)
        const request = store.put(imageData)
        
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          console.log('Image cached successfully:', url)
          resolve(URL.createObjectURL(blob))
        }
      })
    } catch (error) {
      console.error('Error caching image:', url, error)
      throw error
    }
  }

  // Get image (from cache or fetch and cache)
  async getImage(url) {
    try {
      // Try to get from cache first
      const cachedUrl = await this.getCachedImage(url)
      if (cachedUrl) {
        console.log('Image loaded from cache:', url)
        return cachedUrl
      }
      
      // If not cached, fetch and cache it
      console.log('Image not in cache, fetching:', url)
      return await this.cacheImage(url)
    } catch (error) {
      console.error('Error getting image:', url, error)
      // Fallback to original URL if caching fails
      return url
    }
  }

  // Update last accessed time
  async updateAccessTime(url) {
    if (!this.db) return
    
    try {
      const transaction = this.db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const getRequest = store.get(url)
      
      getRequest.onsuccess = () => {
        const data = getRequest.result
        if (data) {
          data.lastAccessed = Date.now()
          store.put(data)
        }
      }
    } catch (error) {
      console.warn('Error updating access time:', error)
    }
  }

  // Get cache statistics
  async getCacheStats() {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const images = request.result
        const totalSize = images.reduce((sum, img) => sum + (img.size || 0), 0)
        const totalCount = images.length
        
        resolve({
          count: totalCount,
          totalSize: totalSize,
          totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
          images: images.map(img => ({
            url: img.url,
            size: img.size,
            cached: new Date(img.timestamp).toLocaleString(),
            lastAccessed: new Date(img.lastAccessed).toLocaleString()
          }))
        })
      }
    })
  }

  // Clear old cache entries (older than 30 days and not accessed in 7 days)
  async cleanupCache() {
    if (!this.db) await this.init()
    
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.getAll()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const images = request.result
        let deletedCount = 0
        
        images.forEach(img => {
          const shouldDelete = img.timestamp < thirtyDaysAgo || 
                              (img.lastAccessed && img.lastAccessed < sevenDaysAgo)
          
          if (shouldDelete) {
            store.delete(img.url)
            deletedCount++
            // Revoke blob URL if it exists
            if (img.blobUrl) {
              URL.revokeObjectURL(img.blobUrl)
            }
          }
        })
        
        console.log(`Cache cleanup: deleted ${deletedCount} old images`)
        resolve(deletedCount)
      }
    })
  }

  // Clear all cache
  async clearCache() {
    if (!this.db) await this.init()
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()
      
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        console.log('All cached images cleared')
        resolve()
      }
    })
  }
}

// Create singleton instance
const imageCache = new ImageCache()

export default imageCache
