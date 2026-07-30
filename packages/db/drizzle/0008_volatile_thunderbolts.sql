ALTER TABLE "user_settings" ALTER COLUMN "pre_alarm_minutes" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "pre_alarm_minutes" DROP NOT NULL;