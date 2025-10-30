import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  varchar,
  pgEnum,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, eq, sql } from 'drizzle-orm';

// ========================
// ENUMS
// ========================

export const userRoleEnum = pgEnum('user_role', ['free', 'starter', 'professional', 'agency']);

export const submissionStatusEnum = pgEnum('submission_status', ['pending', 'partial', 'complete']);

export const assetTypeEnum = pgEnum('asset_type', [
  'headshot',
  'bio',
  'presentation',
  'logo',
  'other',
]);

export const reminderStatusEnum = pgEnum('reminder_status', ['pending', 'sent', 'failed']);

// ========================
// SUBSCRIPTION PLANS TABLE
// ========================
// Defines available plans (seed this with your pricing tiers)

export const subscriptionPlans = pgTable('subscription_plans', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(), // 'free', 'starter', 'professional', 'agency'
  displayName: varchar('display_name', { length: 100 }).notNull(), // 'Professional Plan'
  description: text('description'),
  
  // Pricing
  priceMonthly: integer('price_monthly').notNull(), // Store in cents: $99 = 9900
  priceYearly: integer('price_yearly'), // Optional annual discount
  
  // Plan limits
  maxActiveEvents: integer('max_active_events').notNull(),
  maxSpeakersPerEvent: integer('max_speakers_per_event').notNull(),
  features: text('features'), // JSON array: ["branded_portal", "auto_reminders", "priority_support"]
  
  // Status
  isActive: boolean('is_active').default(true).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ========================
// SUBSCRIPTION HISTORY TABLE
// ========================
// Complete audit trail of all subscription changes

export const subscriptionHistory = pgTable('subscription_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  planId: integer('plan_id')
    .references(() => subscriptionPlans.id)
    .notNull(),
  
  // Subscription period
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'), // Null = currently active
  
  // Billing details
  amountPaid: integer('amount_paid').notNull(), // In cents
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  billingCycle: varchar('billing_cycle', { length: 20 }).notNull(), // 'monthly', 'yearly', 'lifetime'
  
  // Payment provider info
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }),
  paymentMethod: varchar('payment_method', { length: 50 }), // 'card', 'paypal', 'manual'
  
  // Status tracking
  status: varchar('status', { length: 20 }).notNull(), // 'active', 'cancelled', 'expired', 'failed'
  cancelledAt: timestamp('cancelled_at'),
  cancellationReason: text('cancellation_reason'),
  
  // Auto-renewal
  willAutoRenew: boolean('will_auto_renew').default(true).notNull(),
  nextBillingDate: timestamp('next_billing_date'),
  
  // Metadata
  notes: text('notes'), // Admin notes or special circumstances
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ========================
// PAYMENT TRANSACTIONS TABLE (Optional but Recommended)
// ========================
// Every individual payment attempt (for refunds, failed charges, etc.)

export const paymentTransactions = pgTable('payment_transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  subscriptionHistoryId: integer('subscription_history_id')
    .references(() => subscriptionHistory.id, { onDelete: 'set null' }),
  
  // Transaction details
  amount: integer('amount').notNull(), // In cents
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  status: varchar('status', { length: 20 }).notNull(), // 'pending', 'succeeded', 'failed', 'refunded'
  
  // Payment provider
  stripePaymentIntentId: varchar('stripe_payment_intent_id', { length: 255 }),
  stripeChargeId: varchar('stripe_charge_id', { length: 255 }),
  paymentMethod: varchar('payment_method', { length: 50 }),
  
  // Failure tracking
  failureCode: varchar('failure_code', { length: 50 }),
  failureMessage: text('failure_message'),
  
  // Refund tracking
  refundedAt: timestamp('refunded_at'),
  refundAmount: integer('refund_amount'), // In cents
  refundReason: text('refund_reason'),
  
  // Metadata
  description: text('description'),
  metadata: text('metadata'), // JSON for additional Stripe data
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ========================
// UPDATE USERS TABLE
// ========================
// Remove subscription fields, reference current subscription instead

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password'),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  avatarUrl: text('avatar_url'),

  // OAuth
  googleId: varchar('google_id', { length: 255 }).unique(),
  
  // Current subscription (denormalized for quick access)
  currentPlanId: integer('current_plan_id')
    .references(() => subscriptionPlans.id),
  currentSubscriptionId: integer('current_subscription_id')
    .references(() => subscriptionHistory.id), // Points to active subscription record
  
  // Billing
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  
  // Account status
  isActive: boolean('is_active').default(true).notNull(),
  isEmailVerified: boolean('is_email_verified').default(false).notNull(),
  emailVerificationToken: varchar('email_verification_token', { length: 255 }),
  emailVerificationExpires: timestamp('email_verification_expires'),

  // Email change flow
  pendingEmail: varchar('pending_email', { length: 255 }),
  emailChangeToken: varchar('email_change_token', { length: 255 }),
  emailChangeExpires: timestamp('email_change_expires'),

  // Password reset
  passwordResetToken: varchar('password_reset_token', { length: 255 }),
  passwordResetExpires: timestamp('password_reset_expires'),
  
  // Timestamps
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ========================
// EVENTS TABLE
// ========================

export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Event details
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(), // For public URLs: /portal/tech-conf-2025
  description: text('description'),
  deadline: timestamp('deadline').notNull(),
  eventDate: timestamp('event_date'),
  
  // Branding
  brandColor: varchar('brand_color', { length: 7 }).default('#3B82F6'),
  logoUrl: text('logo_url'),
  
  // Settings
  enableAutoReminders: boolean('enable_auto_reminders').default(true).notNull(),
  reminderDaysBefore: integer('reminder_days_before').default(3).notNull(), // Send reminder 3 days before deadline
  customInstructions: text('custom_instructions'), // Custom message for speakers
  
  // Status
  isArchived: boolean('is_archived').default(false).notNull(),
  archivedAt: timestamp('archived_at'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('event_slug_idx').on(table.slug),
}));

