import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [currentImage, setCurrentImage] = useState(null)
  const [actualImageFile, setActualImageFile] = useState(null)
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [availableImages, setAvailableImages] = useState([])
  
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

  useEffect(() => {
    const handleHashChange = async () => {
      const hash = window.location.hash.slice(1) // Remove the '#' symbol
      if (hash) {
        setCurrentImage(hash)
        setImageError(false)
        setIsLoading(true)
        setImageLoaded(false)
        
        const foundImage = await findImageWithExtension(hash)
        if (foundImage) {
          setActualImageFile(foundImage)
          setImageError(false)
          // isLoading will be set to false when image loads via handleImageLoad
        } else {
          setActualImageFile(null)
          setImageError(true)
          setIsLoading(false)
          setImageLoaded(false)
        }
      } else {
        setCurrentImage(null)
        setActualImageFile(null)
        setImageError(false)
        setIsLoading(false)
        setImageLoaded(false)
      }
    }

    // Check initial hash
    handleHashChange()

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  // Effect to discover available images from cache and common names
  useEffect(() => {
    const discoverImages = () => {
      const imageSet = new Set()
      
      // Add cached images first (these are confirmed to exist)
      extensionCache.forEach((ext, name) => {
        imageSet.add({ name, extension: ext, cached: true })
      })
      
      // Add some common meme names that might exist
      const commonMemeNames = [
        'whatmeme', 'sample-meme-1', 'sample-meme-2', 'sample-meme-3', 
        'waiting', 'funny', 'epic', 'success', 'fail', 'drake', 'distracted',
        'womanyelling', 'expanding-brain', 'stonks', 'this-is-fine', 'surprised-pikachu'
      ]
      
      commonMemeNames.forEach(name => {
        if (!extensionCache.has(name)) {
          imageSet.add({ name, extension: 'unknown', cached: false })
        }
      })
      
      setAvailableImages(Array.from(imageSet))
    }
    
    discoverImages()
  }, [extensionCache])

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
    return (
      <div className="app image-only">
        {isLoading && !actualImageFile ? (
          <div className="loading">
            <h3>Loading image: {currentImage}</h3>
            <p>Checking available formats...</p>
          </div>
        ) : !actualImageFile || imageError ? (
          <div className="error-simple">
            <h3>Image not found: {currentImage}</h3>
            <p>No image file found with that name in any supported format.</p>
            <p>Make sure the image exists in the /public/images/ folder</p>
          </div>
        ) : !imageLoaded ? (
          <>
            {/* Hidden image for loading - ensures full load before display */}
            <img 
              src={`/images/${actualImageFile}`}
              alt=""
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{ display: 'none' }}
            />
            <div className="loading">
              <h3>Loading image: {currentImage}</h3>
              <p>Decoding image data...</p>
            </div>
          </>
        ) : (
          <img 
            src={`/images/${actualImageFile}`}
            alt={currentImage}
            className="full-image"
          />
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
              <p>Access any image by using the format:</p>
              <div className="url-format">
                <code>meme2.xyz#[image-name]</code>
              </div>
              <p>Example: <a href="#whatmeme">meme2.xyz#whatmeme</a></p>
              <p><em>Note: You can use filenames with or without extensions!</em></p>
              <p><em>The system will automatically detect the correct file extension.</em></p>
            </div>
          </div>

          {/* Scrolling marquee of available memes */}
          <div className="marquee-section">
            <h3>🎭 Available Memes</h3>
            <div className="marquee-container">
              <div className="marquee">
                {availableImages.concat(availableImages).map((image, index) => (
                  <div key={`${image.name}-${index}`} className={`marquee-item ${image.cached ? 'cached' : 'uncached'}`}>
                    <a href={`#${image.name}`} className="marquee-link">
                      <span className="meme-name">{image.name}</span>
                      {image.cached && <span className="meme-ext">.{image.extension}</span>}
                      {image.cached && <span className="cached-badge">⚡</span>}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="supported-formats-section">
            <h3>📁 Supported Image Formats</h3>
            <div className="formats-grid">
              {['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'avif'].map((ext, index) => (
                <div key={index} className="format-card">
                  <span className="format-name">.{ext}</span>
                </div>
              ))}
            </div>
            <p className="note">
              Just upload your images to <code>/public/images/</code> and access them by name!<br/>
              The system will automatically detect the correct file extension and encoding.
            </p>
            
            {extensionCache.size > 0 && (
              <div className="cache-info">
                <h4>🚀 Cached Extensions ({extensionCache.size} images)</h4>
                <div className="cached-images">
                  {[...extensionCache.entries()].map(([imageName, extension]) => (
                    <div key={imageName} className="cached-image">
                      <a href={`#${imageName}`} className="cached-link">
                        <span className="image-name">{imageName}</span>
                        <span className="cached-ext">.{extension}</span>
                      </a>
                    </div>
                  ))}
                </div>
                <p className="cache-note">
                  <em>These images load instantly since their extensions are cached!</em>
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
