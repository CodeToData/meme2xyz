#!/usr/bin/env node

import ImageProcessor from './image-processor.js';

async function main() {
  console.log('🚀 Starting Image Processing System...');
  
  const processor = new ImageProcessor({
    uploadsDir: './uploads',
    publicDir: './public/images',
    thumbnailsDir: './public/thumbnails',
    maxDimensions: { width: 1024, height: 768 },
    thumbnailDimensions: { width: 400, height: 300 },
    quality: 85
  });

  try {
    await processor.initialize();
    
    // Generate image config for the React app
    await processor.generateImageConfig();
    
    // Show stats
    const stats = processor.getLibraryStats();
    console.log('\n📊 Library Statistics:');
    console.log(`   📸 Total Images: ${stats.totalImages}`);
    console.log(`   📦 Original Size: ${stats.totalOriginalSize}`);
    console.log(`   📦 Optimized Size: ${stats.totalOptimizedSize}`);
    console.log(`   📦 Thumbnail Size: ${stats.totalThumbnailSize}`);
    console.log(`   💾 Space Saved: ${stats.totalSaved} (${stats.avgCompression})`);
    
    console.log('\n✅ Image processor is running. Add images to ./uploads to process them automatically.');
    console.log('📝 Press Ctrl+C to stop.');
    
    // Keep the process running
    process.on('SIGINT', () => {
      console.log('\n👋 Shutting down image processor...');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('💥 Failed to start image processor:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
main().catch(console.error);

export { ImageProcessor };
