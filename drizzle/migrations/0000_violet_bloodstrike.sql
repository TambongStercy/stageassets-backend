CREATE TYPE "public"."asset_type" AS ENUM('headshot', 'bio', 'presentation', 'logo', 'other');--> statement-breakpoint
CREATE TYPE "public"."reminder_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'partial', 'complete');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('free', 'starter', 'professional', 'agency');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"event_id" integer,
	"speaker_id" integer,
	"action" varchar(100) NOT NULL,
	"description" text,
	"metadata" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_requirements" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"asset_type" "asset_type" NOT NULL,
	"label" varchar(100) NOT NULL,
	"description" text,
	"is_required" boolean DEFAULT true NOT NULL,
	"accepted_file_types" text,
	"max_file_size_mb" integer DEFAULT 10,
	"min_image_width" integer,
	"min_image_height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"deadline" timestamp NOT NULL,
	"event_date" timestamp,
	"brand_color" varchar(7) DEFAULT '#3B82F6',
	"logo_url" text,
	"enable_auto_reminders" boolean DEFAULT true NOT NULL,
	"reminder_days_before" integer DEFAULT 3 NOT NULL,
	"custom_instructions" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subscription_history_id" integer,
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" varchar(20) NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_charge_id" varchar(255),
	"payment_method" varchar(50),
	"failure_code" varchar(50),
	"failure_message" text,
	"refunded_at" timestamp,
	"refund_amount" integer,
	"refund_reason" text,
	"description" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"speaker_id" integer NOT NULL,
	"event_id" integer NOT NULL,
	"status" "reminder_status" DEFAULT 'pending' NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"sent_at" timestamp,
	"email_subject" varchar(255),
	"email_body" text,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speakers" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"company" varchar(255),
	"job_title" varchar(255),
	"bio" text,
	"access_token" varchar(64) NOT NULL,
	"submission_status" "submission_status" DEFAULT 'pending' NOT NULL,
	"submitted_at" timestamp,
	"last_reminder_sent_at" timestamp,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"invited_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "speakers_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"speaker_id" integer NOT NULL,
	"asset_requirement_id" integer NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"storage_provider" varchar(50) DEFAULT 'local' NOT NULL,
	"storage_path" text NOT NULL,
	"image_width" integer,
	"image_height" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"replaces_submission_id" integer,
	"is_latest" boolean DEFAULT true NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"plan_id" integer NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"amount_paid" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"billing_cycle" varchar(20) NOT NULL,
	"stripe_subscription_id" varchar(255),
	"stripe_invoice_id" varchar(255),
	"payment_method" varchar(50),
	"status" varchar(20) NOT NULL,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"will_auto_renew" boolean DEFAULT true NOT NULL,
	"next_billing_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"description" text,
	"price_monthly" integer NOT NULL,
	"price_yearly" integer,
	"max_active_events" integer NOT NULL,
	"max_speakers_per_event" integer NOT NULL,
	"features" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"google_id" varchar(255),
	"current_plan_id" integer,
	"current_subscription_id" integer,
	"stripe_customer_id" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token" varchar(255),
	"password_reset_token" varchar(255),
	"password_reset_expires" timestamp,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_speaker_id_speakers_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."speakers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_requirements" ADD CONSTRAINT "asset_requirements_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_subscription_history_id_subscription_history_id_fk" FOREIGN KEY ("subscription_history_id") REFERENCES "public"."subscription_history"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_speaker_id_speakers_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."speakers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_speaker_id_speakers_id_fk" FOREIGN KEY ("speaker_id") REFERENCES "public"."speakers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_asset_requirement_id_asset_requirements_id_fk" FOREIGN KEY ("asset_requirement_id") REFERENCES "public"."asset_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_history" ADD CONSTRAINT "subscription_history_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_current_plan_id_subscription_plans_id_fk" FOREIGN KEY ("current_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_current_subscription_id_subscription_history_id_fk" FOREIGN KEY ("current_subscription_id") REFERENCES "public"."subscription_history"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_slug_idx" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "speaker_access_token_idx" ON "speakers" USING btree ("access_token");--> statement-breakpoint
CREATE UNIQUE INDEX "speaker_email_event_idx" ON "speakers" USING btree ("email","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_speaker_asset_idx" ON "submissions" USING btree ("speaker_id","asset_requirement_id") WHERE "submissions"."is_latest" = true;