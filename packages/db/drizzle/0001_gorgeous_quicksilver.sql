ALTER TABLE "time_entries" ADD COLUMN "break_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "total_break_seconds" integer DEFAULT 0 NOT NULL;