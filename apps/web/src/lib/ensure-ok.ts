import { UnauthorizedError } from "./unauthorized-error.js";

// hc クライアントは HTTP レベルのエラー（4xx/5xx）では例外を投げず、
// res.ok === false のレスポンスをそのまま返す。TanStack Query に
// エラーとして扱わせるには、ここで明示的に throw する必要がある。
// ジェネリクスで受け取ることで、hc の ClientResponse<T>（res.json() の型情報を持つ）
// をそのまま通過させ、呼び出し側で型情報が失われないようにする。
export async function ensureOk<T extends Response>(res: T): Promise<T> {
  if (res.ok) return res;

  // 401（セッション切れ・未ログイン）は他のエラーと違い「ログイン画面へ誘導する」という
  // 固有の後続処理が必要なため、専用の型で区別する（Issue #41）。
  if (res.status === 401) {
    throw new UnauthorizedError();
  }

  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? `リクエストに失敗しました（${res.status}）`);
}
