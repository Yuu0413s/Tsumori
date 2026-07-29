import { describe, expect, test } from "bun:test";
import type { MiddlewareHandler } from "hono";
import type { Category, CategoryStore, NewCategory } from "@tsumori/db";
import { createCategoriesRoutes } from "./categories.js";
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

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat_1",
    userId: OWNER_ID,
    name: "仕事",
    color: "#3b82f6",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** テスト用のインメモリ CategoryStore。実DBに繋がずルートの挙動だけを検証する。 */
function createFakeStore(initial: Category[] = []): CategoryStore {
  const rows = new Map(initial.map((c) => [c.id, c]));

  return {
    async listVisible(userId) {
      return [...rows.values()].filter(
        (r) => r.isActive && (r.userId === userId || r.userId === null),
      );
    },
    async findById(id) {
      return rows.get(id);
    },
    async insert(row: NewCategory) {
      const created: Category = {
        id: row.id,
        userId: row.userId ?? null,
        name: row.name,
        color: row.color ?? "#3b82f6",
        isActive: row.isActive ?? true,
        createdAt: row.createdAt ?? new Date(),
      };
      rows.set(created.id, created);
      return created;
    },
    async update(id, patch) {
      const existing = rows.get(id);
      if (!existing) throw new Error("not found");
      const updated = { ...existing, ...patch };
      rows.set(id, updated);
      return updated;
    },
    async softDelete(id) {
      const existing = rows.get(id);
      if (!existing) throw new Error("not found");
      const updated = { ...existing, isActive: false };
      rows.set(id, updated);
      return updated;
    },
  };
}

function buildApp(rows: Category[], userId: string) {
  const store = createFakeStore(rows);
  const app = createCategoriesRoutes(() => store, asUser(userId));
  return { app, store };
}

describe("GET /", () => {
  test("自分のカテゴリと共通カテゴリ（userId が null）を返す", async () => {
    const { app } = buildApp(
      [
        category({ id: "own", userId: OWNER_ID }),
        category({ id: "common", userId: null }),
        category({ id: "other", userId: OTHER_USER_ID }),
      ],
      OWNER_ID,
    );

    const res = await app.request("/");
    const body = (await res.json()) as Category[];

    expect(res.status).toBe(200);
    expect(body.map((c) => c.id).sort()).toEqual(["common", "own"]);
  });

  test("論理削除済み（isActive=false）のカテゴリは返さない", async () => {
    const { app } = buildApp(
      [category({ id: "inactive", userId: OWNER_ID, isActive: false })],
      OWNER_ID,
    );

    const res = await app.request("/");
    const body = (await res.json()) as Category[];

    expect(body).toEqual([]);
  });
});

describe("POST /", () => {
  test("正しい入力でカテゴリを作成できる", async () => {
    const { app, store } = buildApp([], OWNER_ID);

    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "趣味", color: "#ff0000" }),
    });
    const body = (await res.json()) as Category;

    expect(res.status).toBe(201);
    expect(body.name).toBe("趣味");
    expect(body.color).toBe("#ff0000");
    expect(body.userId).toBe(OWNER_ID);
    expect(await store.findById(body.id)).toBeTruthy();
  });

  test("name が空文字なら400", async () => {
    const { app } = buildApp([], OWNER_ID);

    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });

    expect(res.status).toBe(400);
  });

  test("color の形式が不正なら400", async () => {
    const { app } = buildApp([], OWNER_ID);

    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "趣味", color: "red" }),
    });

    expect(res.status).toBe(400);
  });
});

describe("PATCH /:id", () => {
  test("自分のカテゴリは更新できる", async () => {
    const { app } = buildApp([category({ id: "own", userId: OWNER_ID })], OWNER_ID);

    const res = await app.request("/own", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "更新後" }),
    });
    const body = (await res.json()) as Category;

    expect(res.status).toBe(200);
    expect(body.name).toBe("更新後");
  });

  test("他人のカテゴリは更新できない（403）", async () => {
    const { app } = buildApp([category({ id: "other", userId: OTHER_USER_ID })], OWNER_ID);

    const res = await app.request("/other", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "乗っ取り" }),
    });

    expect(res.status).toBe(403);
  });

  test("共通カテゴリ（userId が null）は一般ユーザーが更新できない（403）", async () => {
    const { app } = buildApp([category({ id: "common", userId: null })], OWNER_ID);

    const res = await app.request("/common", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "書き換え" }),
    });

    expect(res.status).toBe(403);
  });

  test("存在しないIDは404", async () => {
    const { app } = buildApp([], OWNER_ID);

    const res = await app.request("/missing", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "x" }),
    });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /:id", () => {
  test("自分のカテゴリは論理削除できる（isActive=false になる。行自体は消えない）", async () => {
    const { app, store } = buildApp([category({ id: "own", userId: OWNER_ID })], OWNER_ID);

    const res = await app.request("/own", { method: "DELETE" });

    expect(res.status).toBe(204);
    const found = await store.findById("own");
    expect(found?.isActive).toBe(false);
  });

  test("他人のカテゴリは削除できない（403）", async () => {
    const { app, store } = buildApp([category({ id: "other", userId: OTHER_USER_ID })], OWNER_ID);

    const res = await app.request("/other", { method: "DELETE" });

    expect(res.status).toBe(403);
    const found = await store.findById("other");
    expect(found?.isActive).toBe(true);
  });

  test("共通カテゴリ（userId が null）は一般ユーザーが削除できない（403）", async () => {
    const { app, store } = buildApp([category({ id: "common", userId: null })], OWNER_ID);

    const res = await app.request("/common", { method: "DELETE" });

    expect(res.status).toBe(403);
    const found = await store.findById("common");
    expect(found?.isActive).toBe(true);
  });
});

describe("store が例外を投げたとき", () => {
  test("500 を { error } 形式で返す（findById後の削除競合などを想定）", async () => {
    const store = createFakeStore([category({ id: "own", userId: OWNER_ID })]);
    const brokenStore: CategoryStore = {
      ...store,
      update: async () => {
        throw new Error("boom");
      },
    };
    const app = createCategoriesRoutes(() => brokenStore, asUser(OWNER_ID));

    const res = await app.request("/own", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "更新後" }),
    });
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal Server Error");
  });
});
