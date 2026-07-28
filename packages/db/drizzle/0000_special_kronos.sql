-- task_types テーブルを categories にリネーム
ALTER TABLE "task_types" RENAME TO "categories";
--> statement-breakpoint

-- categories の FK 制約名を更新
ALTER TABLE "categories" RENAME CONSTRAINT "task_types_user_id_users_id_fk" TO "categories_user_id_users_id_fk";
--> statement-breakpoint

-- time_entries の task_type_id カラムを category_id にリネーム
ALTER TABLE "time_entries" RENAME COLUMN "task_type_id" TO "category_id";
--> statement-breakpoint

-- 旧 FK 制約を削除し新しい制約を追加
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_task_type_id_task_types_id_fk";
--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- 新規カラムを追加（既存レコードは自動的に NULL）
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "name" text;
--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "planned_start_at" timestamp;
--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "planned_duration_minutes" integer;
