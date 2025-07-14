// Image configuration for Meme 2 XYZ
// Add your image filenames here to make them available via hash URLs

export const availableImages = [
  'sample-meme-1.jpg',
  'sample-meme-2.jpg', 
  'sample-meme-3.jpg',
  'funny-cat.jpg',
  'epic-fail.jpg',
  'success-kid.jpg',
  'whatmeme.png'
]

// Function to check if an image exists
export const imageExists = (imageName) => {
  return availableImages.includes(imageName)
}

// Function to get image URL
export const getImageUrl = (imageName) => {
  return `/images/${imageName}`
}
