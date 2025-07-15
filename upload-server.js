import express from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import ImageProcessor from './image-processor.js';

class UploadServer {
  constructor(port = 3001) {
    this.app = express();
    this.port = port;
    this.processor = new ImageProcessor();
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // Enable CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });

    // Setup multer for file uploads
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, './uploads');
      },
      filename: (req, file, cb) => {
        // Keep original filename
        cb(null, file.originalname);
      }
    });

    this.upload = multer({
      storage: storage,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only images are allowed.'));
        }
      }
    });

    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  setupRoutes() {
    // Upload endpoint
    this.app.post('/upload', this.upload.single('image'), async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log(`📤 Upload received: ${req.file.originalname}`);
        
        // The file watcher will automatically process this image
        // We just need to wait a moment and return the expected name
        const outputName = this.processor.generateImageName(req.file.path);
        
        res.json({
          success: true,
          message: 'Image uploaded and will be processed automatically',
          filename: req.file.filename,
          processedName: outputName,
          size: req.file.size
        });

      } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({ error: 'Upload failed', details: error.message });
      }
    });

    // Get library stats
    this.app.get('/api/stats', (req, res) => {
      const stats = this.processor.getLibraryStats();
      res.json(stats);
    });

    // Get all images in library
    this.app.get('/api/images', (req, res) => {
      const images = Array.from(this.processor.imageLibrary.values());
      res.json(images);
    });

    // Process specific image
    this.app.post('/api/process/:filename', async (req, res) => {
      try {
        const { filename } = req.params;
        const inputPath = path.join('./uploads', filename);
        
        // Check if file exists
        try {
          await fs.access(inputPath);
        } catch {
          return res.status(404).json({ error: 'File not found' });
        }

        const outputName = this.processor.generateImageName(inputPath);
        const result = await this.processor.processImage(inputPath, outputName);

        if (result) {
          res.json({ success: true, image: result });
        } else {
          res.status(500).json({ error: 'Processing failed' });
        }

      } catch (error) {
        console.error('❌ Processing error:', error);
        res.status(500).json({ error: 'Processing failed', details: error.message });
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'OK', message: 'Image processing server is running' });
    });
  }

  async start() {
    try {
      // Initialize the image processor
      await this.processor.initialize();
      
      // Start the server
      this.app.listen(this.port, () => {
        console.log(`🌐 Upload server running on http://localhost:${this.port}`);
        console.log(`📤 Upload endpoint: http://localhost:${this.port}/upload`);
        console.log(`📊 Stats endpoint: http://localhost:${this.port}/api/stats`);
        console.log(`🖼️ Images endpoint: http://localhost:${this.port}/api/images`);
      });

    } catch (error) {
      console.error('💥 Failed to start upload server:', error);
      throw error;
    }
  }
}

module.exports = UploadServer;

// If run directly
if (require.main === module) {
  const server = new UploadServer(3001);
  server.start().catch(console.error);
}
