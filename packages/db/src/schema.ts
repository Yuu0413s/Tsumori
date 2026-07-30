import { relations, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  date,
  boolean,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ==================== Auth.js 旧スキーマ（複数形テーブル） ====================
// better-auth への移行が完了するまでの間、実データを保持したまま残す。
// 撤去は Issue #21（旧テーブル・旧環境を撤去する）で行う。

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { mode: "date" }).$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at", { mode: "date" }).$defaultFn(() => new Date()),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// ==================== better-auth コアスキーマ（新規） ====================
// `npx @better-auth/cli generate` (better-auth@1.6.25) の出力をそのまま採用。
// テーブル名・カラム名は better-auth のデフォルト規約に合わせており、
// 独自に変更すると Issue #6 でのアダプタ接続時にズレるため変更しない。
// パスワード認証は使わない（Googleログインのみ）ため、
// account.password は常に NULL のまま運用する想定。

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// ==================== アプリケーション固有テーブル（既存の移植） ====================
// categories.userId は better-auth の user（Google認証）を参照する。
// Issue #7の移行スクリプトは user.id に旧 users.id をそのまま引き継ぐため、
// 移行済みユーザーの値は変わらないが、Issue #6以降にGoogleログインした
// 新規ユーザーは旧 users に対応行が無く、旧テーブル参照のままだと
// カテゴリ作成時にFK違反になっていた（Issue #8 Codexレビュー対応）。

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).$defaultFn(() => new Date()),
});

export const timeEntries = pgTable(
  "time_entries",
  {
    id: text("id").primaryKey(),
    // categories.userId と同じ理由（Issue #8）で、旧 users ではなく
    // better-auth の user を参照する（Issue #9 で付け替え）。
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    name: text("name"),
    // 元は text（UTC基準の YYYY-MM-DD）だった。日付比較・タイムゾーン処理のため
    // ネイティブ date 型に変更。既存値はテキストのままキャストして引き継ぐ
    // （UTC基準で計算されていた過去分の値自体は今回は補正しない）。
    //
    // マイグレーション適用前チェック（実施済み・再実施する場合は同じSQLを使う）：
    //   旧アプリは date を toISOString().split("T")[0] でのみ書き込んでおり、
    //   ユーザー入力や他経路で不正な値が入る余地が無いことをコードで確認済み。
    //   その上で、以下のSQLで本番の全件が YYYY-MM-DD 形式であることも確認している。
    //     SELECT id, date FROM time_entries WHERE date !~ '^\d{4}-\d{2}-\d{2}$';
    //   → 今後、型変更を伴うマイグレーションを書くときは、適用前に必ずこの形で
    //     対象カラムを全件検証すること（0003_condemned_sasquatch.sql の
    //     ALTER COLUMN ... USING "date"::date はこの確認の上で適用済み）。
    date: date("date", { mode: "string" }).notNull(),
    plannedStartAt: timestamp("planned_start_at", { mode: "date" }),
    plannedDurationMinutes: integer("planned_duration_minutes"),
    startedAt: timestamp("started_at", { mode: "date" }).notNull(),
    endedAt: timestamp("ended_at", { mode: "date" }),
    durationMinutes: integer("duration_minutes"),
    breakStartedAt: timestamp("break_started_at", { mode: "date" }),
    totalBreakSeconds: integer("total_break_seconds").notNull().default(0),
    status: text("status", { enum: ["working", "on_break", "completed"] })
      .notNull()
      .default("working"),
    memo: text("memo"),
    deviationFocused: boolean("deviation_focused"),
    deviationReason: text("deviation_reason"),
    // アラーム機能（新規）
    alarmEnabled: boolean("alarm_enabled").notNull().default(true),
    alarmFiredAt: timestamp("alarm_fired_at", { mode: "date" }),
    // 開始時点の設定値のスナップショット。あとで設定を変えても
    // 進行中タスクの締切には影響させないための保持。
    breakExtendsDeadline: boolean("break_extends_deadline").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).$defaultFn(() => new Date()),
    updatedAt: timestamp("updated_at", { mode: "date" }).$defaultFn(() => new Date()),
  },
  // 「同時に1件しか進行中を持てない」（Issue #9）をDB制約でも保証する。
  // アプリ側の事前チェックだけだと、開始リクエストが同時に来た場合に
  // チェックと INSERT の間で競合し、2件の進行中エントリができてしまう
  // （TOCTOU。categories#8 で指摘された種類のレースと同種）。
  // 部分ユニークインデックスにすることで、競合時は2件目の INSERT が
  // DBレベルで拒否される。
  (table) => [
    uniqueIndex("time_entries_one_active_per_user_idx")
      .on(table.userId)
      .where(sql`${table.status} <> 'completed'`),
    // GET /today（ユーザー・当日・完了済みで絞り込みstartedAt降順）専用のインデックス。
    // 上の部分ユニークインデックスは status <> 'completed' 側にしか効かないため、
    // 完了済みの絞り込みにはこちらが必要（Codexレビュー対応）。
    index("time_entries_user_date_completed_started_idx")
      .on(table.userId, table.date, table.startedAt)
      .where(sql`${table.status} = 'completed'`),
  ],
);

// ==================== アラーム機能 新規テーブル ====================
// userId は新しい `user`（better-auth）を参照する。categories/time_entries と
// 参照先が食い違うが、これらは better-auth 移行（Issue #6/#7）完了後に
// 使われ始める想定のため、意図的にこうしている。
// Issue #7 より前にこのテーブルを使うコードを書かないこと。

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  // アラーム送信時に「ユーザーの全端末」を引く想定のため
  (table) => [index("push_subscriptions_userId_idx").on(table.userId)],
);

export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  breakExtendsDeadline: boolean("break_extends_deadline").notNull().default(true),
  soundEnabled: boolean("sound_enabled").notNull().default(true),
  // Issue #10 の決定済み仕様：null は「予告しない」を意味する有効値のため、
  // NOT NULL にしない（元は仮のNOT NULL DEFAULT 5だったが、実装に合わせて修正）。
  preAlarmMinutes: integer("pre_alarm_minutes"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ==================== リレーション（アプリケーション固有） ====================

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(user, {
    fields: [categories.userId],
    references: [user.id],
  }),
  timeEntries: many(timeEntries),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  // userId カラム自体は better-auth の user を参照する（Issue #9）。
  // relation 側もそれに合わせる（Codexレビュー対応：ここだけ旧 users のままだった）。
  user: one(user, {
    fields: [timeEntries.userId],
    references: [user.id],
  }),
  category: one(categories, {
    fields: [timeEntries.categoryId],
    references: [categories.id],
  }),
}));

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(user, {
    fields: [pushSubscriptions.userId],
    references: [user.id],
  }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(user, {
    fields: [userSettings.userId],
    references: [user.id],
  }),
}));

// ==================== 型エクスポート ====================

// users（Auth.js 旧テーブル）と user（better-auth 新テーブル）が同居しているため、
// `User` 単体だとどちらを指すか紛らわしい。旧側には Legacy を付けて区別する。
export type LegacyUser = typeof users.$inferSelect;
export type NewLegacyUser = typeof users.$inferInsert;
export type AuthUser = typeof user.$inferSelect;
export type NewAuthUser = typeof user.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;

export type TimeEntryWithCategory = TimeEntry & {
  category: Category;
};
