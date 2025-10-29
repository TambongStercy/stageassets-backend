# StageAsset Backend - Implementation Guide for Frontend

## 🚀 Quick Start

**Base URL**: `http://localhost:3000/api`

**Backend Status**: ✅ Fully implemented and ready for frontend integration

All endpoints are tested and working. The backend is built with NestJS, PostgreSQL (via Drizzle ORM), Redis (for background jobs), and SendGrid (for emails).

---

## 📋 Table of Contents

1. [Authentication System](#authentication-system)
2. [Events Management](#events-management)
3. [Speakers & Invitations](#speakers--invitations)
4. [Asset Submissions](#asset-submissions)
5. [File Upload](#file-upload)
6. [Database Schema](#database-schema)
7. [Error Handling](#error-handling)
8. [Environment Setup](#environment-setup)

---

## 🔐 Authentication System

### Overview
- JWT-based authentication
- 7-day token expiration
- Password hashing with bcrypt
- Protected routes using JWT guards

### Endpoints

#### 1. Register User
```
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123",
  "firstName": "John",      // Optional
  "lastName": "Doe"         // Optional
}
```

**Response (201):**
```json
{
  "user": {
    "id": 1,
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Validation:**
- Email must be valid format
- Password minimum 8 characters
- Email must be unique

---

#### 2. Login User
```
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `401 Unauthorized`: Account is deactivated

---

#### 3. Get Current User Profile
```
GET /api/auth/me
```

**Headers Required:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": 1,
  "email": "john@example.com",
  "firstName": "John",
  "lastName": "Doe"
}
```

**How to Use:**
```typescript
// Store token after login/register
localStorage.setItem('token', response.token);

// Add to axios interceptor
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
```

---

#### 4. Google OAuth Login

The backend supports Google OAuth authentication. Users can sign in with their Google account, and the backend will create a user account automatically if one doesn't exist.

**Flow:**
1. User clicks "Sign in with Google" button
2. Frontend redirects to backend OAuth endpoint
3. User grants permissions on Google consent screen
4. Google redirects back to backend callback
5. Backend creates/updates user and redirects to frontend with JWT token

---

**Step 1: Initiate Google OAuth**

```typescript
// On button click, redirect user to:
window.location.href = 'http://localhost:3000/api/auth/google';
```

This will redirect the user to Google's consent screen where they'll authorize your app.

---

**Step 2: Handle Callback**

After the user authorizes, Google will redirect to:
```
http://localhost:3000/api/auth/google/callback
```

The backend will then redirect to your frontend with the token:
```
http://localhost:5174/auth/google/callback?token=<jwt_token>
```

**Frontend Implementation:**

Create a callback page at `/auth/google/callback` in your React app:

```typescript
// pages/GoogleCallback.tsx or similar
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      // Store the token
      localStorage.setItem('token', token);

      // Set axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Fetch user profile
      axios.get('http://localhost:3000/api/auth/me')
        .then(response => {
          // Store user data in your state management (Redux, Context, etc.)
          console.log('User:', response.data);

          // Redirect to dashboard
          navigate('/dashboard');
        })
        .catch(error => {
          console.error('Failed to get user:', error);
          navigate('/login');
        });
    } else {
      // No token received, redirect to login
      navigate('/login');
    }
  }, [searchParams, navigate]);

  return (
    <div>
      <h2>Signing you in...</h2>
      <p>Please wait while we complete your Google sign-in.</p>
    </div>
  );
}
```

---

**Complete Example: Login Component with Google OAuth**

```typescript
// components/LoginForm.tsx
import { useState } from 'react';
import axios from 'axios';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:3000/api/auth/login', {
        email,
        password,
      });

      // Store token
      localStorage.setItem('token', response.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Login failed:', error);
      alert('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Redirect to backend Google OAuth endpoint
    window.location.href = 'http://localhost:3000/api/auth/google';
  };

  return (
    <div>
      <h2>Sign In</h2>

      {/* Email/Password Login */}
      <form onSubmit={handleEmailLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div>--- OR ---</div>

      {/* Google OAuth Button */}
      <button onClick={handleGoogleLogin}>
        <img src="/google-icon.svg" alt="Google" />
        Sign in with Google
      </button>
    </div>
  );
}
```

---

**Important Notes:**

1. **No Password Required**: Users who sign up via Google OAuth don't have a password in the database. They can only log in using Google OAuth.

2. **Email Verified**: Google OAuth users automatically have `isEmailVerified: true` since Google verifies emails.

3. **Account Linking**: If a user registers with email/password first, then later tries to sign in with Google using the same email, they will be logged into the existing account.

4. **Environment Variables**: The backend uses these environment variables for Google OAuth:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
   - `GOOGLE_CALLBACK_URL`: http://localhost:3000/api/auth/google/callback
   - `FRONTEND_URL`: Where to redirect after authentication (http://localhost:5174)

5. **Production Setup**: In production, update:
   - `GOOGLE_CALLBACK_URL` to your production backend URL
   - `FRONTEND_URL` to your production frontend URL
   - Update authorized redirect URIs in Google Cloud Console

---

## 🎪 Events Management

### Overview
- CRUD operations for events
- Automatic slug generation from event names
- Event archiving
- Real-time statistics

### Endpoints

#### 1. Create Event
```
POST /api/events
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Tech Summit 2025",
  "description": "Annual tech conference",
  "deadline": "2025-03-15T23:59:59Z",
  "eventDate": "2025-03-20T09:00:00Z",
  "brandColor": "#3B82F6",           // Optional, default: #3B82F6
  "logoUrl": "https://...",          // Optional
  "enableAutoReminders": true,       // Optional, default: true
  "reminderDaysBefore": 3,           // Optional, default: 3
  "customInstructions": "Please submit high-res images" // Optional
}
```

**Response (201):**
```json
{
  "id": 1,
  "userId": 1,
  "name": "Tech Summit 2025",
  "slug": "tech-summit-2025",       // Auto-generated
  "description": "Annual tech conference",
  "deadline": "2025-03-15T23:59:59.000Z",
  "eventDate": "2025-03-20T09:00:00.000Z",
  "brandColor": "#3B82F6",
  "logoUrl": "https://...",
  "enableAutoReminders": true,
  "reminderDaysBefore": 3,
  "customInstructions": "Please submit high-res images",
  "isArchived": false,
  "archivedAt": null,
  "createdAt": "2025-01-28T10:00:00.000Z",
  "updatedAt": "2025-01-28T10:00:00.000Z"
}
```

**Slug Generation:**
- Automatically converts name to URL-safe slug
- Handles duplicates by adding `-1`, `-2`, etc.
- Example: "Tech Summit 2025" → "tech-summit-2025"

---

#### 2. Get All User's Events
```
GET /api/events?includeArchived=false
```

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `includeArchived` (optional): `true` or `false`, default: `false`

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Tech Summit 2025",
    "slug": "tech-summit-2025",
    "deadline": "2025-03-15T23:59:59.000Z",
    "eventDate": "2025-03-20T09:00:00.000Z",
    "isArchived": false,
    "createdAt": "2025-01-28T10:00:00.000Z",
    // ... all event fields
  }
]
```

---

#### 3. Get Single Event
```
GET /api/events/:id
```

**Headers:** `Authorization: Bearer <token>`

**Response (200):** Same as create event response

**Error Responses:**
- `404 Not Found`: Event doesn't exist
- `403 Forbidden`: User doesn't own this event

---

#### 4. Get Event Statistics
```
GET /api/events/:id/stats
```

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "totalSpeakers": 10,
  "completedSpeakers": 7,
  "partialSpeakers": 2,
  "pendingSpeakers": 1,
  "completionRate": 70
}
```

**Use Case:** Display progress on event dashboard

---

#### 5. Update Event
```
PUT /api/events/:id
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:** (All fields optional)
```json
{
  "name": "Tech Summit 2025 - Updated",
  "deadline": "2025-03-20T23:59:59Z",
  "brandColor": "#10B981"
}
```

