import { describe, expect, test } from "bun:test";
import type { MiddlewareHandler } from "hono";
import type { Category, CategoryStore, TimeEntry, TimeEntryStore, NewTimeEntry } from "@tsumori/db";
import { ActiveTimeEntryConflictError } from "@tsumori/db";
import { createTimeEntriesRoutes } from "./time-entries.js";
import type { AuthVariables } from "../middleware/require-auth.js";
import type { Bindings } from "../env.js";

type Env = { Bindings: Bindings; Variables: AuthVariables };

const OWNER_ID = "user_1";
const OTHER_USER_ID = "user_2";
const CATEGORY_ID = "cat_1";

const FIXED_NOW = new Date("2026-07-29T10:30:00.000Z");

function asUser(userId: string): MiddlewareHandler<Env> {
  return async (c, next) => {
    c.set("userId", userId);
    await next();
  };
}

function timeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: "entry_1",
    userId: OWNER_ID,
    categoryId: CATEGORY_ID,
    name: "資料作成",
    date: "2026-07-29",
    plannedStartAt: null,
    plannedDurationMinutes: 30,
    startedAt: new Date("2026-07-29T10:00:00.000Z"),
    endedAt: null,
    durationMinutes: null,
    breakStartedAt: null,
    totalBreakSeconds: 0,
    status: "working",
    memo: null,
    deviationFocused: null,
    deviationReason: null,
    alarmEnabled: true,
    alarmFiredAt: null,
    breakExtendsDeadline: true,
    createdAt: new Date("2026-07-29T10:00:00.000Z"),
    updatedAt: new Date("2026-07-29T10:00:00.000Z"),
    ...overrides,
  };
}

