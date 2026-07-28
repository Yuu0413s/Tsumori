import { eq } from "drizzle-orm";
import { createDb } from "../src/index.js";
import { users, accounts, user, account, timeEntries } from "../src/schema.js";
import {
  planMigration,
  filterUnmigrated,
  findOrphanedTimeEntryUserIds,
} from "../src/migrate-legacy-auth.js";

// Issue #7: Auth.js 旧テーブル（users/accounts）の実データを
// better-auth 新テーブル（user/account）へ移す一度限りの移行スクリプト。
//
// 既定は dry-run（書き込みなし・件数のプレビューのみ）。
// 実際に書き込むには --execute を付けて実行する。
//   bun run scripts/migrate-legacy-auth.ts           # dry-run
//   bun run scripts/migrate-legacy-auth.ts --execute  # 実行

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL が設定されていません。.env を確認してください。");
}

const shouldExecute = process.argv.includes("--execute");

async function main() {
  const db = createDb(databaseUrl as string);

  const [legacyUsers, legacyGoogleAccounts, existingUsers, existingGoogleAccounts, timeEntryRows] =
    await Promise.all([
      db.select().from(users),
      db.select().from(accounts).where(eq(accounts.provider, "google")),
      db.select({ id: user.id }).from(user),
      db
        .select({ accountId: account.accountId })
        .from(account)
        .where(eq(account.providerId, "google")),
      db.select({ userId: timeEntries.userId }).from(timeEntries),
    ]);

  const plan = planMigration(legacyUsers, legacyGoogleAccounts);
  const toInsert = filterUnmigrated(plan, {
    userIds: new Set(existingUsers.map((u) => u.id)),
    googleAccountIds: new Set(existingGoogleAccounts.map((a) => a.accountId)),
  });

  console.log(
    `[dry-run=${!shouldExecute}] user 挿入予定: ${toInsert.users.length}件 / account 挿入予定: ${toInsert.accounts.length}件`,
  );

  if (shouldExecute) {
    if (toInsert.users.length > 0) {
      await db.insert(user).values(toInsert.users);
    }
    if (toInsert.accounts.length > 0) {
      await db.insert(account).values(toInsert.accounts);
    }
    console.log(
      `user 挿入: ${toInsert.users.length}件 / account 挿入: ${toInsert.accounts.length}件`,
    );
  } else {
    console.log("実際に書き込むには --execute を付けて実行してください。");
  }

  const migratedUserIds = new Set([
    ...existingUsers.map((u) => u.id),
    ...(shouldExecute ? toInsert.users.map((u) => u.id) : plan.users.map((u) => u.id)),
  ]);
  const orphaned = findOrphanedTimeEntryUserIds(
    timeEntryRows.map((t) => t.userId),
    migratedUserIds,
  );

  if (orphaned.length > 0) {
    console.error(
      `time_entries に孤立した userId があります（${orphaned.length}件）: ${orphaned.join(", ")}`,
    );
    process.exitCode = 1;
  } else {
    console.log("time_entries の孤立行はありません。");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
