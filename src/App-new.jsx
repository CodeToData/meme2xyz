import { useState, useEffect } from 'react'
import { availableImages } from './imageConfig.js'
import './App.css'

function App() {
  const [currentImage, setCurrentImage] = useState(null)
  const [actualImageFile, setActualImageFile] = useState(null)
  const [imageError, setImageError] = useState(false)

  // Function to find image by filename (without extension)
  const findImageByName = (searchName) => {
    // First, try exact match (with extension)
    if (availableImages.includes(searchName)) {
      return searchName
    }
    
    // Then, try to find by filename without extension
    const foundImage = availableImages.find(img => {
      const nameWithoutExt = img.split('.').slice(0, -1).join('.')
      return nameWithoutExt.toLowerCase() === searchName.toLowerCase()
    })
    
    return foundImage || null
  }

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) // Remove the '#' symbol
      if (hash) {
        const foundImage = findImageByName(hash)
        if (foundImage) {
          setCurrentImage(hash)
          setActualImageFile(foundImage)
          setImageError(false)
        } else {
          setCurrentImage(hash)
          setActualImageFile(null)
          setImageError(true)
        }
      } else {
        setCurrentImage(null)
        setActualImageFile(null)
        setImageError(false)
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
        {imageError || !actualImageFile ? (
          <div className="error-simple">
            <h3>Image not found: {currentImage}</h3>
            <p>Available filenames (without extension):</p>
            <p>{availableImages.map(img => img.split('.').slice(0, -1).join('.')).join(', ')}</p>
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
                <code>xyz2.meme#[image-name]</code>
              </div>
              <p>Example: <a href="#sample-meme-1">xyz2.meme#sample-meme-1</a></p>
              <p><em>Note: You can use filenames with or without extensions!</em></p>
            </div>
          </div>

          <div className="available-images-section">
            <h3>📁 Available Images</h3>
            <div className="image-grid">
              {availableImages.map((image, index) => {
                const nameWithoutExt = image.split('.').slice(0, -1).join('.')
                return (
                  <div key={index} className="image-card">
                    <a href={`#${nameWithoutExt}`} className="image-link">
                      <p className="image-name">{nameWithoutExt}</p>
                    </a>
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
