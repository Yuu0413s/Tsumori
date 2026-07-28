// Issue #2 で既存スキーマ（users / categories / time_entries 等）を移植する。
// ここは配線確認用の最小定義のみ。
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const healthcheck = pgTable("healthcheck", {
  id: text("id").primaryKey(),
  checkedAt: timestamp("checked_at", { mode: "date" }).notNull().defaultNow(),
});

export type Healthcheck = typeof healthcheck.$inferSelect;