**Response (200):** Updated event object

---

#### 6. Archive Event
```
PUT /api/events/:id/archive
```

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": 1,
  "isArchived": true,
  "archivedAt": "2025-01-28T10:00:00.000Z",
  // ... other fields
}
```

---

#### 7. Delete Event
```
DELETE /api/events/:id
```

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Event deleted successfully"
}
```

**Note:** This will cascade delete all speakers and submissions

---

#### 8. Get Event by Slug (Public)
```
GET /api/portal/events/:slug
```

**No Authentication Required**

**Response (200):** Full event object

**Use Case:** Display event details on speaker portal

---

## 👥 Speakers & Invitations

### Overview
- Invite speakers to events
- Auto-generated 64-character access tokens (no login required for speakers)
- Track submission status (pending/partial/complete)
- Resend invitations

### Endpoints

#### 1. Invite Speaker
```
POST /api/events/:eventId/speakers
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "email": "speaker@example.com",
  "firstName": "Jane",        // Optional
  "lastName": "Smith",        // Optional
  "company": "TechCorp",      // Optional
  "jobTitle": "Senior Engineer" // Optional
}
```

**Response (201):**
```json
{
  "id": 1,
  "eventId": 1,
  "email": "speaker@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "company": "TechCorp",
  "jobTitle": "Senior Engineer",
  "bio": null,
  "accessToken": "a1b2c3d4e5f6...64chars", // Auto-generated
  "submissionStatus": "pending",
  "submittedAt": null,
  "lastReminderSentAt": null,
  "reminderCount": 0,
  "invitedAt": "2025-01-28T10:00:00.000Z",
  "createdAt": "2025-01-28T10:00:00.000Z",
  "updatedAt": "2025-01-28T10:00:00.000Z"
}
```

