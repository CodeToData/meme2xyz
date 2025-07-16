// Image discovery service optimized for client-side performance

class ImageDiscoveryService {
  constructor() {
    this.baseUrl = ''
    this.cache = new Map()
    this.lastCheck = 0
    this.checkInterval = 120000 // Increased to 2 minutes to reduce browser load
    this.callbacks = []
    this.isRunning = false
    this.intervalId = null
    this.maxCacheSize = 50 // Limit cache to 50 images
  }

  /**
   * Discover all available images in the /images folder
   * @returns {Promise<Array>} Array of image objects with url and name
   */
  async discoverImages() {
    try {
      // In development, we'll use the static images.json file or scan directly
      const response = await fetch('/images/images.json')
      
      if (response.ok) {
        const data = await response.json()
        console.log('📁 Loaded images from images.json:', data?.length || 0)
        
        // Handle the current format where data is an array of objects
        if (Array.isArray(data)) {
          return data.map(item => ({
            name: item.filename || item.name,
            url: item.url || `/images/${item.filename || item.name}`,
            lastModified: Date.now()
          }))
        }
        
        // Handle alternative format where data has an images array
        return data.images?.map(imageName => ({
          name: imageName,
          url: `/images/${imageName}`,
          lastModified: Date.now()
        })) || []
      } else {
        // Fallback: Use hardcoded list of known images
        console.log('⚠️ images.json not found, using fallback image list')
        return this.getFallbackImages()
      }
    } catch (error) {
      console.error('❌ Error discovering images:', error)
      return this.getFallbackImages()
    }
  }

  /**
   * Get fallback list of images when API is not available
   * @returns {Array} Array of known images (empty since we rely on images.json)
   */
  getFallbackImages() {
    // No hardcoded fallback images - rely entirely on images.json
    return []
  }

  /**
   * Check for new images (for auto-detection)
   * @returns {Promise<Array>} Array of new images found
   */
  async checkForNewImages() {
    const now = Date.now()
    
    // Rate limit checks
    if (now - this.lastCheck < this.checkInterval) {
      return []
    }
    
    this.lastCheck = now
    
    try {
      const currentImages = await this.discoverImages()
      const cachedImageNames = new Set(Array.from(this.cache.keys()))
      const currentImageNames = new Set(currentImages.map(img => img.name))
      
      // Find new images
      const newImages = currentImages.filter(img => !cachedImageNames.has(img.name))
      
      // Update cache with size limit
      currentImages.forEach(img => {
        this.cache.set(img.name, img)
      })
      
      // Limit cache size to prevent memory issues
      if (this.cache.size > this.maxCacheSize) {
        const entries = Array.from(this.cache.entries())
        const toDelete = entries.slice(0, this.cache.size - this.maxCacheSize)
        toDelete.forEach(([key]) => this.cache.delete(key))
        console.log(`🧹 Cache cleanup: removed ${toDelete.length} old entries`)
      }
      
      // Remove deleted images from cache
      for (const cachedName of cachedImageNames) {
        if (!currentImageNames.has(cachedName)) {
          this.cache.delete(cachedName)
        }
      }
      
      if (newImages.length > 0) {
        console.log('🆕 New images discovered:', newImages.map(img => img.name))
      }
      
      return newImages
    } catch (error) {
      console.error('❌ Error checking for new images:', error)
      return []
    }
  }

  /**
   * Get cached images or fetch if cache is empty
   * @returns {Promise<Array>} Array of cached images
   */
  async getCachedImages() {
    if (this.cache.size === 0) {
      const images = await this.discoverImages()
      images.forEach(img => {
        this.cache.set(img.name, img)
      })
      return images
    }
    
    return Array.from(this.cache.values())
  }

  /**
   * Add callback for when new images are discovered
   * @param {Function} callback - Function to call with new images
   */
  onNewImages(callback) {
    this.callbacks.push(callback)
  }

  /**
   * Remove callback
   * @param {Function} callback - Function to remove
   */
  removeCallback(callback) {
    const index = this.callbacks.indexOf(callback)
    if (index > -1) {
      this.callbacks.splice(index, 1)
    }
  }

  /**
   * Start the discovery service
   */
  start() {
    if (this.isRunning) return
    
    this.isRunning = true
    console.log('🔍 Starting image discovery service...')
    
    // Initial discovery
    this.discoverImages().then(images => {
      images.forEach(img => {
        this.cache.set(img.name, img)
      })
    })

    // Set up interval for checking new images
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        const newImages = await this.checkForNewImages()
        if (newImages.length > 0) {
          // Notify all callbacks
          this.callbacks.forEach(callback => {
            try {
              callback(newImages)
            } catch (error) {
              console.error('Error in discovery callback:', error)
            }
          })
        }
      }
    }, this.checkInterval)
  }

  /**
   * Stop the discovery service
   */
  stop() {
    this.isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    console.log('🛑 Stopped image discovery service')
  }
}

// Export singleton instance
export default new ImageDiscoveryService()
