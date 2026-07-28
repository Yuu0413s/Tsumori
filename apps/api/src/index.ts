import { Hono } from "hono";
import { cors } from "hono/cors";
import { formatDuration } from "@tsumori/core";

export type Bindings = {
  ENVIRONMENT: string;
  DATABASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>().basePath("/api");

// 開発中はローカルの Vite dev サーバー（5173番ポート固定）からのアクセスのみ許可する。
// 本番は同一オリジン（tsumori.yuu0413.com）なので CORS は不要になる。
// Cookie 認証は未実装のため credentials は付与しない。
app.use(
  "*",
  cors({
    origin: "http://localhost:5173",
  }),
);

const routes = app
  .get("/health", (c) =>
    c.json({
      status: "ok",
      environment: c.env.ENVIRONMENT,
      uptimeSample: formatDuration(3661),
    }),
  )
  .get("/version", (c) => c.json({ name: "tsumori-api", version: "0.0.0" }));

// Hono RPC 用の型。apps/web と apps/mobile はこの型を import して
// エンドポイントとレスポンスの型安全性を得る。
export type AppType = typeof routes;

export default routes;
