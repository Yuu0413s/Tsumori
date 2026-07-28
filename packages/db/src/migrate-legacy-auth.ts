import { accounts, account, type LegacyUser, type NewAuthUser } from "./schema.js";

export type LegacyAccount = typeof accounts.$inferSelect;
export type NewAuthAccount = typeof account.$inferInsert;

export class MigrationValidationError extends Error {}

/**
 * better-auth の `user` は name/email が NOT NULL のため、
 * 欠けたレコードは黙って移行せず、対象行が分かる形で止める（Issue #7）。
 */
export function toAuthUser(legacy: LegacyUser, now: Date): NewAuthUser {
  if (!legacy.name || !legacy.email) {
    throw new MigrationValidationError(
      `users.id=${legacy.id} は name または email が空のため移行できません`,
    );
  }

  return {
    id: legacy.id,
    name: legacy.name,
    email: legacy.email,
    emailVerified: legacy.emailVerified !== null,
    image: legacy.image,
    createdAt: legacy.createdAt ?? now,
    updatedAt: legacy.updatedAt ?? now,
  };
}

/**
 * 移行対象は google のみ（Issue #7 で確定済み）。
 * password 用の credential account は作らない。
 */
export function toGoogleAuthAccount(legacy: LegacyAccount, id: string, now: Date): NewAuthAccount {
  if (legacy.provider !== "google") {
    throw new MigrationValidationError(
      `accounts.provider="${legacy.provider}" は google 以外のため移行対象外です`,
    );
  }

  return {
    id,
    accountId: legacy.providerAccountId,
    providerId: "google",
    userId: legacy.userId,
    accessToken: legacy.access_token,
    refreshToken: legacy.refresh_token,
    idToken: legacy.id_token,
    scope: legacy.scope,
    // Auth.js の expires_at は Unix秒（access_tokenの有効期限）。
    // better-auth の accessTokenExpiresAt は Date のため変換する。
    accessTokenExpiresAt: legacy.expires_at === null ? null : new Date(legacy.expires_at * 1000),
    createdAt: now,
    updatedAt: now,
  };
}

export interface MigrationPlan {
  users: NewAuthUser[];
  accounts: NewAuthAccount[];
}

export interface PlanMigrationOptions {
  now?: Date;
  generateAccountId?: () => string;
}

/**
 * 全 user 行を移行し、account は google のみを移行する（Issue #7 の確定ルール）。
 */
export function planMigration(
  legacyUsers: LegacyUser[],
  legacyAccounts: LegacyAccount[],
  options: PlanMigrationOptions = {},
): MigrationPlan {
  const now = options.now ?? new Date();
  const generateAccountId = options.generateAccountId ?? (() => crypto.randomUUID());
  const googleAccounts = legacyAccounts.filter((a) => a.provider === "google");

  return {
    users: legacyUsers.map((u) => toAuthUser(u, now)),
    accounts: googleAccounts.map((a) => toGoogleAuthAccount(a, generateAccountId(), now)),
  };
}

export interface ExistingMigratedIds {
  userIds: Set<string>;
  googleAccountIds: Set<string>;
}

/**
 * 既に移行済みの行を除いた差分を返す。スクリプトを2回流しても
 * 重複挿入にならないようにするための冪等性の要（Issue #7 完了条件）。
 */
export function filterUnmigrated(
  plan: MigrationPlan,
  existing: ExistingMigratedIds,
): MigrationPlan {
  return {
    users: plan.users.filter((u) => !existing.userIds.has(u.id)),
    accounts: plan.accounts.filter((a) => !existing.googleAccountIds.has(a.accountId)),
  };
}

/**
 * time_entries.userId が移行後の user テーブルに存在しない = 孤立行。
 * Issue #7 の完了条件（time_entries 44件に孤立が無い）を機械的に検証する。
 */
export function findOrphanedTimeEntryUserIds(
  timeEntryUserIds: string[],
  migratedUserIds: Set<string>,
): string[] {
  const orphaned = new Set(timeEntryUserIds.filter((id) => !migratedUserIds.has(id)));
  return [...orphaned];
}

export interface ExistingAuthUser {
  id: string;
  email: string;
}

export interface EmailConflict {
  legacyId: string;
  email: string;
  existingUserId: string;
}

/**
 * `user.email` には unique 制約があるため、移行対象の email が
 * 既存の別 id の user と衝突していないかを insert 前に検証する
 * （Codexレビュー対応：insert失敗で初めて気づくと原因が分かりにくいため）。
 */
export function findEmailConflicts(
  usersToInsert: NewAuthUser[],
  existingUsers: ExistingAuthUser[],
): EmailConflict[] {
  const existingIdByEmail = new Map(existingUsers.map((u) => [u.email, u.id]));

  return usersToInsert.flatMap((u) => {
    const existingUserId = existingIdByEmail.get(u.email);
    return existingUserId !== undefined && existingUserId !== u.id
      ? [{ legacyId: u.id, email: u.email, existingUserId }]
      : [];
  });
}

export interface ExistingGoogleAccount {
  accountId: string;
  userId: string;
}

export interface AccountIdConflict {
  legacyUserId: string;
  accountId: string;
  existingUserId: string;
}

/**
 * 同じ Google accountId が既に別の userId で登録されている場合を検出する。
 * `filterUnmigrated` は accountId の一致だけで「移行済み」と判定するため、
 * これを見逃すと「別の user に紐付いた Google アカウント」を黙ってスキップ
 * してしまう（Issue #7 が警告する「移行前に一度ログインしてしまう」事故が
 * 実際に起きていた場合に発生し得る。Codexレビュー対応）。
 * plan（filterUnmigrated 前の全件）に対して呼ぶこと。
 */
export function findAccountIdConflicts(
  plannedAccounts: NewAuthAccount[],
  existingAccounts: ExistingGoogleAccount[],
): AccountIdConflict[] {
  const existingUserIdByAccountId = new Map(existingAccounts.map((a) => [a.accountId, a.userId]));

  return plannedAccounts.flatMap((a) => {
    const existingUserId = existingUserIdByAccountId.get(a.accountId);
    return existingUserId !== undefined && existingUserId !== a.userId
      ? [{ legacyUserId: a.userId, accountId: a.accountId, existingUserId }]
      : [];
  });
}
