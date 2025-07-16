import { useState, useEffect } from 'react'
import './App.css'

// SIMPLE VERSION - No complex optimizations
function App() {
  const [images, setImages] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalImage, setModalImage] = useState(null)

  // Simple image list - no complex discovery
  const simpleImages = [
    'faust.jpeg',
    'lnc.png',
    'locked.gif',
    'marx.png',
    'nuffsaid.jpg',
    'shane.jpg',
    'sorry.gif',
    'ultrafrog.gif',
    'unusual.png',
    'waiting.jpg',
    'whatmeme.png'
  ]

  useEffect(() => {
    // Simple setup - just use the basic image list
    const imageObjects = simpleImages.map(name => ({
      name: name.split('.')[0],
      url: `/images/${name}`
    }))
    setImages(imageObjects)
    console.log('✅ Simple mode: Loaded', imageObjects.length, 'images')
  }, [])

  const openModal = (image) => {
    setModalImage(image)
    setIsModalOpen(true)
    console.log('Opening modal for:', image.name)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setModalImage(null)
  }

  return (
    <div className="app">
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1 className="title">🔧 DEBUG MODE</h1>
        <p style={{ color: 'white', marginBottom: '2rem' }}>
          Simple version to test basic functionality
        </p>
        
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '1rem',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          {images.map((image) => (
            <div 
              key={image.name}
              onClick={() => openModal(image)}
              style={{
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '1rem',
                transition: 'transform 0.2s',
                border: '1px solid rgba(255,255,255,0.2)'
              }}
              onMouseOver={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
            >
              <img 
                src={image.url}
                alt={image.name}
                style={{
                  width: '100%',
                  height: '150px',
                  objectFit: 'cover',
                  borderRadius: '4px',
                  marginBottom: '0.5rem'
                }}
                onError={(e) => {
                  console.error('Image failed to load:', image.url)
                  e.target.style.background = '#ff4444'
                  e.target.alt = 'Failed to load'
                }}
              />
              <p style={{ color: 'white', margin: 0, fontSize: '0.9rem' }}>
                #{image.name}
              </p>
            </div>
          ))}
        </div>

        {images.length === 0 && (
          <div style={{ color: 'white', padding: '2rem' }}>
            Loading images...
          </div>
        )}
      </div>

      {/* Simple Modal */}
      {isModalOpen && modalImage && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={closeModal}
        >
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button 
              onClick={closeModal}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'none',
                border: 'none',
                color: 'white',
                fontSize: '2rem',
                cursor: 'pointer'
              }}
            >
              ×
            </button>
            <img 
              src={modalImage.url}
              alt={modalImage.name}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default App
