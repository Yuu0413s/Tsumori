import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { handleUnauthorized } from "./handle-unauthorized.js";
import { UnauthorizedError } from "./unauthorized-error.js";

// 401（セッション切れ）はリトライしても回復しないため即座に諦める。
// それ以外は404等も含め、まず控えめな回数に倒す（挙動を見ながら調整する前提。
// Codexレビュー指摘：401まで一律リトライすると/loginへの誘導が無駄に遅れる）。
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return !(error instanceof UnauthorizedError) && failureCount < 1;
}

export const queryClient = new QueryClient({
  // クエリ・ミューテーションどちらでセッション切れ（401）が起きても /login へ誘導する
  // ため、個々のコンポーネントではなくキャッシュ側に一箇所だけ仕掛ける（Issue #41）。
  queryCache: new QueryCache({ onError: handleUnauthorized }),
  mutationCache: new MutationCache({ onError: handleUnauthorized }),
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
    },
  },
});