**Access Token:**
- 64 characters long
- Unique per speaker
- Used to access speaker portal without login
- Portal URL: `https://yourapp.com/portal/speakers/{accessToken}`

**Email is automatically sent** (if SendGrid is configured)

---

#### 2. Get All Speakers for Event
```
GET /api/events/:eventId/speakers
```

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
[
  {
    "id": 1,
    "email": "speaker@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "submissionStatus": "complete",
    "submittedAt": "2025-01-27T14:30:00.000Z",
    "reminderCount": 1,
    // ... all speaker fields
  }
]
```

---

#### 3. Get Single Speaker
```
GET /api/events/:eventId/speakers/:speakerId
```

**Headers:** `Authorization: Bearer <token>`

**Response (200):** Full speaker object

---

#### 4. Update Speaker (Event Manager)
```
PUT /api/events/:eventId/speakers/:speakerId
```

**Headers:** `Authorization: Bearer <token>`

**Request Body:** (All optional)
```json
{
  "firstName": "Jane Updated",
  "company": "NewCorp"
}
```

**Response (200):** Updated speaker object

---

#### 5. Delete Speaker
```
DELETE /api/events/:eventId/speakers/:speakerId
```

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Speaker deleted successfully"
}
```

---

#### 6. Resend Invitation
```
POST /api/events/:eventId/speakers/:speakerId/resend-invitation
```

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "message": "Invitation resent successfully",
  "speaker": { /* speaker object */ }
}
```

**Note:** This triggers a new invitation email

---

### Speaker Portal Endpoints (Public - No Auth)

#### 7. Get Speaker by Access Token
```
GET /api/portal/speakers/:accessToken
```

**No Authentication Required**

**Response (200):**
```json
{
  "id": 1,
  "eventId": 1,
  "email": "speaker@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "company": "TechCorp",
  "jobTitle": "Senior Engineer",
  "bio": "Experienced software engineer...",
  "submissionStatus": "pending",
  // ... other fields
}
```

**Use Case:** Speaker accesses portal with URL containing their token

---

#### 8. Update Speaker Profile (Public)
```
PUT /api/portal/speakers/:accessToken
```

**No Authentication Required**

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "company": "TechCorp Updated",
  "jobTitle": "Staff Engineer",
  "bio": "Jane is a passionate engineer with 10 years experience..."
}
```

**Response (200):** Updated speaker object

**Use Case:** Speaker updates their own info from portal

---

## 📤 Asset Submissions

### Overview
- Track file submissions per speaker
- Version control (re-uploads create new versions)
- Query submissions by speaker or event

### Endpoints

#### 1. Create Submission
```
POST /api/portal/speakers/:speakerId/submissions
```

**No Authentication Required** (uses speaker ID from URL)

**Request Body:**
```json
{
  "assetRequirementId": 1,
  "fileName": "headshot.jpg",
  "fileUrl": "/uploads/submissions/1738065432-abc123.jpg",
  "fileSize": 245632,
  "mimeType": "image/jpeg",
  "storagePath": "./uploads/submissions/1738065432-abc123.jpg",
  "imageWidth": 1200,    // Optional, for images
  "imageHeight": 1600    // Optional, for images
}
```