function category(overrides: Partial<Category> = {}): Category {
  return {
    id: CATEGORY_ID,
    userId: OWNER_ID,
    name: "仕事",
    color: "#3b82f6",
    isActive: true,
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

/** テスト用のインメモリ TimeEntryStore。実DBに繋がずルートの挙動だけを検証する。 */
function createFakeStore(
  initial: TimeEntry[] = [],
  options: { breakExtendsDeadline?: boolean } = {},
): TimeEntryStore {
  const rows = new Map(initial.map((e) => [e.id, e]));

  return {
    async findCurrent(userId) {
      return [...rows.values()].find((r) => r.userId === userId && r.status !== "completed");
    },
    async findById(id) {
      return rows.get(id);
    },
    async insert(row: NewTimeEntry) {
      const isActive = (r: TimeEntry) => r.userId === row.userId && r.status !== "completed";
      if ([...rows.values()].some(isActive)) {
        throw new ActiveTimeEntryConflictError("既に進行中の記録があります");
      }
      const created: TimeEntry = {
        id: row.id,
        userId: row.userId,
        categoryId: row.categoryId,
        name: row.name ?? null,
        date: row.date,
        plannedStartAt: row.plannedStartAt ?? null,
        plannedDurationMinutes: row.plannedDurationMinutes ?? null,
        startedAt: row.startedAt,
        endedAt: row.endedAt ?? null,
        durationMinutes: row.durationMinutes ?? null,
        breakStartedAt: row.breakStartedAt ?? null,
        totalBreakSeconds: row.totalBreakSeconds ?? 0,
        status: row.status ?? "working",
        memo: row.memo ?? null,
        deviationFocused: row.deviationFocused ?? null,
        deviationReason: row.deviationReason ?? null,
        alarmEnabled: row.alarmEnabled ?? true,
        alarmFiredAt: row.alarmFiredAt ?? null,
        breakExtendsDeadline: row.breakExtendsDeadline ?? true,
        createdAt: row.createdAt ?? new Date(),
        updatedAt: row.updatedAt ?? new Date(),
      };
      rows.set(created.id, created);
      return created;
    },
    async startBreak(id, breakStartedAt) {
      const existing = rows.get(id);
      if (!existing || existing.status !== "working") return undefined;
      const updated = { ...existing, status: "on_break" as const, breakStartedAt };
      rows.set(id, updated);
      return updated;
    },
    async resume(id, totalBreakSeconds) {
      const existing = rows.get(id);
      if (!existing || existing.status !== "on_break") return undefined;
      const updated = {
        ...existing,
        status: "working" as const,
        breakStartedAt: null,
        totalBreakSeconds,
      };
      rows.set(id, updated);
      return updated;
    },
    async end(id, patch) {
      const existing = rows.get(id);
      if (!existing || existing.status === "completed") return undefined;
      const updated = { ...existing, status: "completed" as const, breakStartedAt: null, ...patch };
      rows.set(id, updated);
      return updated;
    },
    async listCompletedToday(userId, date) {
      return [...rows.values()]
        .filter((r) => r.userId === userId && r.status === "completed" && r.date === date)
        .map((r) => ({ ...r, category: category({ id: r.categoryId }) }));
    },
    async getBreakExtendsDeadline() {
      return options.breakExtendsDeadline ?? true;
    },
  };
}

/** テスト用のインメモリ CategoryStore。POST時のカテゴリ存在確認だけに使う。 */
function createFakeCategoryStore(initial: Category[] = []): CategoryStore {
  const rows = new Map(initial.map((c) => [c.id, c]));
  return {
    async listVisible() {
      return [...rows.values()];
    },
    async findById(id) {
      return rows.get(id);
    },
    async insert() {
      throw new Error("not used in this test");
    },
    async update() {
      throw new Error("not used in this test");
    },
    async softDelete() {
      throw new Error("not used in this test");
    },
  };
}

function buildApp(
  entries: TimeEntry[],
  categories: Category[],
  userId: string,
  options: { breakExtendsDeadline?: boolean; now?: Date } = {},
) {
  const store = createFakeStore(entries, options);
  const categoryStore = createFakeCategoryStore(categories);
  const app = createTimeEntriesRoutes(
    () => store,
    () => categoryStore,
    asUser(userId),
    () => options.now ?? FIXED_NOW,
  );
  return { app, store };
}

describe("GET /current", () => {
  test("進行中の記録を返す", async () => {
    const { app } = buildApp([timeEntry({ id: "entry_1" })], [category()], OWNER_ID);

    const res = await app.request("/current");
    const body = (await res.json()) as TimeEntry;

    expect(res.status).toBe(200);
    expect(body.id).toBe("entry_1");
  });

  test("進行中の記録が無ければ null を返す", async () => {
    const { app } = buildApp([], [category()], OWNER_ID);

    const res = await app.request("/current");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toBeNull();
  });

  test("他人の進行中の記録は返さない", async () => {
    const { app } = buildApp(
      [timeEntry({ id: "other", userId: OTHER_USER_ID })],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/current");
    const body = await res.json();

    expect(body).toBeNull();
  });
});

describe("GET /today", () => {
  test("今日の完了分のみ返す", async () => {
    const { app } = buildApp(
      [
        timeEntry({ id: "done_today", status: "completed", date: "2026-07-29" }),
        timeEntry({ id: "done_yesterday", status: "completed", date: "2026-07-28" }),
        timeEntry({ id: "working", status: "working", date: "2026-07-29" }),
      ],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/today");
    const body = (await res.json()) as TimeEntry[];

    expect(body.map((e) => e.id)).toEqual(["done_today"]);
  });

  test("他人の完了分は含まない", async () => {
    const { app } = buildApp(
      [
        timeEntry({
          id: "other_done",
          userId: OTHER_USER_ID,
          status: "completed",
          date: "2026-07-29",
        }),
      ],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/today");
    const body = (await res.json()) as TimeEntry[];

    expect(body).toEqual([]);
  });
});

describe("POST /", () => {
  test("正しい入力で開始できる", async () => {
    const { app, store } = buildApp([], [category()], OWNER_ID);

    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "資料作成",
        categoryId: CATEGORY_ID,
        plannedDurationMinutes: 30,
      }),
    });
    const body = (await res.json()) as TimeEntry;

    expect(res.status).toBe(201);
    expect(body.status).toBe("working");
    expect(body.userId).toBe(OWNER_ID);
    expect((body as unknown as Record<string, unknown>).startedAt).toBe(FIXED_NOW.toISOString());
    expect(await store.findById(body.id)).toBeTruthy();
  });

  test("name を省略しても開始できる（タスク名は任意）", async () => {
    const { app } = buildApp([], [category()], OWNER_ID);

    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId: CATEGORY_ID }),
    });

    expect(res.status).toBe(201);
  });

  test("開始時点の user_settings.break_extends_deadline をスナップショットする", async () => {
    const { app } = buildApp([], [category()], OWNER_ID, { breakExtendsDeadline: false });

    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId: CATEGORY_ID }),
    });
    const body = (await res.json()) as TimeEntry;

    expect(body.breakExtendsDeadline).toBe(false);
  });

  test("categoryId が無ければ400", async () => {
    const { app } = buildApp([], [category()], OWNER_ID);

    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "資料作成" }),
    });

    expect(res.status).toBe(400);
  });

  test("name が空文字なら400", async () => {
    const { app } = buildApp([], [category()], OWNER_ID);

    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "", categoryId: CATEGORY_ID }),
    });

    expect(res.status).toBe(400);
  });

  test("plannedDurationMinutes が負の値なら400", async () => {
    const { app } = buildApp([], [category()], OWNER_ID);

    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId: CATEGORY_ID, plannedDurationMinutes: -1 }),
    });

    expect(res.status).toBe(400);
  });

  test("存在しないcategoryIdなら400", async () => {
    const { app } = buildApp([], [category()], OWNER_ID);

    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId: "missing" }),
    });

    expect(res.status).toBe(400);
  });

  test("他人の非共通カテゴリは使用できない（400）", async () => {
    const { app } = buildApp([], [category({ id: "other_cat", userId: OTHER_USER_ID })], OWNER_ID);

    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId: "other_cat" }),
    });

    expect(res.status).toBe(400);
  });

  test("共通カテゴリ（userId が null）は使用できる", async () => {
    const { app } = buildApp([], [category({ id: "common", userId: null })], OWNER_ID);

    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId: "common" }),
    });

    expect(res.status).toBe(201);
  });

  test("既に進行中の記録がある場合は409（2件目は作れない）", async () => {
    const { app } = buildApp([timeEntry({ id: "existing" })], [category()], OWNER_ID);

    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId: CATEGORY_ID }),
    });

    expect(res.status).toBe(409);
  });

  test("ストアがActiveTimeEntryConflictErrorを投げた場合も409（事前チェックとinsertの間のレース対策）", async () => {
    const store = createFakeStore([], {});
    const racyStore: TimeEntryStore = {
      ...store,
      insert: async () => {
        throw new ActiveTimeEntryConflictError("race");
      },
    };
    const categoryStore = createFakeCategoryStore([category()]);
    const app = createTimeEntriesRoutes(
      () => racyStore,
      () => categoryStore,
      asUser(OWNER_ID),
      () => FIXED_NOW,
    );

    const res = await app.request("/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryId: CATEGORY_ID }),
    });

    expect(res.status).toBe(409);
  });
});

