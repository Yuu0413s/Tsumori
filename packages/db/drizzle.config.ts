import { defineConfig } from "drizzle-kit";

// drizzle-kit migrate は pooler 経由だと失敗することがあるため、
// DATABASE_URL_UNPOOLED があればそちらを優先する（#40）。
const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL_UNPOOLED または DATABASE_URL が設定されていません。.env を確認してください。",
  );
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
