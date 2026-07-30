import { eq } from "drizzle-orm";
import { userSettings, type UserSettings } from "./schema.js";
import type { Database } from "./index.js";

// Issue #10 の決定済みデフォルト値。
const DEFAULT_SETTINGS = {
  breakExtendsDeadline: true,
  soundEnabled: true,
  preAlarmMinutes: null,
} as const;

export type SettingsPatch = Partial<
  Pick<UserSettings, "breakExtendsDeadline" | "soundEnabled" | "preAlarmMinutes">
>;

export interface UserSettingsStore {
  getOrCreate(userId: string): Promise<UserSettings>;
  update(userId: string, patch: SettingsPatch): Promise<UserSettings>;
}

export function createUserSettingsStore(db: Database): UserSettingsStore {
  return {
    // 行が無いユーザーでもエラーにせず、デフォルト値の行を作って返す（Issue #10 技術メモ）。
    async getOrCreate(userId) {
      const [existing] = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, userId));
      if (existing) return existing;

      // GET が同時に2回来た場合の競合はonConflictDoNothingで無視し、
      // その場合は改めて既存行を読み直す（categories/time-entriesと違い、
      // ここでの競合はどちらが勝っても同じデフォルト値になるため実害が無い）。
      const [created] = await db
        .insert(userSettings)
        .values({ userId, ...DEFAULT_SETTINGS })
        .onConflictDoNothing()
        .returning();
      if (created) return created;

      const [row] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
      if (!row) throw new Error("設定の取得に失敗しました");
      return row;
    },

    // 行が無いユーザーへのPATCHもupsertで受け止める（デフォルト値 + 指定分のpatchで新規作成）。
    async update(userId, patch) {
      const [updated] = await db
        .insert(userSettings)
        .values({ userId, ...DEFAULT_SETTINGS, ...patch })
        .onConflictDoUpdate({
          target: userSettings.userId,
          set: { ...patch, updatedAt: new Date() },
        })
        .returning();
      if (!updated) throw new Error("設定の更新に失敗しました");
      return updated;
    },
  };
}
