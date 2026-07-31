// APIが401を返したことを他のエラー（4xx/5xx全般）と区別するためのマーカー。
// ensure-ok.ts が投げ、format-error.ts / query-client.ts の両方がこれを見て
// セッション切れ特有の扱い（文言・ログイン画面への誘導）をする（Issue #41）。
export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}
