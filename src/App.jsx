import { useState, useEffect } from 'react'
import './App.css'
import imageCache from './imageCache'

function App() {
  const [currentImage, setCurrentImage] = useState(null)
  const [actualImageFile, setActualImageFile] = useState(null)
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [availableImages, setAvailableImages] = useState([])
  
  // Track cached image blob URLs
  const [cachedImageUrls, setCachedImageUrls] = useState(new Map())
  const [cacheStats, setCacheStats] = useState({ count: 0, totalSizeMB: 0 })
  const [isInitializing, setIsInitializing] = useState(false)
  
  // Modal state for image viewer
  const [modalImage, setModalImage] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isModalLoading, setIsModalLoading] = useState(() => {
    // Check for hash on initial load to prevent flash - be more specific
    const hash = window.location.hash.slice(1)
    return hash.length > 0 && hash !== ''
  })
  
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

  // Helper function to remove file extension from image name
  const removeFileExtension = (filename) => {
    const lastDotIndex = filename.lastIndexOf('.')
    return lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename
  }

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

  // Function to preload and cache images with progressive loading strategy
  const preloadImages = async (images) => {
    console.log('Starting progressive image loading...')
    const newCachedUrls = new Map(cachedImageUrls)
    
    // Strategy 1: Load small images first (thumbnails)
    // Strategy 2: Batch loading to prevent overwhelming the browser
    // Strategy 3: Priority loading for visible images
    
    const BATCH_SIZE = 3 // Load 3 images at a time
    const batches = []
    
    // Sort images by estimated size (smaller files load faster)
    const prioritizedImages = [...images].sort((a, b) => {
      // Prioritize by extension (smaller formats first)
      const sizeOrder = { 'webp': 1, 'jpg': 2, 'jpeg': 2, 'png': 3, 'gif': 4 }
      const aSize = sizeOrder[a.extension] || 5
      const bSize = sizeOrder[b.extension] || 5
      return aSize - bSize
    })
    
    // Create batches
    for (let i = 0; i < prioritizedImages.length; i += BATCH_SIZE) {
      batches.push(prioritizedImages.slice(i, i + BATCH_SIZE))
    }
    
    // Load batches sequentially, but images within each batch in parallel
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      console.log(`Loading batch ${batchIndex + 1}/${batches.length}:`, batch.map(img => img.name))
      
      const batchPromises = batch.map(async (image) => {
        try {
          // First try to load a thumbnail if available
          const thumbnailUrl = `/thumbnails/${image.name}.jpg`
          let cachedUrl
          
          try {
            // Test if thumbnail exists
            await new Promise((resolve, reject) => {
              const img = new Image()
              img.onload = () => resolve()
              img.onerror = () => reject()
              img.src = thumbnailUrl
            })
            // Thumbnail exists, use it for fast display
            cachedUrl = thumbnailUrl
            console.log(`Using thumbnail for fast loading: ${image.name}`)
          } catch {
            // No thumbnail, load original but with lower priority
            cachedUrl = await imageCache.getImage(image.url)
            console.log(`Loaded original: ${image.name}`)
          }
          
          newCachedUrls.set(image.url, cachedUrl)
          
          // Update UI immediately as each image in the batch loads
          setCachedImageUrls(new Map(newCachedUrls))
          
          return { success: true, image: image.name }
        } catch (error) {
          // Silently fail and use original URL
          newCachedUrls.set(image.url, image.url)
          setCachedImageUrls(new Map(newCachedUrls))
          return { success: false, image: image.name, error }
        }
      })
      
      // Wait for current batch to complete before starting next batch
      await Promise.allSettled(batchPromises)
      
      // Small delay between batches to prevent overwhelming mobile browsers
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
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
    setIsModalLoading(false)
    // Return to homepage (no hash or path)
    window.history.pushState(null, '', window.location.origin)
  }

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && (isModalOpen || isModalLoading)) {
        closeImageModal()
      }
    }

    if (isModalOpen || isModalLoading) {
      document.addEventListener('keydown', handleEscKey)
      // Prevent body scroll when modal is open or loading
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey)
      document.body.style.overflow = 'unset'
    }
  }, [isModalOpen, isModalLoading])

  const copyImageLink = async () => {
    if (modalImage) {
      const nameWithoutExtension = removeFileExtension(modalImage.name)
      const link = `${window.location.origin}/#${nameWithoutExtension}`
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

  // Function to fetch available images using dynamic discovery with exclusions
  const fetchAvailableImages = async () => {
    if (isInitializing) {
      return // Silently skip if already initializing
    }
    
    try {
      setIsInitializing(true)
      
      // Fetch exclusion list
      let excludedFiles = []
      try {
        const exclusionsResponse = await fetch('/images/exclusions.json')
        if (exclusionsResponse.ok) {
          const exclusionsData = await exclusionsResponse.json()
          excludedFiles = exclusionsData.excludedFiles || []
        }
      } catch (error) {
        console.log('No exclusions file found, proceeding without exclusions')
      }
      
      // Try to get image list from server API first
      try {
        const serverResponse = await fetch('/api/images')
        if (serverResponse.ok) {
          const serverImages = await serverResponse.json()
          const filteredImages = serverImages
            .filter(img => !excludedFiles.includes(img.filename))
            .sort((a, b) => a.name.localeCompare(b.name))
          
          setAvailableImages(filteredImages)
          
          // Start preloading immediately but don't block UI
          preloadImages(filteredImages).catch(error => {
            console.log('Background preloading failed:', error)
          })
          return
        }
      } catch (error) {
        console.log('Server API not available, trying dynamic discovery')
      }
      
      // Fallback: Try to discover images dynamically by testing common image files
      const commonImageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
      const commonImageNames = [
        'cnn', 'lnc', 'marx', 'shane', 'sorry', 'ultrafrog', 'waiting', 'whatmeme',
        'logo', 'header', 'banner', 'hero', 'thumbnail', 'avatar', 'profile',
        'meme1', 'meme2', 'meme3', 'funny', 'image1', 'image2', 'image3'
      ]
      
      const discoveredImages = []
      
      for (const name of commonImageNames) {
        for (const ext of commonImageExtensions) {
          const filename = `${name}.${ext}`
          
          // Skip if in exclusion list
          if (excludedFiles.includes(filename)) {
            continue
          }
          
          try {
            // Test if image exists by trying to load it
            await new Promise((resolve, reject) => {
              const img = new Image()
              img.onload = () => resolve()
              img.onerror = () => reject()
              img.src = `/images/${filename}`
            })
            
            // If we get here, image exists
            discoveredImages.push({
              name: name,
              filename: filename,
              extension: ext,
              url: `/images/${filename}`
            })
            break // Found this name, try next name
          } catch {
            // Image doesn't exist, try next extension
            continue
          }
        }
      }
      
      // Set discovered images
      const sortedImages = discoveredImages.sort((a, b) => a.name.localeCompare(b.name))
      setAvailableImages(sortedImages)
      preloadImages(sortedImages)
      
    } catch (error) {
      console.log('Image discovery failed:', error)
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
        // Show loading overlay immediately for hash URLs - don't clear it until modal is ready
        if (!isModalLoading) {
          setIsModalLoading(true)
        }
        // Immediately hide any existing modal content to prevent flash during transitions
        setIsModalOpen(false)
        setModalImage(null)
        
        const foundImage = await findImageWithExtension(hash)
        if (foundImage) {
          // Hash URL shows modal
          const imageObj = availableImages.find(img => img.name === hash)
          if (imageObj) {
            // Atomic state update: set everything at once to prevent intermediate renders
            setModalImage(imageObj)
            setIsModalOpen(true)
            setIsModalLoading(false)
            // Clear the current image to show homepage with modal
            setCurrentImage(null)
            setActualImageFile(null)
            setImageError(false)
            setIsLoading(false)
            setImageLoaded(false)
          } else {
            setIsModalLoading(false)
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
          setIsModalLoading(false)
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
          setIsModalLoading(false)
        } else {
          // Image not found
          setActualImageFile(null)
          setImageError(true)
          setIsLoading(false)
          setImageLoaded(false)
          setCurrentImage(imageName)
          setIsModalOpen(false)
          setModalImage(null)
          setIsModalLoading(false)
        }
      }
      // No path or hash - show homepage
      else {
        // Ensure clean state when returning to homepage
        setCurrentImage(null)
        setActualImageFile(null)
        setImageError(false)
        setIsLoading(false)
        setImageLoaded(false)
        setIsModalOpen(false)
        setModalImage(null)
        setIsModalLoading(false)
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

  // If we're loading a modal or have a modal open, don't render the main page to prevent flash
  if (isModalLoading) {
    return (
      <div className="app">
        <div className="image-modal-overlay" onClick={closeImageModal}>
          <div className="modal-loading-container">
            <div className="modal-loading-spinner">
              <div className="spinner"></div>
              <p>Loading image...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show homepage only when no hash is present and not loading modal
  return (
    <div className="app">

      {/* Image Modal */}
      {isModalOpen && modalImage && (
        <div className="image-modal-overlay" onClick={closeImageModal}>
          <div className="image-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-button" onClick={closeImageModal}>
              ✕
            </button>
            
            <div className="modal-sidebar">
              <div className="modal-header">
                <h3 className="modal-title">#{removeFileExtension(modalImage.name)}</h3>
              </div>
              
              <div className="share-section">
                <label htmlFor="share-link" className="share-label">
                  📋 Share this meme:
                </label>
                <div className="share-input-container">
                  <input
                    id="share-link"
                    type="text"
                    value={`${window.location.origin}/#${removeFileExtension(modalImage.name)}`}
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
                    href={`${window.location.origin}/${removeFileExtension(modalImage.name)}`}
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
                    🔗 Open image page in new tab
                  </a>
                </div>
              </div>
            </div>
            
            <div className="modal-image-container">
              <img 
                src={getCachedImageUrl(modalImage.url)}
                alt={modalImage.name}
                className="modal-image"
                onLoad={(e) => {
                  // Add loaded class for smooth animation
                  e.target.classList.add('loaded')
                }}
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

      {/* Only show homepage content when not loading modal */}
      {!isModalLoading && (
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
                  
                  if (isInitializing) {
                    return (
                      <div style={{color: 'white', padding: '2rem', textAlign: 'center'}}>
                        <div className="loading-spinner">
                          <div className="spinner"></div>
                        </div>
                        <p style={{marginTop: '1rem'}}>Discovering images...</p>
                      </div>
                    )
                  }
                  
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
                        No images found. Try refreshing the page or check console for errors.
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
                                decoding="async"
                                style={{
                                  backgroundColor: '#1a1a1a',
                                  minHeight: '200px',
                                  objectFit: 'cover'
                                }}
                                onError={(e) => {
                                  // Try thumbnail first, then fallback to original
                                  const thumbnailUrl = `/thumbnails/${image.name}.jpg`
                                  if (e.target.src !== thumbnailUrl && e.target.src !== image.url) {
                                    e.target.src = thumbnailUrl
                                  } else if (e.target.src === thumbnailUrl) {
                                    e.target.src = image.url
                                  }
                                }}
                                onLoad={(e) => {
                                  // Smooth transition when image loads
                                  e.target.style.transition = 'opacity 0.3s ease'
                                  e.target.style.opacity = '1'
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
          </main>
        </div>
      )}
    </div>
  )
}

export default App
