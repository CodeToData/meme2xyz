import express from 'express'
import multer from 'multer'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import validator from 'validator'
import xss from 'xss'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001

// Rate limiting for submissions
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 submissions per windowMs
  message: {
    error: 'Too many submissions from this IP. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
})

// Text sanitization function
function sanitizeUserText(text) {
  if (!text || typeof text !== 'string') {
    return ''
  }

  // First pass: Remove dangerous characters and patterns
  let cleaned = text
    // Remove null bytes and control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    // Remove excessive whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // XSS protection - remove scripts and dangerous patterns
  cleaned = xss(cleaned, {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe']
  })

  // Additional security patterns to remove
  const dangerousPatterns = [
    /javascript:/gi,
    /vbscript:/gi,
    /data:/gi,
    /on\w+\s*=/gi,
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>.*?<\/iframe>/gi,
    /eval\s*\(/gi,
    /function\s*\(/gi,
    /new\s+function/gi,
    /document\./gi,
    /window\./gi,
    /alert\s*\(/gi,
    /prompt\s*\(/gi,
    /confirm\s*\(/gi
  ]

  for (const pattern of dangerousPatterns) {
    cleaned = cleaned.replace(pattern, '')
  }

  // Escape any remaining HTML entities
  cleaned = validator.escape(cleaned)

  // Final length check
  if (cleaned.length > 500) {
    cleaned = cleaned.substring(0, 500)
  }

  return cleaned
}

// Validation function
function validateSubmissionText(text) {
  const sanitized = sanitizeUserText(text)
  
  if (!sanitized || sanitized.length < 3) {
    return {
      isValid: false,
      error: 'Text must be at least 3 characters long.',
      sanitized: ''
    }
  }

  if (sanitized.length > 500) {
    return {
      isValid: false,
      error: 'Text must be 500 characters or less.',
      sanitized: ''
    }
  }

  // Check if the sanitized text is substantially different from original
  // This might indicate malicious content was removed
  const originalLength = (text || '').length
  const sanitizedLength = sanitized.length
  
  if (originalLength > 0 && sanitizedLength < originalLength * 0.5) {
    return {
      isValid: false,
      error: 'Text contains invalid content. Please use plain text only.',
      sanitized: ''
    }
  }

  return {
    isValid: true,
    error: null,
    sanitized
  }
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"]
    }
  }
}))
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use(generalLimiter) // Apply rate limiting to all routes
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

// Simple in-memory storage for now (replace with real database later)
let submissions = []
let nextId = 1

// API Routes

// Submit a new meme
app.post('/api/submissions', submissionLimiter, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' })
  }

  const { text, timestamp } = req.body

  // Validate and sanitize the text input
  const validation = validateSubmissionText(text)
  
  if (!validation.isValid) {
    // Clean up uploaded file since validation failed
    try {
      fs.unlinkSync(req.file.path)
    } catch (err) {
      console.warn('Failed to clean up uploaded file:', err.message)
    }
    return res.status(400).json({ error: validation.error })
  }

  // Additional filename sanitization
  const sanitizedOriginalName = path.basename(req.file.originalname)
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 100)

  // Add submission to in-memory storage
  const submission = {
    id: nextId++,
    filename: req.file.filename,
    original_name: sanitizedOriginalName,
    user_text: validation.sanitized, // Use sanitized text
    timestamp: timestamp || new Date().toISOString(),
    approved: 0, // 0=pending, 1=approved, -1=rejected
    created_at: new Date().toISOString()
  }

  submissions.push(submission)

  console.log('New submission received:', {
    id: submission.id,
    filename: submission.filename,
    text: submission.user_text.substring(0, 50) + (submission.user_text.length > 50 ? '...' : ''),
    sanitization: 'applied'
  })

  res.json({
    success: true,
    id: submission.id,
    message: 'Submission received! It will be reviewed for approval.'
  })
})

// Get all submissions (for admin review)
app.get('/api/admin/submissions', (req, res) => {
  console.log(`📊 Admin API called - returning ${submissions.length} submissions`)
  console.log('Submissions:', submissions.map(s => ({ id: s.id, text: s.user_text, approved: s.approved })))
  res.json(submissions.slice().reverse()) // Most recent first
})

// Approve/reject a submission
app.patch('/api/admin/submissions/:id', (req, res) => {
  const { id } = req.params
  const { approved } = req.body

  if (approved !== 0 && approved !== 1 && approved !== -1) {
    return res.status(400).json({ error: 'Approved must be 0, 1, or -1' })
  }

  const submission = submissions.find(s => s.id === parseInt(id))
  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' })
  }

  submission.approved = approved

  // If approved, copy file to public images directory
  if (approved === 1) {
    const srcPath = path.join(uploadsDir, submission.filename)
    const publicImagesDir = path.join(__dirname, 'public', 'images')
    
    // Create public/images directory if it doesn't exist
    if (!fs.existsSync(publicImagesDir)) {
      fs.mkdirSync(publicImagesDir, { recursive: true })
    }
    
    const destPath = path.join(publicImagesDir, submission.original_name)
    
    fs.copyFile(srcPath, destPath, (err) => {
      if (err) {
        console.error('Error copying approved file:', err.message)
      } else {
        console.log(`Approved file copied to: ${destPath}`)
      }
    })
  }

  console.log(`Submission ${id} ${approved === 1 ? 'approved' : approved === -1 ? 'rejected' : 'set to pending'}`)

  res.json({
    success: true,
    message: approved === 1 ? 'Submission approved' : approved === -1 ? 'Submission rejected' : 'Submission set to pending'
  })
})

// Get available images from public/images directory
app.get('/api/images', (req, res) => {
  try {
    const imagesDir = path.join(__dirname, 'public', 'images')
    console.log('Reading images from:', imagesDir)
    
    if (!fs.existsSync(imagesDir)) {
      console.log('Images directory does not exist')
      return res.json([])
    }
    
    const files = fs.readdirSync(imagesDir)
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff', '.avif']
    
    const images = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase()
        return imageExtensions.includes(ext)
      })
      .map(file => {
        const name = path.parse(file).name
        const extension = path.extname(file).slice(1)
        return {
          name,
          filename: file,
          extension,
          url: `/images/${file}`
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))
    
    console.log(`Found ${images.length} images:`, images.map(img => img.filename))
    res.json(images)
  } catch (error) {
    console.error('Error reading images directory:', error)
    res.status(500).json({ error: 'Failed to load images' })
  }
})

// Get approved memes (for the main site)
app.get('/api/approved-memes', (req, res) => {
  const approvedMemes = submissions
    .filter(s => s.approved === 1)
    .map(s => ({
      original_name: s.original_name,
      user_text: s.user_text,
      timestamp: s.timestamp
    }))
    .reverse() // Most recent first

  res.json(approvedMemes)
})

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir))

// Serve public images
app.use('/images', express.static(path.join(__dirname, 'public', 'images')))

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
  console.log(`Main site: http://localhost:${PORT}`)
  console.log(`Admin panel: http://localhost:${PORT}/admin`)
  console.log(`Current submissions: ${submissions.length}`)
  console.log(`🛡️  Security features enabled: Rate limiting, Text sanitization, XSS protection`)
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...')
  console.log(`Final submission count: ${submissions.length}`)
  process.exit(0)
})
