import './App.css'

function App() {
  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1 className="title">Meme 2 XYZ</h1>
          <p className="subtitle">Transform your memes into something extraordinary</p>
        </header>
        
        <main className="main">
          <div className="coming-soon-container">
            <div className="marquee">
              <div className="marquee-content">
                🚀 Coming Soon 🚀 • 🎉 Get Ready 🎉 • 💫 Something Amazing 💫 • 🔥 Stay Tuned 🔥 • 
              </div>
            </div>
          </div>
          
          <div className="features">
            <div className="feature">
              <span className="emoji">🎨</span>
              <h3>Creative Tools</h3>
              <p>Advanced meme creation tools</p>
            </div>
            <div className="feature">
              <span className="emoji">⚡</span>
              <h3>Lightning Fast</h3>
              <p>Instant meme transformations</p>
            </div>
            <div className="feature">
              <span className="emoji">🌟</span>
              <h3>Premium Quality</h3>
              <p>High-quality output every time</p>
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
