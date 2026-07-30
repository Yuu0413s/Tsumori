import { describe, expect, test } from "bun:test";
import type { MiddlewareHandler } from "hono";
import type { UserSettings, UserSettingsStore, SettingsPatch } from "@tsumori/db";
import { createSettingsRoutes } from "./settings.js";
import type { AuthVariables } from "../middleware/require-auth.js";
import type { Bindings } from "../env.js";

type Env = { Bindings: Bindings; Variables: AuthVariables };

const OWNER_ID = "user_1";
const OTHER_USER_ID = "user_2";

function asUser(userId: string): MiddlewareHandler<Env> {
  return async (c, next) => {
    c.set("userId", userId);
    await next();
  };
}

function settings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    userId: OWNER_ID,
    breakExtendsDeadline: true,
    soundEnabled: true,
    preAlarmMinutes: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** テスト用のインメモリ UserSettingsStore。実DBに繋がずルートの挙動だけを検証する。 */
function createFakeStore(initial: UserSettings[] = []): UserSettingsStore {
  const rows = new Map(initial.map((s) => [s.userId, s]));

  return {
    async getOrCreate(userId) {
      const existing = rows.get(userId);
      if (existing) return existing;
      const created = settings({ userId });
      rows.set(userId, created);
      return created;
    },
    async update(userId, patch: SettingsPatch) {
      const existing = rows.get(userId) ?? settings({ userId });
      const updated: UserSettings = { ...existing, ...patch, updatedAt: new Date() };
      rows.set(userId, updated);
      return updated;
    },
  };
}

function buildApp(initial: UserSettings[], userId: string) {
  const store = createFakeStore(initial);
  const app = createSettingsRoutes(() => store, asUser(userId));
  return { app, store };
}

describe("GET /", () => {
  test("設定が無ければデフォルト値を返す", async () => {
    const { app } = buildApp([], OWNER_ID);

    const res = await app.request("/");
    const body = (await res.json()) as UserSettings;

    expect(res.status).toBe(200);
    expect(body.breakExtendsDeadline).toBe(true);
    expect(body.soundEnabled).toBe(true);
    expect(body.preAlarmMinutes).toBeNull();
  });

  test("既存の設定があればそれを返す", async () => {
    const { app } = buildApp(
      [settings({ breakExtendsDeadline: false, preAlarmMinutes: 10 })],
      OWNER_ID,
    );

    const res = await app.request("/");
    const body = (await res.json()) as UserSettings;

    expect(body.breakExtendsDeadline).toBe(false);
    expect(body.preAlarmMinutes).toBe(10);
  });

  test("他人の設定は返さない（自分の分だけ取得・作成される）", async () => {
    const { app, store } = buildApp(
      [settings({ userId: OTHER_USER_ID, breakExtendsDeadline: false })],
      OWNER_ID,
    );

    const res = await app.request("/");
    const body = (await res.json()) as UserSettings;

    expect(body.userId).toBe(OWNER_ID);
    expect(body.breakExtendsDeadline).toBe(true);
    expect((await store.getOrCreate(OTHER_USER_ID)).breakExtendsDeadline).toBe(false);
  });
});

describe("PATCH /", () => {
  test("breakExtendsDeadline を更新できる", async () => {
    const { app } = buildApp([settings()], OWNER_ID);

    const res = await app.request("/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ breakExtendsDeadline: false }),
    });
    const body = (await res.json()) as UserSettings;

    expect(res.status).toBe(200);
    expect(body.breakExtendsDeadline).toBe(false);
  });

  test("soundEnabled を更新できる", async () => {
    const { app } = buildApp([settings()], OWNER_ID);

    const res = await app.request("/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ soundEnabled: false }),
    });
    const body = (await res.json()) as UserSettings;

    expect(body.soundEnabled).toBe(false);
  });

  test("preAlarmMinutes を数値に更新できる", async () => {
    const { app } = buildApp([settings()], OWNER_ID);

    const res = await app.request("/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preAlarmMinutes: 15 }),
    });
    const body = (await res.json()) as UserSettings;

    expect(body.preAlarmMinutes).toBe(15);
  });

  test("preAlarmMinutes を null に更新できる（予告なし）", async () => {
    const { app } = buildApp([settings({ preAlarmMinutes: 15 })], OWNER_ID);

    const res = await app.request("/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preAlarmMinutes: null }),
    });
    const body = (await res.json()) as UserSettings;

    expect(body.preAlarmMinutes).toBeNull();
  });

  test("設定行が無いユーザーへのPATCHも作成して更新する", async () => {
    const { app } = buildApp([], OWNER_ID);

    const res = await app.request("/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ soundEnabled: false }),
    });
    const body = (await res.json()) as UserSettings;

    expect(res.status).toBe(200);
    expect(body.soundEnabled).toBe(false);
    // 指定しなかった項目はデフォルト値になる
    expect(body.breakExtendsDeadline).toBe(true);
  });

  test("複数項目を同時に更新できる", async () => {
    const { app } = buildApp([settings()], OWNER_ID);

    const res = await app.request("/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        breakExtendsDeadline: false,
        soundEnabled: false,
        preAlarmMinutes: 3,
      }),
    });
    const body = (await res.json()) as UserSettings;

    expect(body.breakExtendsDeadline).toBe(false);
    expect(body.soundEnabled).toBe(false);
    expect(body.preAlarmMinutes).toBe(3);
  });

  test("breakExtendsDeadline が真偽値以外なら400", async () => {
    const { app } = buildApp([settings()], OWNER_ID);

    const res = await app.request("/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ breakExtendsDeadline: "yes" }),
    });

    expect(res.status).toBe(400);
  });

  test("soundEnabled が真偽値以外なら400", async () => {
    const { app } = buildApp([settings()], OWNER_ID);

    const res = await app.request("/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ soundEnabled: 1 }),
    });

    expect(res.status).toBe(400);
  });

  test("preAlarmMinutes が負の値なら400", async () => {
    const { app } = buildApp([settings()], OWNER_ID);

    const res = await app.request("/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preAlarmMinutes: -1 }),
    });

    expect(res.status).toBe(400);
  });

  test("preAlarmMinutes が上限（1440分）を超えたら400", async () => {
    const { app } = buildApp([settings()], OWNER_ID);

    const res = await app.request("/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preAlarmMinutes: 1441 }),
    });

    expect(res.status).toBe(400);
  });

  test("更新する項目が無ければ400", async () => {
    const { app } = buildApp([settings()], OWNER_ID);

    const res = await app.request("/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  test("他人の設定には影響しない", async () => {
    const { app, store } = buildApp(
      [settings({ userId: OWNER_ID }), settings({ userId: OTHER_USER_ID })],
      OWNER_ID,
    );

    await app.request("/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ breakExtendsDeadline: false }),
    });

    expect((await store.getOrCreate(OTHER_USER_ID)).breakExtendsDeadline).toBe(true);
  });
});

describe("store が例外を投げたとき", () => {
  test("500 を { error } 形式で返す（DB接続断など、想定外の失敗を想定）", async () => {
    const brokenStore: UserSettingsStore = {
      async getOrCreate() {
        throw new Error("boom");
      },
      async update() {
        throw new Error("boom");
      },
    };
    const app = createSettingsRoutes(() => brokenStore, asUser(OWNER_ID));

    const res = await app.request("/");
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal Server Error");
  });
});