// ========================
// ASSET REQUIREMENTS TABLE
// ========================
// Defines what assets are required for each event

export const assetRequirements = pgTable('asset_requirements', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id')
    .references(() => events.id, { onDelete: 'cascade' })
    .notNull(),
  
  assetType: assetTypeEnum('asset_type').notNull(),
  label: varchar('label', { length: 100 }).notNull(), // e.g., "Speaker Headshot"
  description: text('description'), // Instructions for this asset
  isRequired: boolean('is_required').default(true).notNull(),
  
  // File validation rules
  acceptedFileTypes: text('accepted_file_types'), // JSON array: [".jpg", ".png"]
  maxFileSizeMb: integer('max_file_size_mb').default(10),
  minImageWidth: integer('min_image_width'), // For headshots
  minImageHeight: integer('min_image_height'),
  
  // Display order
  sortOrder: integer('sort_order').default(0).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ========================
// SPEAKERS TABLE
// ========================

export const speakers = pgTable('speakers', {
  id: serial('id').primaryKey(),
  eventId: integer('event_id')
    .references(() => events.id, { onDelete: 'cascade' })
    .notNull(),
  
  // Speaker info
  email: varchar('email', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  company: varchar('company', { length: 255 }),
  jobTitle: varchar('job_title', { length: 255 }),
  bio: text('bio'),
  
  // Unique access token for portal (no login required)
  accessToken: varchar('access_token', { length: 64 }).notNull().unique(),
  
  // Submission tracking
  submissionStatus: submissionStatusEnum('submission_status').default('pending').notNull(),
  submittedAt: timestamp('submitted_at'),
  lastReminderSentAt: timestamp('last_reminder_sent_at'),
  reminderCount: integer('reminder_count').default(0).notNull(),
  
  // Timestamps
  invitedAt: timestamp('invited_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  accessTokenIdx: uniqueIndex('speaker_access_token_idx').on(table.accessToken),
  emailEventIdx: uniqueIndex('speaker_email_event_idx').on(table.email, table.eventId),
}));

// ========================
// SUBMISSIONS TABLE
// ========================
// Tracks individual asset submissions per speaker

export const submissions = pgTable('submissions', {
  id: serial('id').primaryKey(),
  speakerId: integer('speaker_id')
    .references(() => speakers.id, { onDelete: 'cascade' })
    .notNull(),
  assetRequirementId: integer('asset_requirement_id')
    .references(() => assetRequirements.id, { onDelete: 'cascade' })
    .notNull(),
  
  // File details
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileUrl: text('file_url').notNull(),
  fileSize: integer('file_size').notNull(), // in bytes
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  
  // Storage location (local vs cloud)
  storageProvider: varchar('storage_provider', { length: 50 }).default('local').notNull(), // 'local' or 'gcs'
  storagePath: text('storage_path').notNull(),
  
  // Image metadata (if applicable)
  imageWidth: integer('image_width'),
  imageHeight: integer('image_height'),
  
  // Versioning
  version: integer('version').default(1).notNull(),
  replacesSubmissionId: integer('replaces_submission_id'), // Reference to previous version
  isLatest: boolean('is_latest').default(true).notNull(),
  
  // Timestamps
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  speakerAssetIdx: uniqueIndex('submission_speaker_asset_idx')
    .on(table.speakerId, table.assetRequirementId)
    .where(sql`${table.isLatest} = true`),
}));

// ========================
// REMINDERS TABLE
// ========================
// Tracks automated reminder emails

export const reminders = pgTable('reminders', {
  id: serial('id').primaryKey(),
  speakerId: integer('speaker_id')
    .references(() => speakers.id, { onDelete: 'cascade' })
    .notNull(),
  eventId: integer('event_id')
    .references(() => events.id, { onDelete: 'cascade' })
    .notNull(),
  
  status: reminderStatusEnum('status').default('pending').notNull(),
  
  // Scheduled vs sent
  scheduledFor: timestamp('scheduled_for').notNull(),
  sentAt: timestamp('sent_at'),
  
  // Email details
  emailSubject: varchar('email_subject', { length: 255 }),
  emailBody: text('email_body'),
  errorMessage: text('error_message'), // If failed
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ========================
// ACTIVITY LOG TABLE (Optional but Recommended)
// ========================
// Audit trail for important actions

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  eventId: integer('event_id').references(() => events.id, { onDelete: 'cascade' }),
  speakerId: integer('speaker_id').references(() => speakers.id, { onDelete: 'cascade' }),
  
  action: varchar('action', { length: 100 }).notNull(), // 'event_created', 'speaker_invited', 'submission_uploaded'
  description: text('description'),
  metadata: text('metadata'), // JSON for additional context
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ========================
// RELATIONS
// ========================


export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  subscriptionHistory: many(subscriptionHistory),
  users: many(users),
}));

