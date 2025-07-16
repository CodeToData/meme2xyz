#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';

async function generateImagesJson() {
  try {
    const imagesDir = './public/images';
    const exclusionsPath = path.join(imagesDir, 'exclusions.json');
    const outputPath = path.join(imagesDir, 'images.json');
    
    // Load exclusions list
    let excludedFiles = [];
    try {
      const exclusionsData = await fs.readFile(exclusionsPath, 'utf-8');
      const exclusionsJson = JSON.parse(exclusionsData);
      excludedFiles = exclusionsJson.excludedFiles || [];
      console.log(`📋 Loaded ${excludedFiles.length} exclusions from exclusions.json`);
    } catch (error) {
      console.log('📋 No exclusions file found, using empty exclusions list');
    }

    // Read all files in images directory
    const files = await fs.readdir(imagesDir);
    
    // Filter to only image files and exclude problematic ones
    const supportedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      const isImageFile = supportedExtensions.includes(ext);
      const isNotExcluded = !excludedFiles.includes(file);
      
      if (isImageFile && !isNotExcluded) {
        console.log(`⏭️ Excluding: ${file} (in exclusions list)`);
      }
      
      return isImageFile && isNotExcluded;
    });

    // Convert to image objects
    const images = imageFiles.map(file => {
      const nameWithoutExt = path.basename(file, path.extname(file));
      const extension = path.extname(file).slice(1); // Remove the dot
      
      return {
        name: nameWithoutExt,
        filename: file,
        extension: extension,
        url: `/images/${file}`
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    // Write the generated JSON
    await fs.writeFile(outputPath, JSON.stringify(images, null, 2));
    
    console.log(`✅ Generated images.json with ${images.length} images`);
    console.log(`📊 Excluded ${excludedFiles.length} files`);
    console.log(`📁 Total files processed: ${files.length}`);
    
    // Log the included images
    console.log('📸 Included images:');
    images.forEach(img => {
      console.log(`   - ${img.name}.${img.extension}`);
    });

  } catch (error) {
    console.error('❌ Error generating images.json:', error);
    process.exit(1);
  }
}

generateImagesJson().catch(console.error);
