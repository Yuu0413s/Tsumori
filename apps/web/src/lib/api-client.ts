import { hc } from "hono/client";
import type { AppType } from "@tsumori/api";

// apps/api 側で `new Hono().basePath("/api")` してから export しているため、
// AppType のルート型にはすでに "/api" が含まれている（例: apiClient.api.me）。
// ここで baseUrl に "/api" を足すと "/api/api/me" と二重になってしまうため "/" にする。
// 実際のリクエスト先は同一オリジンの相対パスになり、開発時は vite.config.ts の proxy が転送する。
// better-auth はセッションを Cookie で扱うため credentials: "include" が必須。
export const apiClient = hc<AppType>("/", {
  init: { credentials: "include" },
});
