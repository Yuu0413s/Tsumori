import { eq, inArray } from "drizzle-orm";
import { createDb } from "../src/index.js";
import { users, accounts, user, account } from "../src/schema.js";
import {
  planMigration,
  findEmailConflicts,
  findAccountIdConflicts,
  planAccidentalUserCleanup,
} from "../src/migrate-legacy-auth.js";

// Issue #42: migrate-legacy-auth.ts --execute より前に本人が Google ログイン
// してしまうと、better-auth がメール一致でリンクせず、ランダムな新規 id で
// `user` を作ってしまう事故が起きる（実際にゆうさんに発生した）。
// この事故が起きた状態のまま migrate-legacy-auth.ts --execute を流すと、
// email/accountId の衝突検出で処理全体が中止されてしまう。
//
// このスクリプトは、事故で作られた側の user 行だけを特定して削除する
// （account/session は schema.ts の onDelete: cascade で追従して消える）。
// 削除後に migrate-legacy-auth.ts --execute を実行すれば、旧 users.id を
// 引き継いだ形で正しく移行できる。対象者は better-auth のセッションが
// 失効するため、再ログインが必要になる。
//
// 既定は dry-run（書き込みなし・対象一覧のプレビューのみ）。
//   bun run scripts/repair-premigration-login.ts           # dry-run
//   bun run scripts/repair-premigration-login.ts --execute  # 実行

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL が設定されていません。.env を確認してください。");
}

const shouldExecute = process.argv.includes("--execute");

async function main(databaseUrl: string) {
  const db = createDb(databaseUrl);

  const [legacyUsers, legacyGoogleAccounts, existingUsers, existingGoogleAccounts] =
    await Promise.all([
      db.select().from(users),
      db.select().from(accounts).where(eq(accounts.provider, "google")),
      db.select({ id: user.id, email: user.email }).from(user),
      db
        .select({ accountId: account.accountId, userId: account.userId })
        .from(account)
        .where(eq(account.providerId, "google")),
    ]);

  const plan = planMigration(legacyUsers, legacyGoogleAccounts);
  const emailConflicts = findEmailConflicts(plan.users, existingUsers);
  const accountIdConflicts = findAccountIdConflicts(plan.accounts, existingGoogleAccounts);
  const cleanup = planAccidentalUserCleanup(emailConflicts, accountIdConflicts);

  if (cleanup.userIdsToDelete.length === 0) {
    console.log("事故で作られたと思われる user 行は見つかりませんでした。削除対象0件。");
    return;
  }

  console.log(
    `[dry-run=${!shouldExecute}] 事故で作られたと思われる user 行: ${cleanup.userIdsToDelete.length}件`,
  );
  for (const c of emailConflicts) {
    console.log(
      `  email衝突: email=${c.email} legacy users.id=${c.legacyId} → 削除対象 user.id=${c.existingUserId}`,
    );
  }
  for (const c of accountIdConflicts) {
    console.log(
      `  accountId衝突: accountId=${c.accountId} legacy accounts.userId=${c.legacyUserId} → 削除対象 user.id=${c.existingUserId}`,
    );
  }

  if (shouldExecute) {
    await db.delete(user).where(inArray(user.id, cleanup.userIdsToDelete));
    console.log(
      `user 削除: ${cleanup.userIdsToDelete.length}件（account/session は cascade で削除済み）`,
    );
    console.log(
      "続けて `bun run migrate-legacy-auth --execute` を実行してください。対象者は再ログインが必要です。",
    );
  } else {
    console.log("実際に削除するには --execute を付けて実行してください。");
  }
}

main(databaseUrl).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
