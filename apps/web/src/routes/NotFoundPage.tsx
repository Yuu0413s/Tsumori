import { Link } from "react-router";

// ルーターに存在しないパス（例: /foo）向けのフォールバック。
// これが無いと react-router のデフォルトエラー画面（"Unexpected Application Error!"）が
// そのまま出てしまい、アプリの見た目と揃わないうえ導線も無い（Issue #41）。
export function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
      <h1 className="text-2xl font-bold text-gray-900">ページが見つかりません</h1>
      <p className="max-w-xs text-sm text-gray-600">
        指定されたURLは存在しないか、移動した可能性があります。
      </p>
      <Link
        to="/"
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
      >
        タイマー画面に戻る
      </Link>
    </main>
  );
}
