// fetch は通信自体が失敗すると TypeError を投げる（DNS解決失敗・オフライン等）。
// HTTPレベルのエラー（4xx/5xx）は呼び出し側で res.ok を見て Error に変換してから渡す想定。
export function formatApiError(error: unknown): string {
  if (error instanceof TypeError) {
    return "サーバーに接続できませんでした。通信環境を確認してください。";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "予期しないエラーが発生しました。";
}
