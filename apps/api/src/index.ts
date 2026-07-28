import { Hono } from "hono";
import { cors } from "hono/cors";
import { formatDuration } from "@tsumori/core";

export type Bindings = {
  ENVIRONMENT: string;
  DATABASE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>().basePath("/api");

// 開発中はローカルの Vite dev サーバーからのアクセスを許可する。
// 本番は同一オリジン（tsumori.yuu0413.com）なので CORS は不要になる。
app.use(
  "*",
  cors({
    origin: (origin) => (origin?.startsWith("http://localhost:") ? origin : null),
    credentials: true,
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
