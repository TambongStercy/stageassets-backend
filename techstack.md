Perfect! Given your experience and constraints, here's an optimized stack that plays to your strengths:

## Your Ideal Tech Stack

**Frontend**
- **React (Vite)** - Skip Next.js since you're doing separate frontend/backend anyway. Vite is blazingly fast for development.
- **React Router** - Client-side routing
- **Tailwind CSS + shadcn/ui** - Rapid, professional UI development
- **React Query (TanStack Query)** - Essential for handling server state, caching, and file uploads
- **React Hook Form + Zod** - Form handling with TypeScript validation

**Backend**
- **NestJS** - Excellent choice! Structured, TypeScript-native, perfect for your use case
- **Drizzle ORM** - This is your Prisma alternative. Fast, type-safe, feels like writing SQL but with TypeScript inference. Way faster than Prisma, minimal overhead.
- **PostgreSQL** - Solid choice for relational data

**Authentication**
- **Passport.js** (built into NestJS) + **JWT** - Full control, easy to add Google OAuth, GitHub, etc.
- NestJS has excellent `@nestjs/passport` integration
- Libraries: `passport-google-oauth20`, `passport-jwt`

**File Storage Strategy** (Critical Decision)
Given your 50-100GB VPS limitation:

**Hybrid Approach (Recommended):**
- **Local VPS storage** for MVP/testing (first 1-3 months)
- **Google Cloud Storage (GCS)** for production files
  - You already have an account
  - Pay-as-you-grow (~$0.02/GB/month)
  - Seamless migration path when you hit VPS limits
  - Use `@google-cloud/storage` npm package

**File Upload Handling:**
- **Multer** (NestJS native support) - handles multipart/form-data
- **Sharp** - image processing for headshot validation (dimensions, compression)

**Email**
- **SendGrid** - You're already familiar, perfect

**Background Jobs**
- **Bull** + **Redis** - Battle-tested queue system for NestJS
  - Automated reminder emails
  - File processing tasks
  - Deadline notifications
- Redis also handles session storage if needed

**Validation & Security**
- **class-validator** + **class-transformer** (NestJS standard) - DTO validation
- **helmet** - Security headers
- **@nestjs/throttler** - Rate limiting (crucial for public speaker portal)

**Development & Deployment**
- **PM2** - Process management on VPS (what you're probably already using)
- **Nginx** - Reverse proxy, SSL with Let's Encrypt
- **GitHub Actions** (when you try CI/CD) - Free for public repos, easy to set up

## Project Structure

```
stageasset/
├── backend/           # NestJS app
│   ├── src/
│   │   ├── auth/      # Passport strategies, JWT guards
│   │   ├── events/    # Event management module
│   │   ├── speakers/  # Speaker submissions module
│   │   ├── assets/    # File upload/storage module
│   │   ├── emails/    # SendGrid integration
│   │   ├── jobs/      # Bull queues for reminders
│   │   └── db/        # Drizzle schema & migrations
│   └── uploads/       # Temporary local storage (if needed)
├── frontend/          # React + Vite
│   ├── src/
│   │   ├── pages/     # Dashboard, Speaker Portal
│   │   ├── components/
│   │   ├── api/       # React Query hooks
│   │   └── lib/       # Utils, axios config
└── docker-compose.yml # PostgreSQL + Redis for local dev
```

## Why Drizzle Over Prisma?

```typescript
// Drizzle is literally just TypeScript
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  deadline: timestamp('deadline').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Type-safe queries that feel like SQL
const result = await db
  .select()
  .from(events)
  .where(eq(events.id, eventId));
```

- **Performance**: 2-3x faster than Prisma (no query engine overhead)
- **Bundle size**: Tiny compared to Prisma
- **Learning curve**: If you know SQL, you know Drizzle
- **Migrations**: Simple SQL migrations, full control

## Google OAuth Setup (NestJS)

```typescript
// auth/google.strategy.ts
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['email', 'profile'],
    });
  }

  async validate(accessToken, refreshToken, profile) {
    // Your user creation/lookup logic
    return user;
  }
}
```

## File Storage Decision Matrix

**Start with VPS (Months 1-3):**
- Store in `/var/www/stageasset/uploads`
- Symlink to Nginx for serving
- Monitor disk usage

**Migrate to GCS when:**
- You hit 40GB (80% of 50GB VPS)
- You get 20+ paying customers
- You need CDN-level performance

**GCS Integration (NestJS):**
```typescript
// assets/gcs.service.ts
import { Storage } from '@google-cloud/storage';

@Injectable()
export class GcsService {
  private storage: Storage;
  private bucket: string;

  constructor() {
    this.storage = new Storage({
      keyFilename: process.env.GCS_KEY_FILE,
    });
    this.bucket = process.env.GCS_BUCKET_NAME;
  }

  async uploadFile(file: Express.Multer.File, destination: string) {
    const blob = this.storage.bucket(this.bucket).file(destination);
    // Upload logic
  }
}
```

## VPS Specifications Recommendation

For MVP with 10-20 events/month:
- **4GB RAM** minimum (Node + PostgreSQL + Redis)
- **2 CPU cores**
- **100GB SSD** (to give yourself breathing room)
- **Provider**: DigitalOcean, Hetzner, or Linode (~$20-30/month)

## Cost Breakdown (First 6 Months)

- VPS: $25/month
- Domain: $12/year
- SendGrid: Free tier (100 emails/day)
- GCS (when needed): ~$5-10/month
- **Total: ~$25-35/month** vs. $100+ with Vercel/Supabase/etc.

This stack gives you complete control, leverages your existing skills, and keeps costs minimal while you validate the product. Once you're profitable, you can always migrate to managed services if needed.