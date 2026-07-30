import { hc } from "hono/client";
import type { AppType } from "@tsumori/api";

// apps/api 側で `new Hono().basePath("/api")` してから export しているため、
// AppType のルート型にはすでに "/api" が含まれている（例: apiClient.api.me）。
// ここで baseUrl に "/api" を足すと "/api/api/me" と二重になってしまうため origin だけにする
// （実際のリクエスト先は同一オリジンなので開発時は vite.config.ts の proxy が転送する）。
// "/" のような相対パスでも $get() 等の通常呼び出しは動くが、hc の $url() は内部で
// `new URL()` に絶対URLを要求するため、相対パスのままだとそこだけ例外になる
// （Codexレビュー対応：将来 $url() を使ったときに壊れないよう origin を渡す）。
// better-auth はセッションを Cookie で扱うため credentials: "include" が必須。
export const apiClient = hc<AppType>(window.location.origin, {
  init: { credentials: "include" },
});
