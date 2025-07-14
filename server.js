import express from 'express'
import multer from 'multer'
import sqlite3Pkg from 'sqlite3'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const sqlite3 = sqlite3Pkg.verbose()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.static('dist'))

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, 'meme-' + uniqueSuffix + ext)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed!'), false)
    }
  }
})

// Initialize SQLite database
const db = new sqlite3.Database('memes.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message)
  } else {
    console.log('Connected to SQLite database')
    
    // Create submissions table if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        user_text TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        approved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating table:', err.message)
      } else {
        console.log('Submissions table ready')
      }
    })
  }
})

// API Routes

// Submit a new meme
app.post('/api/submissions', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' })
  }

  const { text, timestamp } = req.body

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Text is required' })
  }

  // Insert submission into database
  const sql = `
    INSERT INTO submissions (filename, original_name, user_text, timestamp, approved)
    VALUES (?, ?, ?, ?, 0)
  `

  db.run(sql, [req.file.filename, req.file.originalname, text.trim(), timestamp], function(err) {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Failed to save submission' })
    }

    res.json({
      success: true,
      id: this.lastID,
      message: 'Submission received! It will be reviewed for approval.'
    })
  })
})

// Get all submissions (for admin review)
app.get('/api/admin/submissions', (req, res) => {
  const sql = `
    SELECT id, filename, original_name, user_text, timestamp, approved, created_at
    FROM submissions
    ORDER BY created_at DESC
  `

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Failed to fetch submissions' })
    }

    res.json(rows)
  })
})

// Approve/reject a submission
app.patch('/api/admin/submissions/:id', (req, res) => {
  const { id } = req.params
  const { approved } = req.body

  if (approved !== 0 && approved !== 1) {
    return res.status(400).json({ error: 'Approved must be 0 or 1' })
  }

  const sql = `UPDATE submissions SET approved = ? WHERE id = ?`

  db.run(sql, [approved, id], function(err) {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Failed to update submission' })
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Submission not found' })
    }

    // If approved, copy file to public images directory
    if (approved === 1) {
      db.get('SELECT filename, original_name FROM submissions WHERE id = ?', [id], (err, row) => {
        if (!err && row) {
          const srcPath = path.join(uploadsDir, row.filename)
          const destPath = path.join(__dirname, 'public', 'images', row.original_name)
          
          fs.copyFile(srcPath, destPath, (err) => {
            if (err) {
              console.error('Error copying approved file:', err.message)
            } else {
              console.log(`Approved file copied to: ${destPath}`)
            }
          })
        }
      })
    }

    res.json({
      success: true,
      message: approved ? 'Submission approved' : 'Submission rejected'
    })
  })
})

// Get approved memes (for the main site)
app.get('/api/approved-memes', (req, res) => {
  const sql = `
    SELECT original_name, user_text, timestamp
    FROM submissions
    WHERE approved = 1
    ORDER BY created_at DESC
  `

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Database error:', err.message)
      return res.status(500).json({ error: 'Failed to fetch approved memes' })
    }

    res.json(rows)
  })
})

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir))

// Admin panel route
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'))
})

// Serve the main app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' })
    }
  }
  
  if (error.message === 'Only image files are allowed!') {
    return res.status(400).json({ error: error.message })
  }

  console.error('Server error:', error)
  res.status(500).json({ error: 'Internal server error' })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Admin panel available at: http://localhost:${PORT}/admin`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...')
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message)
    } else {
      console.log('Database connection closed')
    }
    process.exit(0)
  })
})
