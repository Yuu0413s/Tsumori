// hc クライアントは HTTP レベルのエラー（4xx/5xx）では例外を投げず、
// res.ok === false のレスポンスをそのまま返す。TanStack Query に
// エラーとして扱わせるには、ここで明示的に throw する必要がある。
export async function ensureOk(res: Response): Promise<Response> {
  if (res.ok) return res;

  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? `リクエストに失敗しました（${res.status}）`);
}
