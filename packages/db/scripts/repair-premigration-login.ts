import { eq, inArray, and, notExists } from "drizzle-orm";
import { createDb, type Database } from "../src/index.js";
import {
  users,
  accounts,
  user,
  account,
  categories,
  timeEntries,
  pushSubscriptions,
  userSettings,
} from "../src/schema.js";
import {
  planMigration,
  findEmailConflicts,
  findAccountIdConflicts,
  planAccidentalUserCleanup,
  findProtectedCleanupTargets,
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
// 注意：`user` の削除は categories/time_entries/push_subscriptions/
// user_settings にも cascade する（schema.ts 参照）。事故で作られた id を
// 本人が実際に使ってしまっていた場合、その間に作られたデータまで
// 削除で消えてしまう。削除の実行は「対象idであること」と「これらのテーブルに
// 実データが無いこと」を単一の DELETE 文（NOT EXISTS ガード）で同時に判定
// することで、チェックと削除の間にアプリが書き込みを行うTOCTOUを防いでいる
// （Codexレビュー対応）。
//
// 既定は dry-run（書き込みなし・対象一覧のプレビューのみ）。
//   bun run scripts/repair-premigration-login.ts           # dry-run
//   bun run scripts/repair-premigration-login.ts --execute  # 実行

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL が設定されていません。.env を確認してください。");
}

const shouldExecute = process.argv.includes("--execute");

/**
 * dry-run のプレビュー表示専用。実際の削除可否は main() 内の DELETE 文の
 * NOT EXISTS ガードが単一SQL文で判定するため、ここでの結果は
 * 「実行時点では変わりうる参考情報」に過ぎない。
 */
async function queryUserIdsWithAppData(db: Database, userIds: string[]): Promise<Set<string>> {
  const [categoryRows, timeEntryRows, pushSubRows, userSettingsRows] = await Promise.all([
    db
      .select({ userId: categories.userId })
      .from(categories)
      .where(inArray(categories.userId, userIds)),
    db
      .select({ userId: timeEntries.userId })
      .from(timeEntries)
      .where(inArray(timeEntries.userId, userIds)),
    db
      .select({ userId: pushSubscriptions.userId })
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds)),
    db
      .select({ userId: userSettings.userId })
      .from(userSettings)
      .where(inArray(userSettings.userId, userIds)),
  ]);
  return new Set(
    [...categoryRows, ...timeEntryRows, ...pushSubRows, ...userSettingsRows]
      .map((r) => r.userId)
      .filter((id): id is string => id !== null),
  );
}

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
    const matched = cleanup.userIdsToDelete.includes(c.existingUserId);
    console.log(
      `  email衝突: email=${c.email} legacy users.id=${c.legacyId} → user.id=${c.existingUserId}` +
        (matched ? "（削除対象）" : "（accountId衝突と一致しないため対象外）"),
    );
  }
  for (const c of accountIdConflicts) {
    const matched = cleanup.userIdsToDelete.includes(c.existingUserId);
    console.log(
      `  accountId衝突: accountId=${c.accountId} legacy accounts.userId=${c.legacyUserId} → user.id=${c.existingUserId}` +
        (matched ? "（削除対象）" : "（email衝突と一致しないため対象外）"),
    );
  }

  if (!shouldExecute) {
    const userIdsWithAppData = await queryUserIdsWithAppData(db, cleanup.userIdsToDelete);
    const protectedIds = findProtectedCleanupTargets(cleanup.userIdsToDelete, userIdsWithAppData);
    for (const id of cleanup.userIdsToDelete) {
      console.log(
        `  user.id=${id}` +
          (protectedIds.includes(id)
            ? "（実データあり: 実行時は削除されずスキップされます）"
            : "（現時点では実データなし）"),
      );
    }
    console.log("実際に削除するには --execute を付けて実行してください。");
    return;
  }

  // 「対象idであること」と「categories/time_entries/push_subscriptions/
  // user_settings に実データが無いこと」を単一の DELETE 文で同時に判定する。
  // チェックと削除を別クエリに分けると、その間にアプリが書き込みを行った
  // 場合にデータを cascade で失う TOCTOU が生じるため、単一SQL文でガードする。
  const deleted = await db
    .delete(user)
    .where(
      and(
        inArray(user.id, cleanup.userIdsToDelete),
        notExists(
          db.select({ id: categories.id }).from(categories).where(eq(categories.userId, user.id)),
        ),
        notExists(
          db
            .select({ id: timeEntries.id })
            .from(timeEntries)
            .where(eq(timeEntries.userId, user.id)),
        ),
        notExists(
          db
            .select({ id: pushSubscriptions.id })
            .from(pushSubscriptions)
            .where(eq(pushSubscriptions.userId, user.id)),
        ),
        notExists(
          db
            .select({ userId: userSettings.userId })
            .from(userSettings)
            .where(eq(userSettings.userId, user.id)),
        ),
      ),
    )
    .returning({ id: user.id });

  const deletedIds = new Set(deleted.map((row) => row.id));
  const skipped = cleanup.userIdsToDelete.filter((id) => !deletedIds.has(id));

  console.log(`user 削除: ${deleted.length}件（account/session は cascade で削除済み）`);
  if (skipped.length > 0) {
    console.error(
      `実データが見つかったため ${skipped.length}件は削除しませんでした: ${skipped.join(", ")}`,
    );
    console.error(
      "削除ではなく、このデータを対応する旧ユーザーへ付け替える対応（案A相当）を個別に検討してください。",
    );
    process.exitCode = 1;
  }
  if (deleted.length > 0) {
    console.log(
      "続けて `bun run db:migrate-legacy-auth -- --execute`（リポジトリルートから）を実行してください。対象者は再ログインが必要です。",
    );
  }
}

main(databaseUrl).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
