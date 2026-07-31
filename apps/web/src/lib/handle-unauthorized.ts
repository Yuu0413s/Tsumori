import { UnauthorizedError } from "./unauthorized-error.js";

type Redirect = (path: string) => void;

function defaultRedirect(path: string) {
  // assign だと保護画面が履歴に残り、/login で「戻る」を押すと再び401になる
  // 画面へ戻ってしまう（Codexレビュー指摘）。RequireAuth/RequireGuest と同じく
  // replace で履歴を汚さない。
  window.location.replace(path);
}

// query-client.ts の QueryCache/MutationCache から呼ばれる。RequireAuth は
// useSession（better-authのキャッシュ）しか見ておらず、API側だけ先にセッションが
// 切れた場合に気づけない（Issue #41「セッション切れの状態で操作」）。
// 401を検知した時点でここから /login へ飛ばし、無言で失敗させない。
// フルリロードにしているのは、次に /login に着地した時点で useSession が
// 確実に最新状態（未ログイン）を取り直すのを保証するため。
export function createHandleUnauthorized(redirect: Redirect = defaultRedirect) {
  return function handleUnauthorized(error: unknown) {
    if (error instanceof UnauthorizedError) {
      redirect("/login");
    }
  };
}

export const handleUnauthorized = createHandleUnauthorized();