**Response (201):**
```json
{
  "id": 1,
  "speakerId": 1,
  "assetRequirementId": 1,
  "fileName": "headshot.jpg",
  "fileUrl": "/uploads/submissions/1738065432-abc123.jpg",
  "fileSize": 245632,
  "mimeType": "image/jpeg",
  "storageProvider": "local",
  "storagePath": "./uploads/submissions/1738065432-abc123.jpg",
  "imageWidth": 1200,
  "imageHeight": 1600,
  "version": 1,
  "replacesSubmissionId": null,
  "isLatest": true,
  "uploadedAt": "2025-01-28T10:00:00.000Z",
  "createdAt": "2025-01-28T10:00:00.000Z"
}
```

**Version Control:**
- If speaker re-uploads same asset type, new submission is created
- Previous submission's `isLatest` is set to `false`
- `version` increments automatically (1, 2, 3...)

---

#### 2. Get Speaker's Submissions
```
GET /api/portal/speakers/:speakerId/submissions
```

**No Authentication Required**

**Response (200):**
```json
[
  {
    "id": 1,
    "assetRequirementId": 1,
    "fileName": "headshot.jpg",
    "fileUrl": "/uploads/submissions/1738065432-abc123.jpg",
    "version": 1,
    "isLatest": true,
    "uploadedAt": "2025-01-28T10:00:00.000Z",
    // ... other fields
  }
]
```

**Note:** Only returns latest versions by default

---

#### 3. Delete Submission
```
DELETE /api/portal/speakers/:speakerId/submissions/:id
```

**No Authentication Required**

**Response (200):**
```json
{
  "message": "Submission deleted successfully"
}
```

---

## 📁 File Upload

### Overview
- File upload using Multer (multipart/form-data)
- Image validation with Sharp (dimensions, format)
- File size limits (configurable)
- Local storage (ready for cloud migration)

### Endpoint

#### Upload File
```
POST /api/assets/upload
```

**No Authentication Required** (can be called from speaker portal)

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: The file to upload (required)

**Example using JavaScript/Fetch:**
```javascript
const formData = new FormData();
formData.append('file', fileObject);

const response = await fetch('http://localhost:3000/api/assets/upload', {
  method: 'POST',
  body: formData
});

const data = await response.json();
```

**Example using Axios:**
```javascript
const formData = new FormData();
formData.append('file', fileObject);

const response = await axios.post('/api/assets/upload', formData, {
  headers: {
    'Content-Type': 'multipart/form-data'
  }
});
```

**Response (201):**
```json
{
  "fileName": "headshot.jpg",
  "fileUrl": "/uploads/submissions/1738065432-abc123.jpg",
  "filePath": "./uploads/submissions/1738065432-abc123.jpg",
  "fileSize": 245632,
  "mimeType": "image/jpeg",
  "width": 1200,    // Only for images
  "height": 1600    // Only for images
}
```

**Validation:**
- Max file size: 10MB (configurable via `MAX_FILE_SIZE` env)
- Supported image formats: JPG, PNG, GIF, WEBP
- If image: automatically validates format and extracts dimensions

**Error Responses:**
- `400 Bad Request`: "No file uploaded"
- `400 Bad Request`: "Invalid image file"
- `400 Bad Request`: "Image width must be at least Xpx"

**File Storage:**
- Files stored in `./uploads/submissions/` by default
- Filename format: `{timestamp}-{random}.{ext}`
- Can be migrated to Google Cloud Storage later

---

## 🗄️ Database Schema

