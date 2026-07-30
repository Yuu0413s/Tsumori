import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import type { TimeEntryStore, CategoryStore, NewTimeEntry } from "@tsumori/db";
import { ActiveTimeEntryConflictError } from "@tsumori/db";
import {
  isValidTimeEntryName,
  isValidPlannedDurationMinutes,
  canModifyTimeEntry,
  canUseCategory,
  calcActualDurationMinutes,
  accumulateBreakSeconds,
  toUtcDateString,
} from "@tsumori/core";
import type { AuthVariables } from "../middleware/require-auth.js";
import type { Bindings } from "../env.js";

type Env = { Bindings: Bindings; Variables: AuthVariables };

type GetStore = (c: Context<Env>) => TimeEntryStore;
type GetCategoryStore = (c: Context<Env>) => CategoryStore;

function readBody(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * DBアクセス・認証ミドルウェアの注入は categories.ts（Issue #8）と同じ狙い。
 * 加えて `now` も注入可能にし、開始/休憩/再開/終了の時刻計算をテストで
 * 決定的に検証できるようにしている（Issue #9）。
 */
export function createTimeEntriesRoutes(
  getStore: GetStore,
  getCategoryStore: GetCategoryStore,
  authMiddleware: MiddlewareHandler<Env>,
  now: () => Date = () => new Date(),
) {
  return new Hono<Env>()
    .onError((err, c) => {
      console.error("time-entries route error", err);
      return c.json({ error: "Internal Server Error" }, 500);
    })
    .use("*", authMiddleware)
    .get("/current", async (c) => {
      const store = getStore(c);
      const entry = await store.findCurrent(c.get("userId"));
      return c.json(entry ?? null);
    })
    .get("/today", async (c) => {
      const store = getStore(c);
      const date = toUtcDateString(now());
      const rows = await store.listCompletedToday(c.get("userId"), date);
      return c.json(rows);
    })
    .post("/", async (c) => {
      const userId = c.get("userId");
      const body = readBody(await c.req.json().catch(() => null));
      const { name, categoryId, plannedDurationMinutes } = body;

      if (typeof categoryId !== "string" || categoryId.length === 0) {
        return c.json({ error: "categoryId は必須です" }, 400);
      }
      if (!isValidTimeEntryName(name)) {
        return c.json({ error: "name は1〜200文字の文字列で指定してください" }, 400);
      }
      if (!isValidPlannedDurationMinutes(plannedDurationMinutes)) {
        return c.json({ error: "plannedDurationMinutes は0以上の整数で指定してください" }, 400);
      }

      const categoryStore = getCategoryStore(c);
      const category = await categoryStore.findById(categoryId);
      if (!category || !category.isActive || !canUseCategory(category.userId, userId)) {
        return c.json({ error: "指定されたカテゴリが見つかりません" }, 400);
      }

      const store = getStore(c);
      // 開始時にサーバー側でチェックする（Issue #9 技術メモ）。
      // ただしここから insert までの間に別リクエストが先に開始する可能性は残るため、
      // 最終的な二重防止は DB の部分ユニークインデックスに委ねる（下の catch）。
      const current = await store.findCurrent(userId);
      if (current) {
        return c.json({ error: "既に進行中の記録があります" }, 409);
      }

      const breakExtendsDeadline = await store.getBreakExtendsDeadline(userId);
      const startedAt = now();
      const row: NewTimeEntry = {
        id: crypto.randomUUID(),
        userId,
        categoryId,
        date: toUtcDateString(startedAt),
        startedAt,
        status: "working",
        totalBreakSeconds: 0,
        breakExtendsDeadline,
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(plannedDurationMinutes !== undefined ? { plannedDurationMinutes } : {}),
      };

      try {
        const created = await store.insert(row);
        return c.json(created, 201);
      } catch (error) {
        if (error instanceof ActiveTimeEntryConflictError) {
          return c.json({ error: "既に進行中の記録があります" }, 409);
        }
        throw error;
      }
    })
    .patch("/:id/break", async (c) => {
      const id = c.req.param("id");
      const userId = c.get("userId");
      const store = getStore(c);
      const existing = await store.findById(id);
      if (!existing) return c.json({ error: "Not Found" }, 404);
      if (!canModifyTimeEntry(existing.userId, userId)) {
        return c.json({ error: "Forbidden" }, 403);
      }
      if (existing.status !== "working") {
        return c.json({ error: "進行中の記録ではありません" }, 409);
      }

      const updated = await store.startBreak(id, now());
      // findById〜ここまでの間に別リクエストが先に状態を変えた場合のレース対策
      // （categories#8と同じ理由）。
      if (!updated) return c.json({ error: "進行中の記録ではありません" }, 409);
      return c.json(updated);
    })
    .patch("/:id/resume", async (c) => {
      const id = c.req.param("id");
      const userId = c.get("userId");
      const store = getStore(c);
      const existing = await store.findById(id);
      if (!existing) return c.json({ error: "Not Found" }, 404);
      if (!canModifyTimeEntry(existing.userId, userId)) {
        return c.json({ error: "Forbidden" }, 403);
      }
      if (existing.status !== "on_break" || existing.breakStartedAt === null) {
        return c.json({ error: "休憩中の記録ではありません" }, 409);
      }

      const totalBreakSeconds = accumulateBreakSeconds(
        existing.breakStartedAt,
        now(),
        existing.totalBreakSeconds,
      );
      const updated = await store.resume(id, totalBreakSeconds);
      if (!updated) return c.json({ error: "休憩中の記録ではありません" }, 409);
      return c.json(updated);
    })
    .patch("/:id/end", async (c) => {
      const id = c.req.param("id");
      const userId = c.get("userId");
      const store = getStore(c);
      const existing = await store.findById(id);
      if (!existing) return c.json({ error: "Not Found" }, 404);
      if (!canModifyTimeEntry(existing.userId, userId)) {
        return c.json({ error: "Forbidden" }, 403);
      }
      if (existing.status === "completed") {
        return c.json({ error: "既に終了しています" }, 409);
      }

      const body = readBody(await c.req.json().catch(() => null));
      const { reason } = body;
      if (reason !== undefined && typeof reason !== "string") {
        return c.json({ error: "reason は文字列で指定してください" }, 400);
      }

      const endedAt = now();
      // 休憩中に終了した場合、締めていない今回の休憩分もここで確定させる
      // （実績時間 = 経過時間 − 累積休憩時間。Issue #9 技術メモ）。
      const totalBreakSeconds =
        existing.status === "on_break" && existing.breakStartedAt !== null
          ? accumulateBreakSeconds(existing.breakStartedAt, endedAt, existing.totalBreakSeconds)
          : existing.totalBreakSeconds;
      const durationMinutes = calcActualDurationMinutes(
        existing.startedAt,
        endedAt,
        totalBreakSeconds,
      );

      const updated = await store.end(id, {
        endedAt,
        durationMinutes,
        totalBreakSeconds,
        deviationReason: reason ?? null,
      });
      if (!updated) return c.json({ error: "既に終了しています" }, 409);
      return c.json(updated);
    });
}
