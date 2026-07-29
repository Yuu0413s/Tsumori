import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDb>;

/**
 * 接続文字列を引数で受け取る。
 * Cloudflare Workers では process.env が使えないため、
 * 呼び出し側（Hono の c.env）から明示的に渡す設計にしている。
 */
export function createDb(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export { schema };
export * from "./schema.js";
export { createCategoryStore, type CategoryStore } from "./categories-repository.js";
