import { eq, and, ne, desc } from "drizzle-orm";
import {
  timeEntries,
  userSettings,
  type TimeEntry,
  type NewTimeEntry,
  type TimeEntryWithCategory,
} from "./schema.js";
import type { Database } from "./index.js";

/**
 * 「同時に1件しか進行中を持てない」制約（time_entries_one_active_per_user_idx）
 * への違反を、呼び出し側（ルート）が409として扱えるように区別する（Issue #9）。
 * ルート側の事前チェック（findCurrent）はTOCTOUレースを完全には防げないため、
 * 最終的な保証はDBの部分ユニークインデックスに委ねている。
 */
export class ActiveTimeEntryConflictError extends Error {}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

export interface TimeEntryStore {
  findCurrent(userId: string): Promise<TimeEntry | undefined>;
  findById(id: string): Promise<TimeEntry | undefined>;
  insert(row: NewTimeEntry): Promise<TimeEntry>;
  startBreak(id: string, breakStartedAt: Date): Promise<TimeEntry | undefined>;
  resume(id: string, totalBreakSeconds: number): Promise<TimeEntry | undefined>;
  end(
    id: string,
    patch: {
      endedAt: Date;
      durationMinutes: number;
      totalBreakSeconds: number;
      deviationReason: string | null;
    },
  ): Promise<TimeEntry | undefined>;
  listCompletedToday(userId: string, date: string): Promise<TimeEntryWithCategory[]>;
  getBreakExtendsDeadline(userId: string): Promise<boolean>;
}

export function createTimeEntryStore(db: Database): TimeEntryStore {
  return {
    async findCurrent(userId) {
      const [row] = await db
        .select()
        .from(timeEntries)
        .where(and(eq(timeEntries.userId, userId), ne(timeEntries.status, "completed")))
        .limit(1);
      return row;
    },

    async findById(id) {
      const [row] = await db.select().from(timeEntries).where(eq(timeEntries.id, id));
      return row;
    },

    async insert(row) {
      try {
        const [created] = await db.insert(timeEntries).values(row).returning();
        if (!created) throw new Error("作業記録の作成に失敗しました");
        return created;
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ActiveTimeEntryConflictError("既に進行中の記録があります");
        }
        throw error;
      }
    },

    // WHERE に status='working' を含めることで、findById直後に別リクエストが
    // 先に状態を変えた場合でも二重に休憩開始できない（categories#8と同じレース対策）。
    async startBreak(id, breakStartedAt) {
      const [updated] = await db
        .update(timeEntries)
        .set({ status: "on_break", breakStartedAt, updatedAt: new Date() })
        .where(and(eq(timeEntries.id, id), eq(timeEntries.status, "working")))
        .returning();
      return updated;
    },

    async resume(id, totalBreakSeconds) {
      const [updated] = await db
        .update(timeEntries)
        .set({
          status: "working",
          breakStartedAt: null,
          totalBreakSeconds,
          updatedAt: new Date(),
        })
        .where(and(eq(timeEntries.id, id), eq(timeEntries.status, "on_break")))
        .returning();
      return updated;
    },

    async end(id, patch) {
      const [updated] = await db
        .update(timeEntries)
        .set({
          status: "completed",
          endedAt: patch.endedAt,
          durationMinutes: patch.durationMinutes,
          totalBreakSeconds: patch.totalBreakSeconds,
          breakStartedAt: null,
          deviationReason: patch.deviationReason,
          updatedAt: new Date(),
        })
        .where(and(eq(timeEntries.id, id), ne(timeEntries.status, "completed")))
        .returning();
      return updated;
    },

    async listCompletedToday(userId, date) {
      return db.query.timeEntries.findMany({
        where: and(
          eq(timeEntries.userId, userId),
          eq(timeEntries.status, "completed"),
          eq(timeEntries.date, date),
        ),
        with: { category: true },
        orderBy: desc(timeEntries.startedAt),
      });
    },

    // 設定行が無いユーザー（未設定）は user_settings.break_extends_deadline の
    // カラムデフォルト（true）に揃える（Issue #9）。
    async getBreakExtendsDeadline(userId) {
      const [row] = await db
        .select({ value: userSettings.breakExtendsDeadline })
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
      return row?.value ?? true;
    },
  };
}
