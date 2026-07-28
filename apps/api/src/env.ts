export type Bindings = {
  ENVIRONMENT: string;
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
};

/**
 * wrangler.jsonc の vars.ENVIRONMENT は本番用の env ブロックが無く、
 * デプロイしても "development" のまま変わらない（#5の既知の未整備）。
 * そのため ENVIRONMENT ではなく、環境ごとに実際に値が変わる
 * BETTER_AUTH_URL を判定に使う（Codexレビュー対応：本番でlocalhostを
 * 信頼済みoriginにしてしまう問題の修正）。
 *
 * この判定はCORSミドルウェアなど認証不要なルート（/healthなど）でも
 * 呼ばれるため、BETTER_AUTH_URLが未設定・不正な値でも例外を投げず
 * false を返す。また "http://localhost.evil.example" のような
 * 前方一致だけの紛らわしい値を弾くため、URLとしてパースしhostnameを
 * 厳密に比較する（Codexレビュー対応・2回目）。
 */
export function isLocalDev(env: Bindings): boolean {
  if (!env.BETTER_AUTH_URL) return false;

  let url: URL;
  try {
    url = new URL(env.BETTER_AUTH_URL);
  } catch {
    return false;
  }

  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}
