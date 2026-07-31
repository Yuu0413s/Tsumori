import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { handleUnauthorized } from "./handle-unauthorized.js";

export const queryClient = new QueryClient({
  // クエリ・ミューテーションどちらでセッション切れ（401）が起きても /login へ誘導する
  // ため、個々のコンポーネントではなくキャッシュ側に一箇所だけ仕掛ける（Issue #41）。
  queryCache: new QueryCache({ onError: handleUnauthorized }),
  mutationCache: new MutationCache({ onError: handleUnauthorized }),
  defaultOptions: {
    queries: {
      // 401/404 のような「リトライしても変わらない」エラーで無駄に叩き続けないよう、
      // まず控えめな回数に倒す（挙動を見ながら調整する前提）。
      retry: 1,
    },
  },
});
