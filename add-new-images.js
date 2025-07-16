#!/usr/bin/env node

/**
 * Automated Image Upload Script for meme2xyz
 * Scans the /public/images folder and automatically updates images.json
 * Usage: node add-new-images.js
 */

import { promises as fs } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const IMAGES_DIR = path.join(__dirname, 'public', 'images')
const IMAGES_JSON = path.join(IMAGES_DIR, 'images.json')
const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']

/**
 * Get file extension and name info
 */
function getImageInfo(filename) {
  const ext = path.extname(filename).toLowerCase()
  const name = path.basename(filename, ext)
  
  return {
    name: name,
    filename: filename,
    extension: ext.slice(1), // Remove the dot
    url: `/images/${filename}`
  }
}

/**
 * Check if file is a supported image
 */
function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase()
  return SUPPORTED_EXTENSIONS.includes(ext)
}

/**
 * Scan images directory and get all image files
 */
async function scanImagesDirectory() {
  try {
    const files = await fs.readdir(IMAGES_DIR)
    
    const imageFiles = files
      .filter(file => isImageFile(file))
      .filter(file => !file.startsWith('.') && file !== 'images.json')
      .sort()
    
    return imageFiles.map(getImageInfo)
  } catch (error) {
    console.error('❌ Error scanning images directory:', error)
    return []
  }
}

/**
 * Load existing images.json
 */
async function loadExistingImages() {
  try {
    const data = await fs.readFile(IMAGES_JSON, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.log('📝 No existing images.json found, creating new one')
    return []
  }
}

/**
 * Save updated images.json
 */
async function saveImagesJson(images) {
  try {
    const jsonContent = JSON.stringify(images, null, 2)
    await fs.writeFile(IMAGES_JSON, jsonContent, 'utf8')
    console.log('✅ Updated images.json successfully')
  } catch (error) {
    console.error('❌ Error saving images.json:', error)
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Scanning for new images...')
  
  // Get current images from filesystem
  const currentImages = await scanImagesDirectory()
  
  // Get existing images from JSON
  const existingImages = await loadExistingImages()
  const existingNames = new Set(existingImages.map(img => img.name))
  
  // Find new images
  const newImages = currentImages.filter(img => !existingNames.has(img.name))
  
  if (newImages.length === 0) {
    console.log('✅ No new images found - images.json is up to date')
    return
  }
  
  console.log(`🆕 Found ${newImages.length} new image(s):`)
  newImages.forEach(img => {
    console.log(`   📸 ${img.filename} (${img.extension.toUpperCase()})`)
  })
  
  // Merge and sort all images alphabetically
  const allImages = [...existingImages, ...newImages]
    .sort((a, b) => a.name.localeCompare(b.name))
  
  // Save updated JSON
  await saveImagesJson(allImages)
  
  // Check for removed images
  const currentNames = new Set(currentImages.map(img => img.name))
  const removedImages = existingImages.filter(img => !currentNames.has(img.name))
  
  if (removedImages.length > 0) {
    console.log(`🗑️ Removed ${removedImages.length} missing image(s):`)
    removedImages.forEach(img => {
      console.log(`   🗑️ ${img.filename}`)
    })
  }
  
  console.log('')
  console.log('📊 Summary:')
  console.log(`   📁 Total images: ${allImages.length}`)
  console.log(`   🆕 New images: ${newImages.length}`)
  console.log(`   🗑️ Removed: ${removedImages.length}`)
  console.log('')
  console.log('💡 Next steps:')
  console.log('   1. git add public/images/images.json')
  console.log('   2. git commit -m "Add new images"')
  console.log('   3. git push')
}

main().catch(error => {
  console.error('💥 Script failed:', error)
  process.exit(1)
})
