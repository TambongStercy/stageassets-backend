# StageAsset Backend

> **Stop Chasing Speakers. Start Running Events.**

## Overview

StageAsset is a professional event asset collection platform that eliminates the chaos of collecting speaker bios, presentations, headshots, and other materials for events. This repository contains the backend API built with NestJS.

**The Problem We Solve:** Event managers waste 5-10 hours per event digging through email threads, chasing speakers for materials, and organizing mislabeled files. Speakers get frustrated with fragmented, unprofessional processes.

**Our Solution:** A single, branded portal where speakers can easily submit their assets, with automated reminders and a unified dashboard for event managers.

## Tech Stack

- **Framework:** NestJS (Node.js)
- **Language:** TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Authentication:** JWT + Google OAuth 2.0
- **File Storage:** Local storage (uploads directory) with future GCS support
- **Job Queue:** Bull (Redis-based)
- **Email:** Nodemailer (Gmail for dev) / SendGrid (production)
- **Security:** Helmet, CORS, Rate Limiting (Throttler)
- **Validation:** class-validator + class-transformer

## Features

### Core Functionality
- **Event Management:** Create, update, archive, and delete events with custom branding
- **Speaker Invitations:** Invite speakers via email with unique access tokens
- **Asset Requirements:** Define custom asset requirements per event (presentations, headshots, bios, etc.)
- **File Uploads:** Secure file upload with validation and versioning
- **Automated Reminders:** Schedule and send email reminders to speakers approaching deadlines
- **Activity Logging:** Track all actions across events, speakers, and submissions

### Authentication & Authorization
- Email/Password authentication with JWT
- Google OAuth 2.0 integration
- Email verification
- Password reset flow
- Role-based access control

### Subscription Management
- Multi-tier subscription plans (Starter, Professional, Agency)
- Plan limits enforcement (events, speakers per event)
- Subscription assignment and history tracking
- Toggleable plan limits for development

### API Features
- RESTful API with global prefix `/api`
- File upload endpoints with multipart/form-data support
- Static file serving for uploaded assets
- Public speaker portal endpoints (no auth required)
- Comprehensive error handling and validation

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- Redis (v6 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stageasset-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Copy `.env.example` to `.env` and configure:

   ```bash
   cp .env.example .env
   ```

   Key variables to configure:
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - Secret key for JWT tokens
   - `REDIS_HOST` and `REDIS_PORT` - Redis connection
   - `EMAIL_USER` and `EMAIL_PASSWORD` - Email credentials
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
   - `FRONTEND_URL` - Frontend application URL for CORS
   - `ENABLE_PLAN_LIMITS` - Set to `false` for development, `true` for production

4. **Set up the database**

   Run migrations:
   ```bash
   npx drizzle-kit push
   ```

5. **Start Redis**

   Ensure Redis is running on the configured port (default: 6379)

### Running the Application

```bash
# Development mode with hot-reload
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

The server will start on `http://localhost:3000` (or the port specified in `.env`).

## Project Structure

```
src/
├── activity-logs/       # Activity logging module
├── asset-requirements/  # Asset requirement management
├── assets/             # File upload handling
├── auth/               # Authentication & authorization
│   ├── dto/           # Data transfer objects
│   ├── guards/        # Auth guards (JWT, Google)
│   └── strategies/    # Passport strategies
├── common/            # Shared decorators, guards, utilities
├── db/                # Database configuration and schema
├── emails/            # Email service (Nodemailer/SendGrid)
├── events/            # Event management
├── jobs/              # Background job processors
├── reminders/         # Automated reminder system
├── speakers/          # Speaker invitation and management
├── submissions/       # Asset submission handling
├── subscription-plans/ # Subscription plan management
├── subscriptions/     # User subscription handling
├── users/             # User profile management
└── main.ts            # Application entry point
```

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Key Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/me` - Get current user
- `GET /api/auth/google` - Initiate Google OAuth
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

#### Events
- `POST /api/events` - Create new event
- `GET /api/events` - Get all events for user
- `GET /api/events/:id` - Get event details
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event
- `PUT /api/events/:id/archive` - Archive event

#### Speakers
- `POST /api/events/:eventId/speakers` - Invite speaker
- `GET /api/events/:eventId/speakers` - Get all speakers for event
- `PUT /api/events/:eventId/speakers/:speakerId` - Update speaker
- `DELETE /api/events/:eventId/speakers/:speakerId` - Remove speaker
- `POST /api/events/:eventId/speakers/:speakerId/resend-invitation` - Resend invitation

#### Public Speaker Portal
- `GET /api/portal/events/:slug` - Get event details (public)
- `GET /api/portal/speakers/:accessToken` - Get speaker details
- `PUT /api/portal/speakers/:accessToken` - Update speaker profile
- `POST /api/portal/speakers/:speakerId/submissions` - Submit assets

#### File Uploads
- `POST /api/assets/upload` - Upload file (authenticated)
- `GET /uploads/*` - Static file serving

### Authentication

Protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

Public speaker portal endpoints use access tokens in the URL path.

## Environment Variables

See `.env.example` for all available configuration options.

### Key Configuration

**Development Mode:**
- Set `ENABLE_PLAN_LIMITS=false` to bypass subscription limits during testing
- Use Gmail with app-specific password for email testing
- Set `NODE_ENV=development` for detailed logging

**Production Mode:**
- Set `ENABLE_PLAN_LIMITS=true` to enforce subscription limits
- Use SendGrid for reliable email delivery
- Configure proper CORS with `FRONTEND_URL`
- Use strong `JWT_SECRET`

## Database Schema

The application uses Drizzle ORM with PostgreSQL. Key tables:

- `users` - User accounts
- `events` - Event information
- `speakers` - Speaker invitations
- `submissions` - Asset submissions
- `asset_requirements` - Event asset requirements
- `subscription_plans` - Available subscription tiers
- `subscriptions` - User subscriptions
- `activity_logs` - Audit trail
- `reminders` - Scheduled reminder queue

## File Storage

Files are stored in the `uploads/` directory with subdirectories:
- `uploads/avatars/` - User profile pictures
- `uploads/event-logos/` - Event branding assets
- `uploads/submissions/` - Speaker-submitted files
- `uploads/temp/` - Temporary uploads

Access uploaded files via: `http://localhost:3000/uploads/<subdirectory>/<filename>`

## Background Jobs

The application uses Bull (Redis-based queue) for:
- Sending automated email reminders
- Processing scheduled tasks
- Async email delivery

## Development

```bash
# Run in watch mode
npm run start:dev

# Run tests
npm run test
npm run test:watch
npm run test:cov

# Run e2e tests
npm run test:e2e

# Lint code
npm run lint

# Format code
npm run format
```

## Deployment

For production deployment:

1. Set all required environment variables
2. Configure a production PostgreSQL database
3. Set up Redis instance
4. Configure SendGrid or SMTP for emails
5. Set up Google OAuth credentials
6. Build the application: `npm run build`
7. Start with: `npm run start:prod`

Consider using:
- **Database:** AWS RDS, Supabase, or Neon
- **File Storage:** AWS S3 or Google Cloud Storage
- **Hosting:** Railway, Render, or AWS
- **Email:** SendGrid or AWS SES

## License

UNLICENSED - Private/Proprietary

## Support

For questions or support, please contact the development team.

---

Built with NestJS
