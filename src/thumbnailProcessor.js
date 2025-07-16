// Client-side thumbnail processor for optimal performance
class ThumbnailProcessor {
  constructor() {
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')
    this.thumbnailCache = new Map()
    this.maxThumbnailSize = 400 // Max width/height for thumbnails
    this.quality = 0.8 // JPEG quality for thumbnails
  }

  // Generate thumbnail for an image URL
  async generateThumbnail(imageUrl, maxSize = this.maxThumbnailSize) {
    try {
      // Check cache first
      const cacheKey = `${imageUrl}-${maxSize}`
      if (this.thumbnailCache.has(cacheKey)) {
        console.log('📸 Thumbnail loaded from cache:', imageUrl)
        return this.thumbnailCache.get(cacheKey)
      }

      console.log('🔧 Generating thumbnail for:', imageUrl)
      
      // Load the image
      const img = await this.loadImage(imageUrl)
      
      // Calculate thumbnail dimensions
      const { width, height } = this.calculateThumbnailSize(img.width, img.height, maxSize)
      
      // Set canvas size
      this.canvas.width = width
      this.canvas.height = height
      
      // Clear canvas and draw resized image
      this.ctx.clearRect(0, 0, width, height)
      this.ctx.drawImage(img, 0, 0, width, height)
      
      // Convert to blob URL for caching
      const blob = await this.canvasToBlob(this.canvas)
      const thumbnailUrl = URL.createObjectURL(blob)
      
      // Cache the thumbnail
      this.thumbnailCache.set(cacheKey, thumbnailUrl)
      
      console.log(`✅ Thumbnail generated: ${width}x${height} from ${img.width}x${img.height}`)
      return thumbnailUrl
      
    } catch (error) {
      console.error('❌ Failed to generate thumbnail:', imageUrl, error)
      return imageUrl // Fallback to original image
    }
  }

  // Load image and return Promise
  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous' // Enable CORS for canvas processing
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
      img.src = src
    })
  }

  // Calculate optimal thumbnail dimensions maintaining aspect ratio
  calculateThumbnailSize(originalWidth, originalHeight, maxSize) {
    if (originalWidth <= maxSize && originalHeight <= maxSize) {
      return { width: originalWidth, height: originalHeight }
    }

    const aspectRatio = originalWidth / originalHeight
    
    if (originalWidth > originalHeight) {
      return {
        width: maxSize,
        height: Math.round(maxSize / aspectRatio)
      }
    } else {
      return {
        width: Math.round(maxSize * aspectRatio),
        height: maxSize
      }
    }
  }

  // Convert canvas to blob
  canvasToBlob(canvas, type = 'image/jpeg', quality = this.quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to convert canvas to blob'))
        }
      }, type, quality)
    })
  }

  // Process multiple images in batches
  async processBatch(imageUrls, batchSize = 3) {
    const results = []
    
    for (let i = 0; i < imageUrls.length; i += batchSize) {
      const batch = imageUrls.slice(i, i + batchSize)
      
      const batchPromises = batch.map(url => 
        this.generateThumbnail(url).catch(error => {
          console.warn('Thumbnail generation failed for:', url, error)
          return url // Return original URL on failure
        })
      )
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      // Small delay between batches to prevent blocking
      if (i + batchSize < imageUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }
    
    return results
  }

  // Generate thumbnails for specific image (like locked.gif)
  async processSpecificImage(imageName) {
    const imageUrl = `/images/${imageName}`
    console.log(`🎯 Processing thumbnail for specific image: ${imageName}`)
    
    try {
      const thumbnailUrl = await this.generateThumbnail(imageUrl)
      console.log(`✅ Thumbnail ready for ${imageName}:`, thumbnailUrl)
      return thumbnailUrl
    } catch (error) {
      console.error(`❌ Failed to process ${imageName}:`, error)
      return imageUrl
    }
  }

  // Clear thumbnail cache
  clearCache() {
    // Revoke all blob URLs to free memory
    this.thumbnailCache.forEach(url => {
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
    })
    
    this.thumbnailCache.clear()
    console.log('🗑️ Thumbnail cache cleared')
  }

  // Get cache statistics
  getCacheStats() {
    return {
      count: this.thumbnailCache.size,
      entries: Array.from(this.thumbnailCache.keys())
    }
  }
}

// Create singleton instance
const thumbnailProcessor = new ThumbnailProcessor()

export default thumbnailProcessor
