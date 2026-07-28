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
 */
export function isLocalDev(env: Bindings): boolean {
  return env.BETTER_AUTH_URL.startsWith("http://localhost");
}
