import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";
import type { CategoryStore, NewCategory } from "@tsumori/db";
import { isValidCategoryName, isValidCategoryColor, canModifyCategory } from "@tsumori/core";
import type { AuthVariables } from "../middleware/require-auth.js";
import type { Bindings } from "../env.js";

type Env = { Bindings: Bindings; Variables: AuthVariables };

type GetStore = (c: Context<Env>) => CategoryStore;

function readBody(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/**
 * DB アクセス（getStore）と認証ミドルウェアを外から注入できるようにしている。
 * requireAuth の getSession 注入（apps/api/src/middleware/require-auth.ts）と同じ狙いで、
 * 実DB・実better-authに繋がずオーナーシップ判定などのルート挙動を
 * 単体テストできるようにするため（Issue #8）。
 */
export function createCategoriesRoutes(getStore: GetStore, authMiddleware: MiddlewareHandler<Env>) {
  return new Hono<Env>()
    .onError((err, c) => {
      // insert が行を返さない等、想定外の store 例外を一律 500 に変換する。
      // 他のエラー（400/403/404）と同じ { error } 形式に揃えるため（セルフレビュー対応）。
      // なお findById 直後の削除競合（PATCH/DELETE）は update/softDelete 側の
      // WHERE(isActive=true) で検知し、404として扱う（別途Codexレビュー対応）。
      console.error("categories route error", err);
      return c.json({ error: "Internal Server Error" }, 500);
    })
    .use("*", authMiddleware)
    .get("/", async (c) => {
      const store = getStore(c);
      const rows = await store.listVisible(c.get("userId"));
      return c.json(rows);
    })
    .post("/", async (c) => {
      const body = readBody(await c.req.json().catch(() => null));
      const { name, color } = body;

      if (!isValidCategoryName(name)) {
        return c.json({ error: "name は1〜100文字の文字列で指定してください" }, 400);
      }
      if (color !== undefined && !isValidCategoryColor(color)) {
        return c.json({ error: "color は #RRGGBB 形式で指定してください" }, 400);
      }

      const store = getStore(c);
      const row: NewCategory = {
        id: crypto.randomUUID(),
        userId: c.get("userId"),
        name: name.trim(),
        ...(color !== undefined ? { color } : {}),
      };
      const created = await store.insert(row);
      return c.json(created, 201);
    })
    .patch("/:id", async (c) => {
      const id = c.req.param("id");
      const store = getStore(c);
      const existing = await store.findById(id);
      // 論理削除済み（isActive=false）は GET には出てこないため、
      // PATCH からも「存在しない」として扱う（Codexレビュー対応）。
      if (!existing || !existing.isActive) {
        return c.json({ error: "Not Found" }, 404);
      }
      if (!canModifyCategory(existing.userId, c.get("userId"))) {
        return c.json({ error: "Forbidden" }, 403);
      }

      const body = readBody(await c.req.json().catch(() => null));
      const patch: Partial<Pick<NewCategory, "name" | "color">> = {};

      if ("name" in body) {
        if (!isValidCategoryName(body.name)) {
          return c.json({ error: "name は1〜100文字の文字列で指定してください" }, 400);
        }
        patch.name = body.name.trim();
      }
      if ("color" in body) {
        if (!isValidCategoryColor(body.color)) {
          return c.json({ error: "color は #RRGGBB 形式で指定してください" }, 400);
        }
        patch.color = body.color;
      }
      if (Object.keys(patch).length === 0) {
        return c.json({ error: "更新する項目がありません" }, 400);
      }

      const updated = await store.update(id, patch);
      // findById〜ここまでの間に別リクエストが先に論理削除した場合、
      // update側のWHERE(isActive=true)がヒットせず undefined になる。
      // その場合は404（他の「削除済みは存在しない」経路と揃える。Codexレビュー対応）。
      if (!updated) {
        return c.json({ error: "Not Found" }, 404);
      }
      return c.json(updated);
    })
    .delete("/:id", async (c) => {
      const id = c.req.param("id");
      const store = getStore(c);
      const existing = await store.findById(id);
      // 既に論理削除済みなら「存在しない」として扱う（PATCHと同じ理由。Codexレビュー対応）。
      if (!existing || !existing.isActive) {
        return c.json({ error: "Not Found" }, 404);
      }
      if (!canModifyCategory(existing.userId, c.get("userId"))) {
        return c.json({ error: "Forbidden" }, 403);
      }

      const deleted = await store.softDelete(id);
      // update と同じレース対策。既に削除済みなら undefined。
      if (!deleted) {
        return c.json({ error: "Not Found" }, 404);
      }
      return c.body(null, 204);
    });
}
