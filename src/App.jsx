import { useState, useEffect } from 'react'
import { availableImages } from './imageConfig.js'
import './App.css'

function App() {
  const [currentImage, setCurrentImage] = useState(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) // Remove the '#' symbol
      if (hash) {
        setCurrentImage(hash)
        setImageError(false)
      } else {
        setCurrentImage(null)
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
        {imageError ? (
          <div className="error-simple">
            <h3>Image not found: {currentImage}</h3>
            <p>Available images: {availableImages.join(', ')}</p>
          </div>
        ) : (
          <img 
            src={`/images/${currentImage}`}
            alt={currentImage}
            onError={handleImageError}
            className="full-image"
          />
        )}
      </div>
    )
  }

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1 className="title">Meme 2 XYZ</h1>
          <p className="subtitle">Transform your memes into something extraordinary</p>
        </header>
        
        <main className="main">
          <div className="usage-section">
            <h2>🖼️ How to Use</h2>
            <div className="usage-card">
              <p>Access any image by using the format:</p>
              <div className="url-format">
                <code>xyz2.meme#[image-name]</code>
              </div>
              <p>Example: <a href="#sample-meme-1.jpg">xyz2.meme#sample-meme-1.jpg</a></p>
            </div>
          </div>

          <div className="available-images-section">
            <h3>📁 Available Images</h3>
            <div className="image-grid">
              {availableImages.map((image, index) => (
                <div key={index} className="image-card">
                  <a href={`#${image}`} className="image-link">
                    <div className="image-preview">
                      <img 
                        src={`/images/${image}`}
                        alt={image}
                        onError={(e) => {
                          e.target.style.display = 'none'
                          e.target.nextSibling.style.display = 'flex'
                        }}
                      />
                      <div className="placeholder" style={{display: 'none'}}>
                        �️
                      </div>
                    </div>
                    <p className="image-name">{image}</p>
                  </a>
                </div>
              ))}
            </div>
          </div>
          
          <div className="features">
            <div className="feature">
              <span className="emoji">🔗</span>
              <h3>Direct Links</h3>
              <p>Share images with simple hash URLs</p>
            </div>
            <div className="feature">
              <span className="emoji">⚡</span>
              <h3>Instant Access</h3>
              <p>No page reloads, just pure speed</p>
            </div>
            <div className="feature">
              <span className="emoji">📱</span>
              <h3>Mobile Friendly</h3>
              <p>Perfect viewing on any device</p>
            </div>
          </div>
        </main>
        
        <footer className="footer">
          <p>&copy; 2025 Meme 2 XYZ. All rights reserved.</p>
        </footer>
      </div>
    </div>
  )
}

export default App
