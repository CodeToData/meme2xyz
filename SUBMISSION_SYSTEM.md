# Meme2XYZ - Database & Submission System

## Overview

The meme submission system allows users to upload images with text descriptions through a drag-and-drop interface. All submissions are stored in a SQLite database and require admin approval before appearing on the site.

## Database Schema

### Submissions Table
```sql
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,           -- Generated filename in uploads/
  original_name TEXT NOT NULL,      -- Original filename from user
  user_text TEXT NOT NULL,          -- User's text/caption
  timestamp TEXT NOT NULL,          -- ISO timestamp from submission
  approved INTEGER DEFAULT 0,       -- 0=pending, 1=approved, -1=rejected
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### Public Endpoints

#### POST /api/submissions
Submit a new meme for review.
- **Body**: FormData with `image` (file) and `text` (string)
- **Returns**: `{ success: true, id: number, message: string }`

#### GET /api/approved-memes
Get all approved memes for public display.
- **Returns**: Array of `{ original_name, user_text, timestamp }`

### Admin Endpoints

#### GET /api/admin/submissions
Get all submissions for admin review.
- **Returns**: Array of all submission records

#### PATCH /api/admin/submissions/:id
Approve or reject a submission.
- **Body**: `{ approved: 0 | 1 | -1 }`
- **Returns**: `{ success: true, message: string }`

## File Storage

- **Uploads**: Temporary storage in `/uploads/` directory
- **Approved**: Copies to `/public/images/` when approved
- **Naming**: `meme-{timestamp}-{random}.{ext}` format

## Admin Panel

Access the admin panel at `/admin` to:
- View all submissions with previews
- See statistics (total, pending, approved, rejected)
- Approve or reject submissions with one click
- Auto-refresh every 30 seconds

## Development

### Run Full Stack
```bash
npm run dev:full    # Runs both frontend (port 5173) and backend (port 3001)
```

### Run Separately
```bash
npm run dev         # Frontend only (port 5173)
npm run server      # Backend only (port 3001)
```

### Production
```bash
npm run build       # Build frontend
npm run start       # Build and run production server
```

## Features

### Frontend Submission Form
- ✅ Drag & drop image upload
- ✅ Browse button for file selection
- ✅ Image preview with remove option
- ✅ Text input with character counter (500 max)
- ✅ Mortal Kombat themed submission button
- ✅ Real-time validation and error handling
- ✅ Success/error messages

### Backend System
- ✅ SQLite database with submissions table
- ✅ Multer file upload handling (10MB limit)
- ✅ Image file type validation
- ✅ Unique filename generation
- ✅ Admin approval workflow
- ✅ Automatic file copying on approval

### Admin Interface
- ✅ Responsive design with statistics dashboard
- ✅ Submission cards with image previews
- ✅ One-click approve/reject buttons
- ✅ Status badges and visual indicators
- ✅ Auto-refresh functionality

## Security Considerations

- File type validation (images only)
- File size limits (10MB max)
- Unique filename generation (prevents conflicts)
- Admin approval required before public display
- Error handling for malformed requests

## Database Access

The SQLite database (`memes.db`) contains all submission data. You can query it directly:

```bash
sqlite3 memes.db
.tables
SELECT * FROM submissions WHERE approved = 1;  -- View approved memes
SELECT * FROM submissions WHERE approved = 0;  -- View pending submissions
```