export const subscriptionHistoryRelations = relations(subscriptionHistory, ({ one, many }) => ({
  user: one(users, {
    fields: [subscriptionHistory.userId],
    references: [users.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [subscriptionHistory.planId],
    references: [subscriptionPlans.id],
  }),
  transactions: many(paymentTransactions),
}));

export const paymentTransactionsRelations = relations(paymentTransactions, ({ one }) => ({
  user: one(users, {
    fields: [paymentTransactions.userId],
    references: [users.id],
  }),
  subscription: one(subscriptionHistory, {
    fields: [paymentTransactions.subscriptionHistoryId],
    references: [subscriptionHistory.id],
  }),
}));

// Update usersRelations to include new relationships
export const usersRelations = relations(users, ({ one, many }) => ({
  currentPlan: one(subscriptionPlans, {
    fields: [users.currentPlanId],
    references: [subscriptionPlans.id],
  }),
  currentSubscription: one(subscriptionHistory, {
    fields: [users.currentSubscriptionId],
    references: [subscriptionHistory.id],
  }),
  subscriptionHistory: many(subscriptionHistory),
  paymentTransactions: many(paymentTransactions),
  events: many(events),
  activityLogs: many(activityLogs),
}));


export const eventsRelations = relations(events, ({ one, many }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
  assetRequirements: many(assetRequirements),
  speakers: many(speakers),
  reminders: many(reminders),
  activityLogs: many(activityLogs),
}));

export const assetRequirementsRelations = relations(assetRequirements, ({ one, many }) => ({
  event: one(events, {
    fields: [assetRequirements.eventId],
    references: [events.id],
  }),
  submissions: many(submissions),
}));

export const speakersRelations = relations(speakers, ({ one, many }) => ({
  event: one(events, {
    fields: [speakers.eventId],
    references: [events.id],
  }),
  submissions: many(submissions),
  reminders: many(reminders),
  activityLogs: many(activityLogs),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  speaker: one(speakers, {
    fields: [submissions.speakerId],
    references: [speakers.id],
  }),
  assetRequirement: one(assetRequirements, {
    fields: [submissions.assetRequirementId],
    references: [assetRequirements.id],
  }),
  previousVersion: one(submissions, {
    fields: [submissions.replacesSubmissionId],
    references: [submissions.id],
  }),
}));

export const remindersRelations = relations(reminders, ({ one }) => ({
  speaker: one(speakers, {
    fields: [reminders.speakerId],
    references: [speakers.id],
  }),
  event: one(events, {
    fields: [reminders.eventId],
    references: [events.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [activityLogs.eventId],
    references: [events.id],
  }),
  speaker: one(speakers, {
    fields: [activityLogs.speakerId],
    references: [speakers.id],
  }),
}));
