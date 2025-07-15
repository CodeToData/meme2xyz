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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  
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

  // Function to preload and cache all images with progressive loading
  const preloadImages = async (images) => {
    console.log('Starting image preload and caching...')
    const newCachedUrls = new Map(cachedImageUrls)
    
    // Load images in parallel for faster initial display
    const loadPromises = images.map(async (image) => {
      try {
        const cachedUrl = await imageCache.getImage(image.url)
        newCachedUrls.set(image.url, cachedUrl)
        console.log(`Cached: ${image.name}`)
        
        // Update the cache URLs immediately as each image loads
        setCachedImageUrls(new Map(newCachedUrls))
        
        return { success: true, image: image.name }
      } catch (error) {
        // Silently fail and use original URL - no user-facing error
        newCachedUrls.set(image.url, image.url)
        setCachedImageUrls(new Map(newCachedUrls))
        return { success: false, image: image.name, error }
      }
    })
    
    // Wait for all images to complete (or fail)
    await Promise.allSettled(loadPromises)
    
    // Final update to ensure all URLs are set
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

  // Function to get the user-friendly raw image URL (always shows normal URL)
  const getRawImageUrl = (originalUrl) => {
    // Always return the user-friendly URL format for display
    return `${window.location.origin}${originalUrl}`
  }

  // Function to get the optimized URL for actually opening the image (uses cache when available)
  const getOptimizedImageUrl = (originalUrl) => {
    const cachedUrl = getCachedImageUrl(originalUrl)
    // Use cached blob URL if available for better performance, otherwise use original
    return cachedUrl.startsWith('blob:') ? cachedUrl : `${window.location.origin}${originalUrl}`
  }

  // Function to filter images based on search term
  const getFilteredImages = () => {
    if (!searchTerm.trim()) {
      return availableImages
    }
    
    return availableImages.filter(image => 
      image.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
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
    setIsSidebarOpen(false) // Reset sidebar when closing modal
    // Return to homepage (no hash or path)
    window.history.pushState(null, '', window.location.origin)
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
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

  const copyRawImageLink = async () => {
    if (modalImage) {
      const rawLink = getRawImageUrl(modalImage.url)
      try {
        await navigator.clipboard.writeText(rawLink)
        // Show a temporary feedback
        const button = document.querySelector('.copy-raw-button')
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
        console.error('Failed to copy raw image link:', error)
        // Fallback for older browsers
        const textArea = document.createElement('textarea')
        textArea.value = rawLink
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
    }
  }

  // Function to fetch available images from static JSON file
  const fetchAvailableImages = async () => {
    if (isInitializing) {
      return // Silently skip if already initializing
    }
    
    try {
      setIsInitializing(true)
      
      // Start preloading default images immediately (don't wait for JSON)
      preloadImages(availableImages)
      
      const response = await fetch('/images/images.json')
      
      if (response.ok) {
        const jsonImages = await response.json()
        
        // Merge JSON images with any that might not be in the default list
        const imageMap = new Map()
        
        // Add default images first
        availableImages.forEach(img => imageMap.set(img.name, img))
        
        // Add or update with JSON images
        jsonImages.forEach(img => imageMap.set(img.name, img))
        
        const mergedImages = Array.from(imageMap.values()).sort((a, b) => a.name.localeCompare(b.name))
        setAvailableImages(mergedImages)
        
        // Preload any new images from JSON
        const newImages = jsonImages.filter(jsonImg => 
          !availableImages.some(defaultImg => defaultImg.name === jsonImg.name)
        )
        if (newImages.length > 0) {
          preloadImages(newImages)
        }
      }
    } catch (error) {
      // Network error, but we already started preloading default images
      console.log('JSON fetch failed, using default images')
    } finally {
      setIsInitializing(false)
    }
  }

  useEffect(() => {
    const handleUrlChange = async () => {
      const pathname = window.location.pathname
      const hash = window.location.hash.slice(1) // Remove the '#' symbol
      
      // Check if we have a hash URL first (like #lnc) - this takes priority
      if (hash) {
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
          // Image not found for hash URL - show homepage with error modal or just homepage
          setCurrentImage(null)
          setActualImageFile(null)
          setImageError(false)
          setIsLoading(false)
          setImageLoaded(false)
          setIsModalOpen(false)
          setModalImage(null)
        }
      }
      // Check if we have a direct path (like /lnc) - only if no hash
      else if (pathname !== '/' && pathname !== '') {
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
    // Start fetching images immediately without waiting for anything
    fetchAvailableImages()
    
    // Initialize image cache in the background (non-blocking)
    const initializeCache = async () => {
      try {
        await imageCache.init()
        console.log('Image cache initialized')
        await imageCache.cleanupCache()
      } catch (error) {
        console.error('Failed to initialize image cache:', error)
      }
    }
    
    initializeCache() // Fire and forget
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

  // If there's a current image for full-page view (not modal), show only the image
  if (currentImage && !isModalOpen) {
    const imageUrl = actualImageFile ? `/images/${actualImageFile}` : null
    const cachedUrl = imageUrl ? getCachedImageUrl(imageUrl) : null
    
    return (
      <div className="app image-only">
        {/* Close button to return to main site */}
        <button 
          className="fullpage-close-button" 
          onClick={() => window.location.href = window.location.origin}
          title="Return to main site"
        >
          ✕
        </button>
        
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
          <div className="image-grid-section">
            <h2>🎭 Browse Memes</h2>
            
            {/* Search Section */}
            <div className="search-section">
              <div className="search-container">
                <input
                  type="text"
                  placeholder="Search memes by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="search-clear-button"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            
            <div className="image-grid-container">
              {(() => {
                const filteredImages = getFilteredImages()
                
                if (filteredImages.length === 0 && searchTerm) {
                  return (
                    <div style={{color: 'white', padding: '2rem', textAlign: 'center'}}>
                      No memes found matching "{searchTerm}". Try a different search term.
                    </div>
                  )
                }
                
                if (filteredImages.length === 0) {
                  return (
                    <div style={{color: 'white', padding: '2rem', textAlign: 'center'}}>
                      Loading images... If this persists, check console for errors.
                    </div>
                  )
                }
                
                return (
                  <div className="image-grid">
                    {filteredImages.map((image) => (
                      <div key={image.name} className="image-grid-item">
                        <div 
                          className="image-grid-link"
                          onClick={() => openImageModal(image)}
                          style={{ cursor: 'pointer' }}
                        >
                          <div className="image-preview">
                            <img 
                              src={getCachedImageUrl(image.url)} 
                              alt={image.name}
                              className="grid-thumbnail"
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
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>

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

          {/* Image Modal */}
          {isModalOpen && modalImage && (
            <div className="image-modal-overlay" onClick={closeImageModal}>
              <div className="image-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-button" onClick={closeImageModal}>
                  ✕
                </button>
                
                <div className={`modal-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                  <button className="sidebar-toggle" onClick={toggleSidebar}>
                    <span className={`sidebar-arrow ${isSidebarOpen ? 'open' : ''}`}>
                      ➤
                    </span>
                  </button>
                  
                  <div className="modal-header">
                    <h3 className="modal-title">#{modalImage.name}</h3>
                  </div>
                  
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
                        📋
                      </button>
                    </div>
                  </div>
                  
                  <div className="share-section">
                    <label htmlFor="raw-image-link" className="share-label">
                      🖼️ Raw image:
                    </label>
                    <div className="share-input-container">
                      <input
                        id="raw-image-link"
                        type="text"
                        value={getRawImageUrl(modalImage.url)}
                        readOnly
                        className="share-input"
                        onClick={(e) => e.target.select()}
                      />
                      <button 
                        className="copy-raw-button"
                        onClick={copyRawImageLink}
                      >
                        📋
                      </button>
                    </div>
                    <div style={{marginTop: '0.5rem'}}>
                      <a 
                        href={getOptimizedImageUrl(modalImage.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="raw-image-text-link"
                        style={{
                          color: '#60a5fa',
                          textDecoration: 'none',
                          fontSize: '0.875rem',
                          fontWeight: '500'
                        }}
                        onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                        onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                      >
                        🔗 Open raw image in new tab
                      </a>
                    </div>
                  </div>
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
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default App
