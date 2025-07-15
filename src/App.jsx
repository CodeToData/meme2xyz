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

  // Function to fetch available images from the server
  const fetchAvailableImages = async () => {
    try {
      const response = await fetch('/api/images')
      if (response.ok) {
        const images = await response.json()
        setAvailableImages(images)
        console.log('Fetched images:', images)
      } else {
        console.error('Failed to fetch images:', response.statusText)
      }
    } catch (error) {
      console.error('Error fetching images:', error)
    }
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

  // If there's a hash with an image name, show only the image
  if (currentImage) {
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
              src={`/images/${actualImageFile}`}
              alt=""
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{ display: 'none' }}
            />
            {/* Show image only when loaded */}
            {imageLoaded && (
              <img 
                src={`/images/${actualImageFile}`}
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
              <p>Access any image by using the format:</p>
              <div className="url-format">
                <code>meme2.xyz#[image-name]</code>
              </div>
              <p>Example: <a href="#whatmeme">meme2.xyz#whatmeme</a></p>
              <p><em>Note: You can use filenames with or without extensions!</em></p>
              <p><em>The system will automatically detect the correct file extension.</em></p>
            </div>
          </div>

          {/* Enhanced Image Marquee */}
          <div className="image-marquee-section">
            <h2>🎭 Browse Memes</h2>
            <div className="image-marquee-container">
              <div className="image-marquee">
                {/* Duplicate the array to create seamless infinite scroll */}
                {availableImages.concat(availableImages).map((image, index) => (
                  <div key={`${image.name}-${index}`} className="image-marquee-item">
                    <a href={`#${image.name}`} className="image-marquee-link">
                      <div className="image-preview">
                        <img 
                          src={image.url} 
                          alt={image.name}
                          className="marquee-thumbnail"
                          loading="lazy"
                        />
                        <div className="image-hashtag-overlay">
                          #{image.name}
                        </div>
                      </div>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}

export default App
