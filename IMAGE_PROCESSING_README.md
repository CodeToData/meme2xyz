# Image Processing Scripts

A collection of scripts to automatically optimize images for bandwidth reduction and manage your meme library.

## Features

- **Automatic Image Processing**: Converts images to max 1024x768 resolution
- **Thumbnail Generation**: Creates 400x300 thumbnails for fast loading
- **Real-time Monitoring**: Watches uploads folder for new images
- **Bandwidth Optimization**: Reduces file sizes by 60-85% typically
- **Auto Library Management**: Updates image library automatically
- **Upload Server**: REST API for uploading and managing images

## Setup

1. Install dependencies:
```bash
npm install sharp chokidar express multer
```

2. Create required directories:
```bash
mkdir uploads public/images public/thumbnails
```

## Usage

### 1. Start the Image Processor (watches uploads folder)
```bash
node process-images.js
```

### 2. Start the Upload Server (optional - for web uploads)
```bash
node upload-server.js
```

### 3. Add images to process
Simply copy images to the `./uploads` folder and they'll be processed automatically.

## How it Works

1. **Input**: Place images in `./uploads/` folder
2. **Processing**: 
   - Resizes to max 1024x768 (maintains aspect ratio)
   - Converts to JPG format with 85% quality
   - Creates 400x300 thumbnail
   - Updates image library
3. **Output**: 
   - Optimized images in `./public/images/`
   - Thumbnails in `./public/thumbnails/`
   - Library data in `./src/imageLibrary.json`
   - Config for React in `./src/imageConfig.js`

## File Structure
```
uploads/           # Input folder - add your images here
public/
  images/          # Optimized images (1024x768 max)
  thumbnails/      # Thumbnails (400x300 max)
src/
  imageLibrary.json  # Library database
  imageConfig.js     # React configuration
```

## API Endpoints (Upload Server)

- `POST /upload` - Upload new image
- `GET /api/stats` - Get library statistics
- `GET /api/images` - Get all processed images
- `POST /api/process/:filename` - Process specific image
- `GET /health` - Health check

## Configuration

Edit the configuration in `process-images.js`:

```javascript
const processor = new ImageProcessor({
  uploadsDir: './uploads',
  publicDir: './public/images', 
  thumbnailsDir: './public/thumbnails',
  maxDimensions: { width: 1024, height: 768 },
  thumbnailDimensions: { width: 400, height: 300 },
  quality: 85
});
```

## Bandwidth Savings

Typical file size reductions:
- Original: 2-8 MB
- Optimized: 200-800 KB (60-85% reduction)
- Thumbnail: 30-80 KB
- Total bandwidth savings: 70-90%
