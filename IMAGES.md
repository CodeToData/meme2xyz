# Dynamic Image Management

This project now uses a dynamic image discovery system with exclusions support.

## How It Works

1. **Automatic Discovery**: The system scans the `public/images/` directory for all image files
2. **Exclusions Support**: Files listed in `public/images/exclusions.json` are automatically skipped
3. **Dynamic Generation**: The `images.json` file is generated automatically based on available files

## Managing Exclusions

To exclude problematic or unwanted images:

1. Edit `public/images/exclusions.json`
2. Add filenames to the `excludedFiles` array
3. Run `npm run generate-images` to update the images list
4. Or run `npm run build` which automatically generates the list

### Example exclusions.json:
```json
{
  "excludedFiles": [
    "sample-meme-1.jpg",
    "sample-meme-2.jpg", 
    "sample-meme-3.jpg",
    "images.json",
    "exclusions.json"
  ],
  "reason": "Files that are corrupted, test files, or metadata files"
}
```

## Commands

- `npm run generate-images` - Generate images.json from current files
- `npm run build` - Build the project (automatically generates images.json)
- `npm run dev` - Start development server

## Adding New Images

1. Add image files to `public/images/`
2. Run `npm run generate-images` to update the list
3. If thumbnails are needed, run `npm run process-images`

The system will automatically discover new images unless they're in the exclusions list.
