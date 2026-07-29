import { Hono } from "hono";
import { cors } from "hono/cors";
import { formatDuration } from "@tsumori/core";
import { createDb, createCategoryStore } from "@tsumori/db";
import { createAuth } from "./auth.js";
import { requireAuth, type AuthVariables } from "./middleware/require-auth.js";
import { createCategoriesRoutes } from "./routes/categories.js";
import { isLocalDev, type Bindings } from "./env.js";

export type { Bindings };

type Env = { Bindings: Bindings; Variables: AuthVariables };

const app = new Hono<Env>().basePath("/api");

// 開発中はローカルの Vite dev サーバー（5173番ポート固定）からのアクセスのみ許可する。
// 本番は同一オリジン（tsumori.yuu0413.com）なので CORS は不要になる。
// better-auth がセッションを Cookie で扱うため credentials を付与する。
// origin を関数にして isLocalDev(c.env) で判定するのは、wrangler.jsonc の
// ENVIRONMENT が本番でも "development" のままで信頼できないため
// （Codexレビュー対応：本番でlocalhostをCORS許可し続けてしまう問題の修正）。
app.use(
  "*",
  cors({
    origin: (origin, c) =>
      isLocalDev(c.env) && origin === "http://localhost:5173" ? origin : null,
    credentials: true,
  }),
);

// better-auth の全エンドポイント（/api/auth/callback/google 等）をそのまま委譲する。
app.on(["GET", "POST"], "/auth/*", (c) => createAuth(c.env).handler(c.req.raw));

const routes = app
  .get("/health", (c) =>
    c.json({
      status: "ok",
      environment: c.env.ENVIRONMENT,
      uptimeSample: formatDuration(3661),
    }),
  )
  .get("/version", (c) => c.json({ name: "tsumori-api", version: "0.0.0" }))
  .get(
    "/me",
    requireAuth<Env>((c) => createAuth(c.env).api.getSession({ headers: c.req.raw.headers })),
    (c) => c.json({ userId: c.get("userId") }),
  )
  .route(
    "/categories",
    createCategoriesRoutes(
      (c) => createCategoryStore(createDb(c.env.DATABASE_URL)),
      requireAuth<Env>((c) => createAuth(c.env).api.getSession({ headers: c.req.raw.headers })),
    ),
  );

// Hono RPC 用の型。apps/web と apps/mobile はこの型を import して
// エンドポイントとレスポンスの型安全性を得る。
export type AppType = typeof routes;

export default routes;
