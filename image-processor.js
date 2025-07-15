import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import chokidar from 'chokidar';

class ImageProcessor {
  constructor(config = {}) {
    this.uploadsDir = config.uploadsDir || './uploads';
    this.publicDir = config.publicDir || './public/images';
    this.thumbnailsDir = config.thumbnailsDir || './public/thumbnails';
    this.maxDimensions = config.maxDimensions || { width: 1024, height: 768 };
    this.thumbnailDimensions = config.thumbnailDimensions || { width: 400, height: 300 };
    this.quality = config.quality || 85;
    
    // Supported image formats
    this.supportedFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
    
    // Image library data
    this.imageLibrary = new Map();
    this.libraryFile = './src/imageLibrary.json';
  }

  async initialize() {
    try {
      // Create directories if they don't exist
      await this.ensureDirectories();
      
      // Load existing image library
      await this.loadImageLibrary();
      
      // Process existing images in uploads folder
      await this.processExistingImages();
      
      // Start watching for new uploads
      this.startWatching();
      
      console.log('✅ Image Processor initialized successfully');
      console.log(`📁 Watching: ${this.uploadsDir}`);
      console.log(`🎯 Output: ${this.publicDir}`);
      console.log(`🖼️ Thumbnails: ${this.thumbnailsDir}`);
      
    } catch (error) {
      console.error('❌ Failed to initialize Image Processor:', error);
      throw error;
    }
  }