### Users Table
```typescript
{
  id: number (PK)
  email: string (unique)
  password: string (hashed)
  firstName: string | null
  lastName: string | null
  googleId: string | null (for OAuth)
  currentPlanId: number | null (FK)
  currentSubscriptionId: number | null (FK)
  stripeCustomerId: string | null
  isActive: boolean
  isEmailVerified: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

### Events Table
```typescript
{
  id: number (PK)
  userId: number (FK)
  name: string
  slug: string (unique, indexed)
  description: string | null
  deadline: Date
  eventDate: Date | null
  brandColor: string (default: "#3B82F6")
  logoUrl: string | null
  enableAutoReminders: boolean (default: true)
  reminderDaysBefore: number (default: 3)
  customInstructions: string | null
  isArchived: boolean (default: false)
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

### Speakers Table
```typescript
{
  id: number (PK)
  eventId: number (FK)
  email: string
  firstName: string | null
  lastName: string | null
  company: string | null
  jobTitle: string | null
  bio: string | null
  accessToken: string (64 chars, unique, indexed)
  submissionStatus: 'pending' | 'partial' | 'complete'
  submittedAt: Date | null
  lastReminderSentAt: Date | null
  reminderCount: number (default: 0)
  invitedAt: Date
  createdAt: Date
  updatedAt: Date
}
```

### Submissions Table
```typescript
{
  id: number (PK)
  speakerId: number (FK)
  assetRequirementId: number (FK)
  fileName: string
  fileUrl: string
  fileSize: number (bytes)
  mimeType: string
  storageProvider: 'local' | 'gcs'
  storagePath: string
  imageWidth: number | null
  imageHeight: number | null
  version: number
  replacesSubmissionId: number | null (FK to self)
  isLatest: boolean (default: true)
  uploadedAt: Date
  createdAt: Date
}
```

---

## ⚠️ Error Handling

### Standard Error Response Format
```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

### Common HTTP Status Codes

**200 OK** - Successful GET/PUT requests
**201 Created** - Successful POST requests (resource created)
**400 Bad Request** - Validation errors, invalid input
**401 Unauthorized** - Missing or invalid token
**403 Forbidden** - User doesn't have access to resource
**404 Not Found** - Resource doesn't exist
**409 Conflict** - Duplicate resource (email already exists, etc.)
**500 Internal Server Error** - Server error

### Validation Errors
```json
{
  "statusCode": 400,
  "message": [
    "email must be a valid email",
    "password must be at least 8 characters"
  ],
  "error": "Bad Request"
}
```

### Frontend Error Handling Example
```typescript
try {
  const response = await axios.post('/api/auth/login', credentials);
  // Handle success
} catch (error) {
  if (error.response?.status === 401) {
    // Show "Invalid credentials" message
  } else if (error.response?.status === 400) {
    // Show validation errors
    const errors = error.response.data.message;
  } else {
    // Show generic error
  }
}
```

---

## 🔧 Environment Setup

### Required Environment Variables

Create `.env` file in backend root:

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/stageasset_dev"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# SendGrid (for email sending)
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=noreply@stageasset.com

# Redis (for background jobs)
REDIS_HOST=localhost
REDIS_PORT=6379

# App
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# Google Cloud Storage (optional, for later)
GCS_BUCKET_NAME=stageasset-files
GCS_PROJECT_ID=your-project-id
GCS_KEY_FILE=./gcs-key.json
```

### Starting the Backend

```bash
# Install dependencies
npm install

# Run migrations (already done)
# Tables are already created

# Start development server
npm run start:dev

# Server runs on http://localhost:3000
# API endpoints: http://localhost:3000/api/*
```

---

## 📧 Email System

### Overview
- SendGrid integration for transactional emails
- Three email types: Invitation, Reminder, Confirmation
- HTML email templates
- Automatic sending on speaker invitation

### Email Templates

**1. Speaker Invitation**
- Triggered: When speaker is invited (`POST /api/events/:eventId/speakers`)
- Contains: Event name, deadline, portal access link
- Portal URL format: `{FRONTEND_URL}/portal/speakers/{accessToken}`

**2. Reminder Email**
- Triggered: Background job (Bull queue)
- Sent to: Speakers with `submissionStatus !== 'complete'`
- Frequency: Based on `reminderDaysBefore` setting

**3. Submission Confirmation**
- Triggered: When speaker completes all submissions
- Contains: Thank you message, event name

### Email Configuration
```typescript
// Already implemented in EmailsService
sendSpeakerInvitation(email, name, eventName, deadline, portalUrl)
sendReminder(email, name, eventName, deadline, portalUrl)
sendSubmissionConfirmation(email, name, eventName)
```

---

## 🎯 Integration Workflow Examples

### Example 1: Complete Event Creation Flow

```typescript
// 1. User registers
const { token } = await axios.post('/api/auth/register', {
  email: 'manager@example.com',
  password: 'SecurePass123',
  firstName: 'John'
});

// 2. Store token
localStorage.setItem('token', token);
axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

// 3. Create event
const event = await axios.post('/api/events', {
  name: 'Tech Summit 2025',
  deadline: '2025-03-15T23:59:59Z',
  eventDate: '2025-03-20T09:00:00Z'
});

// 4. Invite speakers
const speaker1 = await axios.post(`/api/events/${event.id}/speakers`, {
  email: 'speaker1@example.com',
  firstName: 'Jane'
});

const speaker2 = await axios.post(`/api/events/${event.id}/speakers`, {
  email: 'speaker2@example.com',
  firstName: 'Bob'
});

// 5. Share portal links with speakers
const portalUrl1 = `https://yourapp.com/portal/speakers/${speaker1.accessToken}`;
const portalUrl2 = `https://yourapp.com/portal/speakers/${speaker2.accessToken}`;
```

---

### Example 2: Speaker Submission Flow

```typescript
// Speaker visits: https://yourapp.com/portal/speakers/{accessToken}

// 1. Get speaker info
const speaker = await axios.get(`/api/portal/speakers/${accessToken}`);

// 2. Get event info
const event = await axios.get(`/api/portal/events/${eventSlug}`);

// 3. Upload file
const formData = new FormData();
formData.append('file', fileObject);

const uploadResponse = await axios.post('/api/assets/upload', formData);

// 4. Create submission
const submission = await axios.post(
  `/api/portal/speakers/${speaker.id}/submissions`,
  {
    assetRequirementId: 1,
    fileName: uploadResponse.fileName,
    fileUrl: uploadResponse.fileUrl,
    fileSize: uploadResponse.fileSize,
    mimeType: uploadResponse.mimeType,
    storagePath: uploadResponse.filePath,
    imageWidth: uploadResponse.width,
    imageHeight: uploadResponse.height
  }
);

// 5. Update speaker profile (optional)
await axios.put(`/api/portal/speakers/${accessToken}`, {
  bio: 'Updated bio...',
  company: 'NewCorp'
});
```

---

### Example 3: Event Manager Dashboard

```typescript
// 1. Get all events
const events = await axios.get('/api/events');

// 2. Get specific event stats
const stats = await axios.get(`/api/events/${eventId}/stats`);
// Returns: { totalSpeakers: 10, completedSpeakers: 7, completionRate: 70 }

// 3. Get all speakers for event
const speakers = await axios.get(`/api/events/${eventId}/speakers`);

// 4. Resend invitation to pending speaker
await axios.post(`/api/events/${eventId}/speakers/${speakerId}/resend-invitation`);

// 5. Archive completed event
await axios.put(`/api/events/${eventId}/archive`);
```

---

## 🔄 Background Jobs (Automated Reminders)

### How It Works
- Bull queue system with Redis
- Job: `send-reminder`
- Processor: Checks for pending speakers near deadline
- Sends reminder emails automatically

### Job Data
```typescript
{
  speakerId: number,
  eventId: number
}
```

### Manual Trigger (for testing)
```typescript
// Add job to queue programmatically
await reminderQueue.add('send-reminder', {
  speakerId: 1,
  eventId: 1
});
```

---

## 🧪 Testing Recommendations

### API Testing with Postman/Insomnia

1. **Create a collection** with these requests:
   - Register → saves token to environment
   - Login → saves token to environment
   - Create Event → saves eventId
   - Invite Speaker → saves accessToken
   - Upload File → saves file info
   - Create Submission

2. **Set environment variables** to chain requests

### React Query Setup

```typescript
// API client setup
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
});

