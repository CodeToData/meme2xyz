import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [currentImage, setCurrentImage] = useState(null)
  const [actualImageFile, setActualImageFile] = useState(null)
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [availableImages, setAvailableImages] = useState([])
  
  // Modal state for image viewer
  const [modalImage, setModalImage] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isModalLoading, setIsModalLoading] = useState(() => {
    // Check for hash on initial load to prevent flash
    const hash = window.location.hash.slice(1)
    return hash.length > 0 && hash !== ''
  })
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('')

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

    // Common image extensions ordered by popularity
    const extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
    
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
        return testFileName
      } catch {
        // Continue to next extension
        continue
      }
    }
    
    // No valid image found
    return null
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
      }
    }
  }

  // Function to fetch available images from static file
  const fetchAvailableImages = async () => {
    try {
      const response = await fetch('/images/images.json')
      if (response.ok) {
        const images = await response.json()
        const sortedImages = images.sort((a, b) => a.name.localeCompare(b.name))
        setAvailableImages(sortedImages)
        return
      }
    } catch (error) {
      console.log('Images file not available')
    }
    
    // Fallback: empty array
    setAvailableImages([])
  }

  useEffect(() => {
    const handleUrlChange = async () => {
      const pathname = window.location.pathname
      const hash = window.location.hash.slice(1) // Remove the '#' symbol
      
      // Check if we have a hash URL first (like #lnc) - this takes priority
      if (hash) {
        // Show loading overlay immediately for hash URLs
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
          // Image not found for hash URL
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
  }, [availableImages])

  // Effect to fetch available images from server
  useEffect(() => {
    fetchAvailableImages()
  }, [])

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
          </div>
        ) : (
          <>
            {/* Hidden image for loading - ensures full load before display */}
            <img 
              src={imageUrl}
              alt=""
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{ display: 'none' }}
            />
            {/* Show image only when loaded */}
            {imageLoaded && (
              <img 
                src={imageUrl}
                alt={currentImage}
                className="full-image"
              />
            )}
          </>
        )}
      </div>
    )
  }

  // If we're loading a modal, show loading overlay
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

  // Show homepage
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
            </div>
            
            <div className="modal-image-container">
              <img 
                src={modalImage.url}
                alt={modalImage.name}
                className="modal-image"
              />
            </div>
          </div>
        </div>
      )}

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
                      No images found. Make sure the server is running.
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
                              src={image.url} 
                              alt={image.name}
                              className="grid-thumbnail"
                              loading="lazy"
                              style={{
                                backgroundColor: '#1a1a1a',
                                minHeight: '200px',
                                objectFit: 'cover'
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
    </div>
  )
}

export default App
