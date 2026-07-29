-- categories.user_id を旧 users(id) から better-auth の user(id) へ付け替える前に、
-- 対応する行が user テーブルに無い（= Issue #7 のユーザー移行がまだ本番で
-- 実行されていない）categories が無いことを確認する。無ければ ADD CONSTRAINT 自体が
-- Postgres標準のFK違反で失敗するが、原因が分かりにくいため明示的なメッセージで止める
-- （Issue #8 Codexレビュー再指摘対応）。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "categories" c
    WHERE c."user_id" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = c."user_id")
  ) THEN
    RAISE EXCEPTION 'categories.user_id に better-auth の user テーブルへ未移行の行があります。先に Issue #7 の移行スクリプト（bun run db:migrate-legacy-auth）を本番DBに対して実行してください。';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "categories" DROP CONSTRAINT "categories_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;