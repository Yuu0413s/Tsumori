import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 401/404 のような「リトライしても変わらない」エラーで無駄に叩き続けないよう、
      // まず控えめな回数に倒す（挙動を見ながら調整する前提）。
      retry: 1,
    },
  },
});
