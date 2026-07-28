ALTER TABLE "user_settings" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "updated_at" SET NOT NULL;