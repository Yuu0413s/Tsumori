import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createDb, schema } from "@tsumori/db";
import { isLocalDev, type Bindings } from "./env.js";

/**
 * env は Cloudflare Workers では c.env からリクエスト時に渡される
 * （process.env が使えないため）。この関数自体はリクエストのたびに
 * 呼ばれるわけではなく、isolate内で初回だけ呼ばれる（createAuthのキャッシュ参照）。
 */
function buildAuth(env: Bindings) {
  const db = createDb(env.DATABASE_URL);

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        // google 以外を入れると、メール未検証のプロバイダ経由で
        // 既存アカウントを乗っ取れる経路になるため固定する（Issue #6）。
        trustedProviders: ["google"],
      },
    },
    // 本番は独自ドメインで単一オリジンのため不要。ローカル開発（Vite:5173 → Workers:8787）
    // のクロスオリジンのみ許可する。
    trustedOrigins: isLocalDev(env) ? ["http://localhost:5173"] : [],
  });
}

let cachedAuth: ReturnType<typeof buildAuth> | undefined;

/**
 * Workers の isolate はリクエスト間で使い回されるため、初回だけ構築してキャッシュする
 * （Codexレビュー対応：毎リクエストDBクライアント/アダプタを作り直す無駄を削減）。
 * bindings はデプロイ済みの1 Workerでは変わらないため、キー無しのキャッシュで安全。
 */
export function createAuth(env: Bindings) {
  cachedAuth ??= buildAuth(env);
  return cachedAuth;
}
