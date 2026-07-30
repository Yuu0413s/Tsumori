import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import type { UserSettingsStore, SettingsPatch } from "@tsumori/db";
import {
  isValidBreakExtendsDeadline,
  isValidSoundEnabled,
  isValidPreAlarmMinutes,
} from "@tsumori/core";
import type { AuthVariables } from "../middleware/require-auth.js";
import type { Bindings } from "../env.js";

type Env = { Bindings: Bindings; Variables: AuthVariables };

type GetStore = (c: Context<Env>) => UserSettingsStore;

function readBody(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * DBアクセス・認証ミドルウェアの注入は categories.ts / time-entries.ts（Issue #8, #9）と同じ狙い。
 *
 * PATCH は既に進行中の time_entries には一切触れない設計にしている。
 * time_entries.break_extends_deadline は開始時点のスナップショットとして
 * 別カラムに保持されており（Issue #9）、このルートが user_settings しか
 * 更新しないことで「設定変更が進行中の記録に影響しない」を構造的に保証する（Issue #10）。
 */
export function createSettingsRoutes(getStore: GetStore, authMiddleware: MiddlewareHandler<Env>) {
  return new Hono<Env>()
    .onError((err, c) => {
      console.error("settings route error", err);
      return c.json({ error: "Internal Server Error" }, 500);
    })
    .use("*", authMiddleware)
    .get("/", async (c) => {
      const store = getStore(c);
      const settings = await store.getOrCreate(c.get("userId"));
      return c.json(settings);
    })
    .patch("/", async (c) => {
      const userId = c.get("userId");
      const body = readBody(await c.req.json().catch(() => null));
      const patch: SettingsPatch = {};

      if ("breakExtendsDeadline" in body) {
        if (!isValidBreakExtendsDeadline(body.breakExtendsDeadline)) {
          return c.json({ error: "breakExtendsDeadline は真偽値で指定してください" }, 400);
        }
        patch.breakExtendsDeadline = body.breakExtendsDeadline;
      }
      if ("soundEnabled" in body) {
        if (!isValidSoundEnabled(body.soundEnabled)) {
          return c.json({ error: "soundEnabled は真偽値で指定してください" }, 400);
        }
        patch.soundEnabled = body.soundEnabled;
      }
      if ("preAlarmMinutes" in body) {
        if (!isValidPreAlarmMinutes(body.preAlarmMinutes)) {
          return c.json(
            { error: "preAlarmMinutes は0〜1440の整数、またはnullで指定してください" },
            400,
          );
        }
        patch.preAlarmMinutes = body.preAlarmMinutes;
      }
      if (Object.keys(patch).length === 0) {
        return c.json({ error: "更新する項目がありません" }, 400);
      }

      const store = getStore(c);
      const updated = await store.update(userId, patch);
      return c.json(updated);
    });
}