  async ensureDirectories() {
    const dirs = [this.uploadsDir, this.publicDir, this.thumbnailsDir];
    
    for (const dir of dirs) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    }
  }

  async loadImageLibrary() {
    try {
      const data = await fs.readFile(this.libraryFile, 'utf8');
      const libraryArray = JSON.parse(data);
      this.imageLibrary = new Map(libraryArray.map(item => [item.name, item]));
      console.log(`📚 Loaded ${this.imageLibrary.size} images from library`);
    } catch (error) {
      console.log('📚 No existing image library found, starting fresh');
      this.imageLibrary = new Map();
    }
  }

  async saveImageLibrary() {
    try {
      const libraryArray = Array.from(this.imageLibrary.values());
      await fs.writeFile(this.libraryFile, JSON.stringify(libraryArray, null, 2));
      console.log(`💾 Saved ${libraryArray.length} images to library`);
    } catch (error) {
      console.error('❌ Failed to save image library:', error);
    }
  }

  isImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedFormats.includes(ext);
  }

  generateImageName(filePath) {
    const baseName = path.basename(filePath, path.extname(filePath));
    // Clean the name for URL usage
    return baseName.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async getImageMetadata(filePath) {
    try {
      const metadata = await sharp(filePath).metadata();
      const stats = await fs.stat(filePath);
      
      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    } catch (error) {
      console.error(`❌ Failed to get metadata for ${filePath}:`, error);
      return null;
    }
  }

  async processImage(inputPath, outputName) {
    try {
      const originalMetadata = await this.getImageMetadata(inputPath);
      if (!originalMetadata) return null;

      const outputExt = '.jpg'; // Convert everything to JPG for consistency
      const optimizedPath = path.join(this.publicDir, `${outputName}${outputExt}`);
      const thumbnailPath = path.join(this.thumbnailsDir, `${outputName}${outputExt}`);

      // Calculate dimensions maintaining aspect ratio
      const aspectRatio = originalMetadata.width / originalMetadata.height;
      let { width: maxWidth, height: maxHeight } = this.maxDimensions;
      let { width: thumbWidth, height: thumbHeight } = this.thumbnailDimensions;

      // Resize for optimized version
      if (originalMetadata.width > maxWidth || originalMetadata.height > maxHeight) {
        if (aspectRatio > maxWidth / maxHeight) {
          maxHeight = Math.round(maxWidth / aspectRatio);
        } else {
          maxWidth = Math.round(maxHeight * aspectRatio);
        }
      } else {
        maxWidth = originalMetadata.width;
        maxHeight = originalMetadata.height;
      }

      // Resize for thumbnail
      if (aspectRatio > thumbWidth / thumbHeight) {
        thumbHeight = Math.round(thumbWidth / aspectRatio);
      } else {
        thumbWidth = Math.round(thumbHeight * aspectRatio);
      }

      // Process optimized version
      await sharp(inputPath)
        .resize(maxWidth, maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: this.quality })
        .toFile(optimizedPath);

      // Process thumbnail
      await sharp(inputPath)
        .resize(thumbWidth, thumbHeight, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: this.quality })
        .toFile(thumbnailPath);

      // Get final file sizes
      const optimizedStats = await fs.stat(optimizedPath);
      const thumbnailStats = await fs.stat(thumbnailPath);

      const imageData = {
        name: outputName,
        filename: `${outputName}${outputExt}`,
        extension: outputExt.slice(1),
        url: `/images/${outputName}${outputExt}`,
        thumbnailUrl: `/thumbnails/${outputName}${outputExt}`,
        originalSize: originalMetadata.size,
        optimizedSize: optimizedStats.size,
        thumbnailSize: thumbnailStats.size,
        dimensions: {
          original: { width: originalMetadata.width, height: originalMetadata.height },
          optimized: { width: maxWidth, height: maxHeight },
          thumbnail: { width: thumbWidth, height: thumbHeight }
        },
        compression: ((originalMetadata.size - optimizedStats.size) / originalMetadata.size * 100).toFixed(1),
        processed: new Date().toISOString()
      };

      // Add to library
      this.imageLibrary.set(outputName, imageData);
      await this.saveImageLibrary();

      console.log(`✅ Processed: ${outputName}`);
      console.log(`   📊 Original: ${this.formatFileSize(originalMetadata.size)} (${originalMetadata.width}x${originalMetadata.height})`);
      console.log(`   📊 Optimized: ${this.formatFileSize(optimizedStats.size)} (${maxWidth}x${maxHeight})`);
      console.log(`   📊 Thumbnail: ${this.formatFileSize(thumbnailStats.size)} (${thumbWidth}x${thumbHeight})`);
      console.log(`   📊 Saved: ${imageData.compression}% bandwidth`);

      return imageData;

    } catch (error) {
      console.error(`❌ Failed to process ${inputPath}:`, error);
      return null;
    }
  }

  async processExistingImages() {
    try {
      const files = await fs.readdir(this.uploadsDir);
      const imageFiles = files.filter(file => this.isImageFile(file));

      console.log(`🔍 Found ${imageFiles.length} images in uploads folder`);

      for (const file of imageFiles) {
        const inputPath = path.join(this.uploadsDir, file);
        const outputName = this.generateImageName(file);

        // Skip if already processed and file hasn't changed
        if (this.imageLibrary.has(outputName)) {
          const existingImage = this.imageLibrary.get(outputName);
          const stats = await fs.stat(inputPath);
          
          if (existingImage.processed && new Date(existingImage.processed) >= stats.mtime) {
            console.log(`⏭️ Skipping ${outputName} (already processed)`);
            continue;
          }
        }

        await this.processImage(inputPath, outputName);
      }

    } catch (error) {
      console.error('❌ Failed to process existing images:', error);
    }
  }

  startWatching() {
    const watcher = chokidar.watch(this.uploadsDir, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true
    });

    watcher
      .on('add', async (filePath) => {
        if (this.isImageFile(filePath)) {
          console.log(`📸 New image detected: ${path.basename(filePath)}`);
          const outputName = this.generateImageName(filePath);
          await this.processImage(filePath, outputName);
        }
      })
      .on('change', async (filePath) => {
        if (this.isImageFile(filePath)) {
          console.log(`🔄 Image updated: ${path.basename(filePath)}`);
          const outputName = this.generateImageName(filePath);
          await this.processImage(filePath, outputName);
        }
      })
      .on('error', error => console.error('❌ Watcher error:', error));

    console.log('👀 Started watching for new images...');
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getLibraryStats() {
    const images = Array.from(this.imageLibrary.values());
    const totalOriginal = images.reduce((sum, img) => sum + (img.originalSize || 0), 0);
    const totalOptimized = images.reduce((sum, img) => sum + (img.optimizedSize || 0), 0);
    const totalThumbnails = images.reduce((sum, img) => sum + (img.thumbnailSize || 0), 0);
    const totalSaved = totalOriginal - totalOptimized;
    const avgCompression = totalOriginal > 0 ? (totalSaved / totalOriginal * 100).toFixed(1) : 0;

    return {
      totalImages: images.length,
      totalOriginalSize: this.formatFileSize(totalOriginal),
      totalOptimizedSize: this.formatFileSize(totalOptimized),
      totalThumbnailSize: this.formatFileSize(totalThumbnails),
      totalSaved: this.formatFileSize(totalSaved),
      avgCompression: `${avgCompression}%`
    };
  }

  async generateImageConfig() {
    const images = Array.from(this.imageLibrary.values());
    const config = images.map(img => ({
      name: img.name,
      filename: img.filename,
      extension: img.extension,
      url: img.url,
      thumbnailUrl: img.thumbnailUrl,
      dimensions: img.dimensions
    }));

    await fs.writeFile('./src/imageConfig.js', 
      `// Auto-generated image configuration
export const imageConfig = ${JSON.stringify(config, null, 2)};

export default imageConfig;
`);
    
    console.log('📝 Generated imageConfig.js with all processed images');
  }
}

export default ImageProcessor;
