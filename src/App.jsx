import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [currentImage, setCurrentImage] = useState(null)
  const [actualImageFile, setActualImageFile] = useState(null)
  const [imageError, setImageError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Function to dynamically find image by trying common extensions
  const findImageWithExtension = async (imageName) => {
    // If the name already has an extension, return it as-is
    if (imageName.includes('.')) {
      return imageName
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
        
        const foundImage = await findImageWithExtension(hash)
        if (foundImage) {
          setActualImageFile(foundImage)
          setImageError(false)
        } else {
          setActualImageFile(null)
          setImageError(true)
        }
        setIsLoading(false)
      } else {
        setCurrentImage(null)
        setActualImageFile(null)
        setImageError(false)
        setIsLoading(false)
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

  const handleImageError = () => {
    setImageError(true)
  }

  // If there's a hash with an image name, show only the image
  if (currentImage) {
    return (
      <div className="app image-only">
        {isLoading ? (
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
        ) : (
          <img 
            src={`/images/${actualImageFile}`}
            alt={currentImage}
            onError={handleImageError}
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
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