// Add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

---

## 📦 Next Steps for Frontend

### Immediate Tasks

1. **Setup axios client** with base URL and auth interceptor
2. **Create auth context** to manage user state and token
3. **Build protected routes** using JWT token
4. **Implement pages**:
   - Login/Register
   - Dashboard (list events)
   - Event Details (speakers list, stats)
   - Speaker Portal (public, uses access token)

### Suggested Page Structure

```
/login
/register
/dashboard                     → List all events
/events/new                    → Create event form
/events/:id                    → Event details + speakers list
/events/:id/speakers/invite    → Invite speaker form
/portal/:slug/speakers/:token  → Public speaker portal
```

---

## 🆘 Need Help?

### Common Issues

**CORS errors**: Make sure backend CORS is configured for your frontend URL (already set to `http://localhost:5173`)

**401 errors**: Check that token is being sent in Authorization header

**File upload fails**: Verify Content-Type is `multipart/form-data`

**Database connection**: Ensure PostgreSQL is running and DATABASE_URL is correct

---

## ✅ Backend Checklist

- [x] Authentication (register, login, JWT)
- [x] Events CRUD
- [x] Speakers management
- [x] File upload
- [x] Submissions tracking
- [x] Email sending
- [x] Background jobs
- [x] Database migrations
- [x] Error handling
- [x] CORS configuration
- [x] Validation pipes

**Status: Production-ready for frontend integration** 🚀
