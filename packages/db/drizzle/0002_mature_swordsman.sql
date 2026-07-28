ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "deviation_focused" boolean;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "deviation_reason" text;