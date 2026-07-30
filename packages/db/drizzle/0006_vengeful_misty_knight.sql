-- time_entries.user_id を旧 users(id) から better-auth の user(id) へ付け替える前に、
-- 対応する行が user テーブルに無い（= Issue #7 のユーザー移行が未実行）
-- time_entries が無いことを確認する（categories#8 と同じ理由・同じパターン）。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "time_entries" t
    WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = t."user_id")
  ) THEN
    RAISE EXCEPTION 'time_entries.user_id に better-auth の user テーブルへ未移行の行があります。先に Issue #7 の移行スクリプト（bun run db:migrate-legacy-auth）を本番DBに対して実行してください。';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- 「同時に1件しか進行中を持てない」をDB制約でも保証する（Issue #9）。
-- 既存データに同一ユーザーの進行中(working/on_break)エントリが複数あると
-- このCREATE UNIQUE INDEX自体が失敗するため、事前チェックは行わず
-- Postgres標準のエラーに任せる（原因が明確なため）。
CREATE UNIQUE INDEX "time_entries_one_active_per_user_idx" ON "time_entries" USING btree ("user_id") WHERE "time_entries"."status" <> 'completed';