import { formatDuration } from "@tsumori/core";

export function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-50 px-4">
      <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">Tsumori</h1>
      <p className="text-center text-sm text-gray-600 sm:text-base">
        「つもりだった時間」と「実際」の差を記録する
      </p>
      <p className="font-mono text-4xl tabular-nums text-gray-900 sm:text-5xl">
        {formatDuration(3661)}
      </p>
      <p className="text-xs text-gray-400">
        packages/core から formatDuration を読めていれば配線は成功
      </p>
    </main>
  );
}
