import { useState, useEffect } from 'react'
import './App.css'
import imageCache from './imageCache'

function App() {
  const [currentImage, setCurrentImage] = useState(null)
  const [actualImageFile, setActualImageFile] = useState(null)
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [availableImages, setAvailableImages] = useState([
    // Default images that should be available immediately
    { name: 'lnc', filename: 'lnc.png', extension: 'png', url: '/images/lnc.png' },
    { name: 'whatmeme', filename: 'whatmeme.png', extension: 'png', url: '/images/whatmeme.png' },
    { name: 'waiting', filename: 'waiting.jpg', extension: 'jpg', url: '/images/waiting.jpg' },
    { name: 'sorry', filename: 'sorry.gif', extension: 'gif', url: '/images/sorry.gif' }
  ])
  
  // Track cached image blob URLs
  const [cachedImageUrls, setCachedImageUrls] = useState(new Map())
  const [cacheStats, setCacheStats] = useState({ count: 0, totalSizeMB: 0 })
  const [isInitializing, setIsInitializing] = useState(false)
  
  // Modal state for image viewer
  const [modalImage, setModalImage] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Initialize extension cache from localStorage
  const [extensionCache, setExtensionCache] = useState(() => {
    try {
      const stored = localStorage.getItem('meme2xyz-extension-cache')
      return stored ? new Map(JSON.parse(stored)) : new Map()
    } catch {
      return new Map()
    }
  })

  // Function to dynamically find image by trying common extensions
  const findImageWithExtension = async (imageName) => {
    // If the name already has an extension, return it as-is
    if (imageName.includes('.')) {
      return imageName
    }

    // Check cache first - if we've found this image before, use the cached extension
    if (extensionCache.has(imageName)) {
      const cachedExtension = extensionCache.get(imageName)
      console.log(`Using cached extension for ${imageName}: ${cachedExtension}`)
      return `${imageName}.${cachedExtension}`
    }

    // Common image extensions ordered by popularity
    const extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif']
    
    // Try each extension by attempting to load the image
    for (const ext of extensions) {
      const testFileName = `${imageName}.${ext}`
      try {
        // Create a promise that resolves when image loads or rejects when it fails
        await new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = () => reject()
          img.src = `/images/${testFileName}`
        })
        // If we get here, the image loaded successfully
        // Cache the successful extension for future use
        const newCache = new Map(extensionCache.set(imageName, ext))
        setExtensionCache(newCache)
        
        // Persist to localStorage
        try {
          localStorage.setItem('meme2xyz-extension-cache', JSON.stringify([...newCache]))
        } catch (error) {
          console.warn('Failed to save extension cache to localStorage:', error)
        }
        
        console.log(`Caching extension for ${imageName}: ${ext}`)
        return testFileName
      } catch {
        // Continue to next extension
        continue
      }
    }
    
    // No valid image found
    return null
  }

  // Function to preload and cache all images
  const preloadImages = async (images) => {
    console.log('Starting image preload and caching...')
    const newCachedUrls = new Map(cachedImageUrls)
    
    // Add a delay between requests to avoid rate limiting
    for (let i = 0; i < images.length; i++) {
      const image = images[i]
      try {
        const cachedUrl = await imageCache.getImage(image.url)
        newCachedUrls.set(image.url, cachedUrl)
        console.log(`Cached: ${image.name}`)
        
        // Add a small delay between requests to avoid rate limiting
        if (i < images.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200)) // 200ms delay
        }
      } catch (error) {
        // Silently fail and use original URL - no user-facing error
        newCachedUrls.set(image.url, image.url)
      }
    }
    
    setCachedImageUrls(newCachedUrls)
    
    // Update cache stats (optional, fails silently)
    try {
      const stats = await imageCache.getCacheStats()
      setCacheStats(stats)
    } catch (error) {
      // Cache stats are nice-to-have, not critical
    }
  }

  // Function to get the cached URL for an image
  const getCachedImageUrl = (originalUrl) => {
    return cachedImageUrls.get(originalUrl) || originalUrl
  }

  // Modal functions
  const openImageModal = (image) => {
    setModalImage(image)
    setIsModalOpen(true)
    // Update URL to use hash (modal view)
    const newUrl = `${window.location.origin}/#${image.name}`
    window.history.pushState(null, '', newUrl)
  }

  const closeImageModal = () => {
    setIsModalOpen(false)
    setModalImage(null)
    // Return to homepage (no hash or path)
    window.history.pushState(null, '', window.location.origin)
  }

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isModalOpen) {
        closeImageModal()
      }
    }

    if (isModalOpen) {
      document.addEventListener('keydown', handleEscKey)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey)
      document.body.style.overflow = 'unset'
    }
  }, [isModalOpen])

  const copyImageLink = async () => {
    if (modalImage) {
      const link = `${window.location.origin}/#${modalImage.name}`
      try {
        await navigator.clipboard.writeText(link)
        // Show a temporary feedback
        const button = document.querySelector('.copy-button')
        if (button) {
          const originalText = button.textContent
          button.textContent = 'Copied! ✓'
          button.style.backgroundColor = '#4ade80'
          setTimeout(() => {
            button.textContent = originalText
            button.style.backgroundColor = ''
          }, 2000)
        }
      } catch (error) {
        console.error('Failed to copy link:', error)
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = link
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
    }
  }

  // Function to fetch available images from the server
  const fetchAvailableImages = async () => {
    if (isInitializing) {
      return // Silently skip if already initializing
    }
    
    try {
      setIsInitializing(true)
      const response = await fetch('/api/images')
      
      if (response.ok) {
        const apiImages = await response.json()
        
        // Merge API images with any that might not be in the default list
        const imageMap = new Map()
        
        // Add default images first
        availableImages.forEach(img => imageMap.set(img.name, img))
        
        // Add or update with API images
        apiImages.forEach(img => imageMap.set(img.name, img))
        
        const mergedImages = Array.from(imageMap.values()).sort((a, b) => a.name.localeCompare(b.name))
        setAvailableImages(mergedImages)
        
        // Preload all images in the background (only if not already done)
        if (!cachedImageUrls.size) {
          preloadImages(mergedImages)
        }
      } else {
        // API failed, but we still have default images - no user notification needed
        if (!cachedImageUrls.size) {
          preloadImages(availableImages)
        }
      }
    } catch (error) {
      // Network error, but we still have default images - no user notification needed
      if (!cachedImageUrls.size) {
        preloadImages(availableImages)
      }
    } finally {
      setIsInitializing(false)
    }
  }

  useEffect(() => {
    const handleUrlChange = async () => {
      const pathname = window.location.pathname
      const hash = window.location.hash.slice(1) // Remove the '#' symbol
      
      // Check if we have a direct path (like /lnc)
      if (pathname !== '/' && pathname !== '') {
        const imageName = pathname.slice(1) // Remove leading slash
        const foundImage = await findImageWithExtension(imageName)
        
        if (foundImage) {
          // Direct path shows full-page image
          setCurrentImage(imageName)
          setActualImageFile(foundImage)
          setImageError(false)
          setIsLoading(true)
          setImageLoaded(false)
          setIsModalOpen(false)
          setModalImage(null)
        } else {
          // Image not found
          setActualImageFile(null)
          setImageError(true)
          setIsLoading(false)
          setImageLoaded(false)
          setCurrentImage(imageName)
          setIsModalOpen(false)
          setModalImage(null)
        }
      }
      // Check if we have a hash URL (like #lnc)
      else if (hash) {
        const foundImage = await findImageWithExtension(hash)
        if (foundImage) {
          // Hash URL shows modal
          const imageObj = availableImages.find(img => img.name === hash)
          if (imageObj) {
            setModalImage(imageObj)
            setIsModalOpen(true)
            // Clear the current image to show homepage with modal
            setCurrentImage(null)
            setActualImageFile(null)
            setImageError(false)
            setIsLoading(false)
            setImageLoaded(false)
          }
        } else {
          // Image not found
          setActualImageFile(null)
          setImageError(true)
          setIsLoading(false)
          setImageLoaded(false)
          setCurrentImage(hash)
          setIsModalOpen(false)
          setModalImage(null)
        }
      }
      // No path or hash - show homepage
      else {
        setCurrentImage(null)
        setActualImageFile(null)
        setImageError(false)
        setIsLoading(false)
        setImageLoaded(false)
        setIsModalOpen(false)
        setModalImage(null)
      }
    }

    // Check initial URL
    handleUrlChange()

    // Listen for hash changes
    window.addEventListener('hashchange', handleUrlChange)
    
    // Listen for popstate (back/forward buttons and direct navigation)
    window.addEventListener('popstate', handleUrlChange)

    return () => {
      window.removeEventListener('hashchange', handleUrlChange)
      window.removeEventListener('popstate', handleUrlChange)
    }
  }, [availableImages]) // Add availableImages as dependency

  // Effect to fetch available images from server and initialize cache
  useEffect(() => {
    // Initialize image cache and preload default images immediately
    const initializeCache = async () => {
      try {
        await imageCache.init()
        console.log('Image cache initialized')
        
        // Clean up old cache entries
        await imageCache.cleanupCache()
        
        // Define default images here to avoid dependency issues
        const defaultImages = [
          { name: 'lnc', filename: 'lnc.png', extension: 'png', url: '/images/lnc.png' },
          { name: 'whatmeme', filename: 'whatmeme.png', extension: 'png', url: '/images/whatmeme.png' },
          { name: 'waiting', filename: 'waiting.jpg', extension: 'jpg', url: '/images/waiting.jpg' },
          { name: 'sorry', filename: 'sorry.gif', extension: 'gif', url: '/images/sorry.gif' }
        ]
        
        // Preload default images immediately
        preloadImages(defaultImages)
        
        // Then fetch from API (this will merge with defaults)
        fetchAvailableImages()
      } catch (error) {
        console.error('Failed to initialize image cache:', error)
        // Fallback to regular loading
        fetchAvailableImages()
      }
    }
    
    initializeCache()
  }, []) // Empty dependency array to run only once

  const handleImageLoad = () => {
    setImageLoaded(true)
    setIsLoading(false)
    setImageError(false)
  }

  const handleImageError = () => {
    setImageError(true)
    setIsLoading(false)
    setImageLoaded(false)
  }

  // If there's a hash with an image name, show only the image
  if (currentImage) {
    const imageUrl = actualImageFile ? `/images/${actualImageFile}` : null
    const cachedUrl = imageUrl ? getCachedImageUrl(imageUrl) : null
    
    return (
      <div className="app image-only">
        {(!actualImageFile || imageError) ? (
          <div className="error-simple">
            <h3>Image not found: {currentImage}</h3>
            <p>No image file found with that name in any supported format.</p>
            <p>Make sure the image exists in the /public/images/ folder</p>
          </div>
        ) : (
          <>
            {/* Hidden image for loading - ensures full load before display */}
            <img 
              src={cachedUrl || imageUrl}
              alt=""
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{ display: 'none' }}
            />
            {/* Show image only when loaded */}
            {imageLoaded && (
              <img 
                src={cachedUrl || imageUrl}
                alt={currentImage}
                className="full-image"
              />
            )}
          </>
        )}
      </div>
    )
  }

  // Show homepage only when no hash is present
  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1 className="title">Meme 2 XYZ</h1>
          <p className="subtitle">Direct image access via URL hash</p>
        </header>
        
        <main className="main">
          <div className="usage-section">
            <h2>🖼️ How to Use</h2>
            <div className="usage-card">
              <p>Access images using two different URL patterns:</p>
              
              <p><strong>Modal popup view (on homepage):</strong></p>
              <div className="url-format">
                <code>meme2.xyz/#[image-name]</code>
              </div>
              <p>Example: <a href="/#whatmeme">meme2.xyz/#whatmeme</a></p>
              
              <p><strong>Full-page image view:</strong></p>
              <div className="url-format">
                <code>meme2.xyz/[image-name]</code>
              </div>
              <p>Example: <a href="/whatmeme">meme2.xyz/whatmeme</a></p>
              
              <p><em>Note: You can use filenames with or without extensions!</em></p>
              <p><em>The system will automatically detect the correct file extension.</em></p>
            </div>
          </div>

          {/* Enhanced Image Marquee */}
          <div className="image-marquee-section">
            <h2>🎭 Browse Memes</h2>
            <p style={{color: 'white', marginBottom: '1rem'}}>
              Showing {availableImages.length} images 🎉 | 
              Cache: {cacheStats.count} images ({cacheStats.totalSizeMB}MB)
            </p>
            <div className="image-marquee-container">
              <div className="image-marquee">
                {availableImages.length === 0 ? (
                  <div style={{color: 'white', padding: '2rem', textAlign: 'center'}}>
                    Loading images... If this persists, check console for errors.
                  </div>
                ) : (
                  /* Duplicate the array to create seamless infinite scroll */
                  availableImages.concat(availableImages).map((image, index) => (
                    <div key={`${image.name}-${index}`} className="image-marquee-item">
                      <div 
                        className="image-marquee-link"
                        onClick={() => openImageModal(image)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="image-preview">
                          <img 
                            src={getCachedImageUrl(image.url)} 
                            alt={image.name}
                            className="marquee-thumbnail"
                            loading="lazy"
                            onError={(e) => {
                              // Silently fallback to original URL if cached version fails
                              if (e.target.src !== image.url) {
                                e.target.src = image.url
                              }
                            }}
                          />
                          <div className="image-hashtag-overlay">
                            #{image.name}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>          </div>

          {/* Image Modal */}
          {isModalOpen && modalImage && (
            <div className="image-modal-overlay" onClick={closeImageModal}>
              <div className="image-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-button" onClick={closeImageModal}>
                  ✕
                </button>
                
                <div className="modal-header">
                  <h3 className="modal-title">#{modalImage.name}</h3>
                </div>
                
                <div className="modal-image-container">
                  <img 
                    src={getCachedImageUrl(modalImage.url)}
                    alt={modalImage.name}
                    className="modal-image"
                    onError={(e) => {
                      // Silently fallback to original URL
                      if (e.target.src !== modalImage.url) {
                        e.target.src = modalImage.url
                      }
                    }}
                  />
                </div>
                
                <div className="modal-footer">
                  <div className="share-section">
                    <label htmlFor="share-link" className="share-label">
                      📋 Share this meme:
                    </label>
                    <div className="share-input-container">
                      <input
                        id="share-link"
                        type="text"
                        value={`${window.location.origin}/#${modalImage.name}`}
                        readOnly
                        className="share-input"
                        onClick={(e) => e.target.select()}
                      />
                      <button 
                        className="copy-button"
                        onClick={copyImageLink}
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
