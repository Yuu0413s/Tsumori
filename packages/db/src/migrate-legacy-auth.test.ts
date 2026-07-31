import { describe, expect, test } from "bun:test";
import type { LegacyUser } from "./schema.js";
import type { LegacyAccount } from "./migrate-legacy-auth.js";
import {
  MigrationValidationError,
  toAuthUser,
  toGoogleAuthAccount,
  planMigration,
  filterUnmigrated,
  findOrphanedTimeEntryUserIds,
  findEmailConflicts,
  findAccountIdConflicts,
  planAccidentalUserCleanup,
  findProtectedCleanupTargets,
} from "./migrate-legacy-auth.js";

const NOW = new Date("2026-07-29T00:00:00.000Z");

function legacyUser(overrides: Partial<LegacyUser> = {}): LegacyUser {
  return {
    id: "user_1",
    name: "太郎",
    email: "taro@example.com",
    emailVerified: null,
    image: null,
    passwordHash: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function legacyAccount(overrides: Partial<LegacyAccount> = {}): LegacyAccount {
  return {
    userId: "user_1",
    type: "oauth",
    provider: "google",
    providerAccountId: "google-sub-1",
    refresh_token: null,
    access_token: "access-token-1",
    expires_at: null,
    token_type: null,
    scope: null,
    id_token: null,
    session_state: null,
    ...overrides,
  };
}

describe("toAuthUser", () => {
  test("name/email があれば移行できる", () => {
    const result = toAuthUser(legacyUser(), NOW);
    expect(result).toEqual({
      id: "user_1",
      name: "太郎",
      email: "taro@example.com",
      emailVerified: false,
      image: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  test("emailVerified が timestamp のとき true に変換する", () => {
    const result = toAuthUser(legacyUser({ emailVerified: new Date("2026-01-01") }), NOW);
    expect(result.emailVerified).toBe(true);
  });

  test("createdAt/updatedAt が既にあれば、それを引き継ぐ（now で上書きしない）", () => {
    const createdAt = new Date("2020-01-01");
    const updatedAt = new Date("2020-06-01");
    const result = toAuthUser(legacyUser({ createdAt, updatedAt }), NOW);
    expect(result.createdAt).toBe(createdAt);
    expect(result.updatedAt).toBe(updatedAt);
  });

  test("name が空のとき MigrationValidationError を投げる", () => {
    expect(() => toAuthUser(legacyUser({ name: null }), NOW)).toThrow(MigrationValidationError);
  });

  test("email が空のとき MigrationValidationError を投げる", () => {
    expect(() => toAuthUser(legacyUser({ email: null }), NOW)).toThrow(MigrationValidationError);
  });
});

describe("toGoogleAuthAccount", () => {
  test("google の account を移行できる（accountId = 旧 providerAccountId）", () => {
    const result = toGoogleAuthAccount(legacyAccount(), "new-account-id", NOW);
    expect(result).toEqual({
      id: "new-account-id",
      accountId: "google-sub-1",
      providerId: "google",
      userId: "user_1",
      accessToken: "access-token-1",
      refreshToken: null,
      idToken: null,
      scope: null,
      accessTokenExpiresAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  test("refreshToken/idToken/scopeも移行する", () => {
    const result = toGoogleAuthAccount(
      legacyAccount({
        refresh_token: "refresh-token-1",
        id_token: "id-token-1",
        scope: "openid email",
      }),
      "new-account-id",
      NOW,
    );
    expect(result.refreshToken).toBe("refresh-token-1");
    expect(result.idToken).toBe("id-token-1");
    expect(result.scope).toBe("openid email");
  });

  test("expires_at（Unix秒）を accessTokenExpiresAt（Date）に変換する", () => {
    const result = toGoogleAuthAccount(
      legacyAccount({ expires_at: 1_800_000_000 }),
      "new-account-id",
      NOW,
    );
    expect(result.accessTokenExpiresAt).toEqual(new Date(1_800_000_000 * 1000));
  });

  test("expires_at が null なら accessTokenExpiresAt も null", () => {
    const result = toGoogleAuthAccount(legacyAccount({ expires_at: null }), "new-account-id", NOW);
    expect(result.accessTokenExpiresAt).toBeNull();
  });

  test("google 以外の provider は MigrationValidationError を投げる", () => {
    expect(() =>
      toGoogleAuthAccount(legacyAccount({ provider: "credentials" }), "id", NOW),
    ).toThrow(MigrationValidationError);
  });
});

describe("planMigration", () => {
  test("全 user を移行し、account は google のみに絞る", () => {
    const legacyUsers = [
      legacyUser({ id: "user_1" }),
      legacyUser({ id: "user_2", email: "hanako@example.com" }),
    ];
    const legacyAccounts = [
      legacyAccount({ userId: "user_1", providerAccountId: "sub-1" }),
      legacyAccount({ userId: "user_2", provider: "credentials", providerAccountId: "n/a" }),
    ];

    const plan = planMigration(legacyUsers, legacyAccounts, {
      now: NOW,
      generateAccountId: () => "generated-id",
    });

    expect(plan.users).toHaveLength(2);
    expect(plan.accounts).toHaveLength(1);
    expect(plan.accounts[0]?.accountId).toBe("sub-1");
  });

  test("空配列を渡しても空の計画を返す（0件でもエラーにならない）", () => {
    const plan = planMigration([], [], { now: NOW });
    expect(plan).toEqual({ users: [], accounts: [] });
  });
});

describe("filterUnmigrated（冪等性）", () => {
  test("既に移行済みの user/account は除外される", () => {
    const plan = planMigration(
      [legacyUser({ id: "user_1" })],
      [legacyAccount({ userId: "user_1", providerAccountId: "sub-1" })],
      { now: NOW, generateAccountId: () => "generated-id" },
    );

    const result = filterUnmigrated(plan, {
      userIds: new Set(["user_1"]),
      googleAccountIds: new Set(["sub-1"]),
    });

    expect(result).toEqual({ users: [], accounts: [] });
  });

  test("1回目の移行結果をそのまま2回目の existing として渡すと、2回目は0件になる（実際にスクリプトを2回流しても壊れないことに相当）", () => {
    const legacyUsers = [legacyUser({ id: "user_1" })];
    const legacyAccounts = [legacyAccount({ userId: "user_1", providerAccountId: "sub-1" })];

    const firstPlan = planMigration(legacyUsers, legacyAccounts, {
      now: NOW,
      generateAccountId: () => "generated-id",
    });
    const existingAfterFirstRun = {
      userIds: new Set(firstPlan.users.map((u) => u.id)),
      googleAccountIds: new Set(firstPlan.accounts.map((a) => a.accountId)),
    };

    const secondPlan = planMigration(legacyUsers, legacyAccounts, {
      now: NOW,
      generateAccountId: () => "generated-id-2",
    });
    const toInsertOnSecondRun = filterUnmigrated(secondPlan, existingAfterFirstRun);

    expect(toInsertOnSecondRun).toEqual({ users: [], accounts: [] });
  });

  test("未移行分だけが残る（部分的に移行済みのケース）", () => {
    const plan = planMigration(
      [legacyUser({ id: "user_1" }), legacyUser({ id: "user_2", email: "hanako@example.com" })],
      [],
      { now: NOW },
    );

    const result = filterUnmigrated(plan, {
      userIds: new Set(["user_1"]),
      googleAccountIds: new Set(),
    });

    expect(result.users).toHaveLength(1);
    expect(result.users[0]?.id).toBe("user_2");
  });
});

describe("findOrphanedTimeEntryUserIds", () => {
  test("全ての userId が移行済みなら孤立は0件", () => {
    const result = findOrphanedTimeEntryUserIds(
      ["user_1", "user_1", "user_2"],
      new Set(["user_1", "user_2"]),
    );
    expect(result).toEqual([]);
  });

  test("移行されていない userId を重複無しで返す", () => {
    const result = findOrphanedTimeEntryUserIds(
      ["user_1", "user_missing", "user_missing"],
      new Set(["user_1"]),
    );
    expect(result).toEqual(["user_missing"]);
  });

  test("time_entries が空でも孤立は0件", () => {
    const result = findOrphanedTimeEntryUserIds([], new Set(["user_1"]));
    expect(result).toEqual([]);
  });
});

describe("findEmailConflicts", () => {
  test("同じ email で別 id の既存 user がある場合は衝突として検出する", () => {
    const plan = planMigration([legacyUser({ id: "user_1", email: "taro@example.com" })], [], {
      now: NOW,
    });

    const result = findEmailConflicts(plan.users, [
      { id: "already-existing-id", email: "taro@example.com" },
    ]);

    expect(result).toEqual([
      { legacyId: "user_1", email: "taro@example.com", existingUserId: "already-existing-id" },
    ]);
  });

  test("同じ id・同じ email の既存 user は衝突ではない（再実行時に自分自身と一致するだけ）", () => {
    const plan = planMigration([legacyUser({ id: "user_1", email: "taro@example.com" })], [], {
      now: NOW,
    });

    const result = findEmailConflicts(plan.users, [{ id: "user_1", email: "taro@example.com" }]);

    expect(result).toEqual([]);
  });

  test("既存 user が空でも衝突は0件", () => {
    const plan = planMigration([legacyUser({ id: "user_1" })], [], { now: NOW });
    expect(findEmailConflicts(plan.users, [])).toEqual([]);
  });

  test("email が一致しなければ衝突ではない", () => {
    const plan = planMigration([legacyUser({ id: "user_1", email: "taro@example.com" })], [], {
      now: NOW,
    });

    const result = findEmailConflicts(plan.users, [
      { id: "other-id", email: "hanako@example.com" },
    ]);

    expect(result).toEqual([]);
  });
});

describe("findAccountIdConflicts", () => {
  test("同じ accountId が既に別 userId で登録されている場合は衝突として検出する", () => {
    const plan = planMigration(
      [],
      [legacyAccount({ userId: "user_1", providerAccountId: "sub-1" })],
      { now: NOW, generateAccountId: () => "generated-id" },
    );

    const result = findAccountIdConflicts(plan.accounts, [
      { accountId: "sub-1", userId: "already-linked-to-other-user" },
    ]);

    expect(result).toEqual([
      {
        legacyUserId: "user_1",
        accountId: "sub-1",
        existingUserId: "already-linked-to-other-user",
      },
    ]);
  });

  test("同じ accountId・同じ userId は衝突ではない（再実行時に自分自身と一致するだけ）", () => {
    const plan = planMigration(
      [],
      [legacyAccount({ userId: "user_1", providerAccountId: "sub-1" })],
      { now: NOW, generateAccountId: () => "generated-id" },
    );

    const result = findAccountIdConflicts(plan.accounts, [
      { accountId: "sub-1", userId: "user_1" },
    ]);

    expect(result).toEqual([]);
  });

  test("既存 account が空でも衝突は0件", () => {
    const plan = planMigration(
      [],
      [legacyAccount({ userId: "user_1", providerAccountId: "sub-1" })],
      { now: NOW },
    );
    expect(findAccountIdConflicts(plan.accounts, [])).toEqual([]);
  });

  test("accountId が一致しなければ衝突ではない", () => {
    const plan = planMigration(
      [],
      [legacyAccount({ userId: "user_1", providerAccountId: "sub-1" })],
      { now: NOW },
    );

    const result = findAccountIdConflicts(plan.accounts, [
      { accountId: "sub-other", userId: "someone-else" },
    ]);

    expect(result).toEqual([]);
  });
});

describe("planAccidentalUserCleanup", () => {
  test("同じ legacyId・同じ existingUserId で email衝突とaccountId衝突の両方が一致すれば削除対象にする（実際の事故の形）", () => {
    const result = planAccidentalUserCleanup(
      [{ legacyId: "user_1", email: "taro@example.com", existingUserId: "accidental-id" }],
      [{ legacyUserId: "user_1", accountId: "sub-1", existingUserId: "accidental-id" }],
    );
    expect(result).toEqual({ userIdsToDelete: ["accidental-id"] });
  });

  test("emailConflicts にしか無い衝突は削除対象にしない（無関係なemail重複を誤って削除しないため）", () => {
    const result = planAccidentalUserCleanup(
      [{ legacyId: "user_1", email: "taro@example.com", existingUserId: "accidental-id" }],
      [],
    );
    expect(result).toEqual({ userIdsToDelete: [] });
  });

  test("accountIdConflicts にしか無い衝突は削除対象にしない", () => {
    const result = planAccidentalUserCleanup(
      [],
      [{ legacyUserId: "user_1", accountId: "sub-1", existingUserId: "accidental-id" }],
    );
    expect(result).toEqual({ userIdsToDelete: [] });
  });

  test("existingUserId は同じでも legacyId が食い違う場合は削除対象にしない", () => {
    const result = planAccidentalUserCleanup(
      [{ legacyId: "user_1", email: "taro@example.com", existingUserId: "accidental-id" }],
      [{ legacyUserId: "user_2", accountId: "sub-1", existingUserId: "accidental-id" }],
    );
    expect(result).toEqual({ userIdsToDelete: [] });
  });

  test("legacyId は同じでも existingUserId が食い違う場合は削除対象にしない", () => {
    const result = planAccidentalUserCleanup(
      [{ legacyId: "user_1", email: "taro@example.com", existingUserId: "accidental-id-1" }],
      [{ legacyUserId: "user_1", accountId: "sub-1", existingUserId: "accidental-id-2" }],
    );
    expect(result).toEqual({ userIdsToDelete: [] });
  });

  test("複数人が事故に遭ったケースでも、両方一致した分だけ重複無く削除対象にする", () => {
    const result = planAccidentalUserCleanup(
      [
        { legacyId: "user_1", email: "taro@example.com", existingUserId: "accidental-id-1" },
        { legacyId: "user_2", email: "hanako@example.com", existingUserId: "accidental-id-2" },
      ],
      [
        { legacyUserId: "user_1", accountId: "sub-1", existingUserId: "accidental-id-1" },
        { legacyUserId: "user_2", accountId: "sub-2", existingUserId: "accidental-id-2" },
      ],
    );
    expect(result.userIdsToDelete.sort()).toEqual(["accidental-id-1", "accidental-id-2"]);
  });

  test("衝突が無ければ削除対象は0件", () => {
    const result = planAccidentalUserCleanup([], []);
    expect(result).toEqual({ userIdsToDelete: [] });
  });
});

describe("findProtectedCleanupTargets", () => {
  test("実データを持つ削除対象idを返す（誤って本人の作業記録等を消さないためのガード）", () => {
    const result = findProtectedCleanupTargets(
      ["accidental-id-1", "accidental-id-2"],
      new Set(["accidental-id-1"]),
    );
    expect(result).toEqual(["accidental-id-1"]);
  });

  test("実データが無ければ空配列（削除して問題ないと判断できる）", () => {
    const result = findProtectedCleanupTargets(["accidental-id-1"], new Set());
    expect(result).toEqual([]);
  });

  test("削除対象が空なら結果も空", () => {
    const result = findProtectedCleanupTargets([], new Set(["accidental-id-1"]));
    expect(result).toEqual([]);
  });
});