describe("PATCH /:id/break", () => {
  test("working状態なら休憩開始できる", async () => {
    const { app } = buildApp(
      [timeEntry({ id: "entry_1", status: "working" })],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/entry_1/break", { method: "PATCH" });
    const body = (await res.json()) as TimeEntry;

    expect(res.status).toBe(200);
    expect(body.status).toBe("on_break");
    expect((body as unknown as Record<string, unknown>).breakStartedAt).toBe(
      FIXED_NOW.toISOString(),
    );
  });

  test("他人の記録は更新できない（403）", async () => {
    const { app } = buildApp(
      [timeEntry({ id: "other", userId: OTHER_USER_ID })],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/other/break", { method: "PATCH" });

    expect(res.status).toBe(403);
  });

  test("存在しないIDは404", async () => {
    const { app } = buildApp([], [category()], OWNER_ID);

    const res = await app.request("/missing/break", { method: "PATCH" });

    expect(res.status).toBe(404);
  });

  test("既に休憩中の記録は409", async () => {
    const { app } = buildApp(
      [timeEntry({ id: "entry_1", status: "on_break", breakStartedAt: new Date() })],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/entry_1/break", { method: "PATCH" });

    expect(res.status).toBe(409);
  });
});

describe("PATCH /:id/resume", () => {
  test("休憩から再開でき、totalBreakSecondsが正しく累積される", async () => {
    const { app } = buildApp(
      [
        timeEntry({
          id: "entry_1",
          status: "on_break",
          breakStartedAt: new Date("2026-07-29T10:20:00.000Z"), // FIXED_NOWの10分前
          totalBreakSeconds: 60,
        }),
      ],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/entry_1/resume", { method: "PATCH" });
    const body = (await res.json()) as TimeEntry;

    expect(res.status).toBe(200);
    expect(body.status).toBe("working");
    expect(body.breakStartedAt).toBeNull();
    expect(body.totalBreakSeconds).toBe(660); // 60 + 600
  });

  test("working状態の記録は409（休憩中ではない）", async () => {
    const { app } = buildApp(
      [timeEntry({ id: "entry_1", status: "working" })],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/entry_1/resume", { method: "PATCH" });

    expect(res.status).toBe(409);
  });

  test("他人の記録は更新できない（403）", async () => {
    const { app } = buildApp(
      [
        timeEntry({
          id: "other",
          userId: OTHER_USER_ID,
          status: "on_break",
          breakStartedAt: new Date(),
        }),
      ],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/other/resume", { method: "PATCH" });

    expect(res.status).toBe(403);
  });

  test("存在しないIDは404", async () => {
    const { app } = buildApp([], [category()], OWNER_ID);

    const res = await app.request("/missing/resume", { method: "PATCH" });

    expect(res.status).toBe(404);
  });
});

describe("PATCH /:id/end", () => {
  test("working状態から終了でき、実績時間が計算される", async () => {
    const { app } = buildApp(
      [
        timeEntry({
          id: "entry_1",
          status: "working",
          startedAt: new Date("2026-07-29T10:00:00.000Z"), // FIXED_NOWまで30分
          totalBreakSeconds: 300, // 5分
        }),
      ],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/entry_1/end", { method: "PATCH" });
    const body = (await res.json()) as TimeEntry;

    expect(res.status).toBe(200);
    expect(body.status).toBe("completed");
    expect(body.durationMinutes).toBe(25); // 30分 - 5分
    expect((body as unknown as Record<string, unknown>).endedAt).toBe(FIXED_NOW.toISOString());
  });

  test("休憩中に終了すると、今回の休憩分も差し引かれる", async () => {
    const { app } = buildApp(
      [
        timeEntry({
          id: "entry_1",
          status: "on_break",
          startedAt: new Date("2026-07-29T10:00:00.000Z"), // FIXED_NOWまで30分
          breakStartedAt: new Date("2026-07-29T10:25:00.000Z"), // FIXED_NOWまで5分休憩中
          totalBreakSeconds: 0,
        }),
      ],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/entry_1/end", { method: "PATCH" });
    const body = (await res.json()) as TimeEntry;

    expect(body.durationMinutes).toBe(25); // 30分 - 5分（休憩中だった分）
    expect(body.breakStartedAt).toBeNull();
    expect(body.totalBreakSeconds).toBe(300);
  });

  test("乖離理由（reason）を受け取れる", async () => {
    const { app } = buildApp(
      [timeEntry({ id: "entry_1", status: "working" })],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/entry_1/end", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "会議が延びた" }),
    });
    const body = (await res.json()) as TimeEntry;

    expect(body.deviationReason).toBe("会議が延びた");
  });

  test("reasonを省略しても終了できる（任意項目）", async () => {
    const { app } = buildApp(
      [timeEntry({ id: "entry_1", status: "working" })],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/entry_1/end", { method: "PATCH" });

    expect(res.status).toBe(200);
  });

  test("reasonが文字列以外なら400", async () => {
    const { app } = buildApp(
      [timeEntry({ id: "entry_1", status: "working" })],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/entry_1/end", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: 123 }),
    });

    expect(res.status).toBe(400);
  });

  test("既に終了している記録は409", async () => {
    const { app } = buildApp(
      [timeEntry({ id: "entry_1", status: "completed" })],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/entry_1/end", { method: "PATCH" });

    expect(res.status).toBe(409);
  });

  test("他人の記録は更新できない（403）", async () => {
    const { app } = buildApp(
      [timeEntry({ id: "other", userId: OTHER_USER_ID, status: "working" })],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/other/end", { method: "PATCH" });

    expect(res.status).toBe(403);
  });

  test("存在しないIDは404", async () => {
    const { app } = buildApp([], [category()], OWNER_ID);

    const res = await app.request("/missing/end", { method: "PATCH" });

    expect(res.status).toBe(404);
  });

  test("レスポンスに passwordHash 等の機密情報が含まれない", async () => {
    const { app } = buildApp(
      [timeEntry({ id: "entry_1", status: "working" })],
      [category()],
      OWNER_ID,
    );

    const res = await app.request("/entry_1/end", { method: "PATCH" });
    const body = (await res.json()) as Record<string, unknown>;

    expect(body).not.toHaveProperty("passwordHash");
    expect(body).not.toHaveProperty("password");
  });
});

describe("store が例外を投げたとき", () => {
  test("500 を { error } 形式で返す（DB接続断など、想定外の失敗を想定）", async () => {
    const store = createFakeStore([timeEntry({ id: "entry_1", status: "working" })]);
    const brokenStore: TimeEntryStore = {
      ...store,
      startBreak: async () => {
        throw new Error("boom");
      },
    };
    const categoryStore = createFakeCategoryStore([category()]);
    const app = createTimeEntriesRoutes(
      () => brokenStore,
      () => categoryStore,
      asUser(OWNER_ID),
      () => FIXED_NOW,
    );

    const res = await app.request("/entry_1/break", { method: "PATCH" });
    const body = (await res.json()) as { error: string };

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal Server Error");
  });
});

describe("findById〜更新の間に別リクエストが先に状態を変えた場合（レース対策）", () => {
  test("break: startBreakがundefinedを返したら409", async () => {
    const store = createFakeStore([timeEntry({ id: "entry_1", status: "working" })]);
    const racyStore: TimeEntryStore = { ...store, startBreak: async () => undefined };
    const categoryStore = createFakeCategoryStore([category()]);
    const app = createTimeEntriesRoutes(
      () => racyStore,
      () => categoryStore,
      asUser(OWNER_ID),
      () => FIXED_NOW,
    );

    const res = await app.request("/entry_1/break", { method: "PATCH" });

    expect(res.status).toBe(409);
  });

  test("resume: resumeがundefinedを返したら409", async () => {
    const store = createFakeStore([
      timeEntry({ id: "entry_1", status: "on_break", breakStartedAt: new Date() }),
    ]);
    const racyStore: TimeEntryStore = { ...store, resume: async () => undefined };
    const categoryStore = createFakeCategoryStore([category()]);
    const app = createTimeEntriesRoutes(
      () => racyStore,
      () => categoryStore,
      asUser(OWNER_ID),
      () => FIXED_NOW,
    );

    const res = await app.request("/entry_1/resume", { method: "PATCH" });

    expect(res.status).toBe(409);
  });

  test("end: endがundefinedを返したら409", async () => {
    const store = createFakeStore([timeEntry({ id: "entry_1", status: "working" })]);
    const racyStore: TimeEntryStore = { ...store, end: async () => undefined };
    const categoryStore = createFakeCategoryStore([category()]);
    const app = createTimeEntriesRoutes(
      () => racyStore,
      () => categoryStore,
      asUser(OWNER_ID),
      () => FIXED_NOW,
    );

    const res = await app.request("/entry_1/end", { method: "PATCH" });

    expect(res.status).toBe(409);
  });
});
