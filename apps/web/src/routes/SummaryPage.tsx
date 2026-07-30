import { formatMinutes, isSignificantDeviation, summarizeByCategory } from "@tsumori/core";
import { useTodayEntries, type TodayEntry } from "../hooks/use-today-entries.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { LoadingScreen } from "../components/LoadingScreen.js";
import { formatApiError } from "../lib/format-error.js";

export function SummaryPage() {
  const { data: entries, isPending, error } = useTodayEntries();

  if (isPending) {
    return <LoadingScreen />;
  }
  if (error) {
    return <ErrorMessage message={formatApiError(error)} />;
  }

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-md text-center text-sm text-gray-500">
        今日の記録はまだありません。
      </div>
    );
  }

  return <SummaryContent entries={entries} />;
}

function SummaryContent({ entries }: { entries: TodayEntry[] }) {
  const summaries = summarizeByCategory(entries);
  const totalPlanned = summaries.reduce((sum, s) => sum + s.plannedMinutes, 0);
  const totalActual = summaries.reduce((sum, s) => sum + s.actualMinutes, 0);
  // 予定・実績のバーを同じ縮尺で比較できるよう、全カテゴリの最大値を基準にする
  // （カテゴリごとに縮尺を変えると、バーの長さだけを見て大小を誤読しやすいため）。
  const scale = Math.max(1, ...summaries.flatMap((s) => [s.plannedMinutes, s.actualMinutes]));

  const deviations = entries.filter((entry) =>
    isSignificantDeviation(entry.plannedDurationMinutes, entry.durationMinutes ?? 0),
  );

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <header>
        <h1 className="text-lg font-bold text-gray-900">今日のサマリー</h1>
        <p className="text-sm text-gray-500">
          合計 実績 {formatMinutes(totalActual)} / 予定{" "}
          {totalPlanned > 0 ? formatMinutes(totalPlanned) : "未設定"}
        </p>
      </header>

      <section className="flex flex-col gap-4">
        {summaries.map((s) => (
          <div key={s.categoryId} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium text-gray-900">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: s.categoryColor }}
                />
                {s.categoryName}
              </span>
              <span className="text-gray-500">
                実績 {formatMinutes(s.actualMinutes)} / 予定{" "}
                {s.plannedMinutes > 0 ? formatMinutes(s.plannedMinutes) : "未設定"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-xs text-gray-400">予定</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-gray-300"
                  style={{ width: `${(s.plannedMinutes / scale) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-xs text-gray-400">実績</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(s.actualMinutes / scale) * 100}%`,
                    backgroundColor: s.categoryColor,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold text-gray-900">乖離が大きかった記録</h2>
        {deviations.length === 0 ? (
          <p className="text-sm text-gray-500">大きな乖離はありませんでした。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {deviations.map((entry) => (
              <li
                key={entry.id}
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
              >
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium text-gray-900">
                    {entry.category.name}
                    {entry.name ? ` ・ ${entry.name}` : ""}
                  </span>
                  <span className="text-gray-500">
                    予定 {formatMinutes(entry.plannedDurationMinutes ?? 0)} → 実績{" "}
                    {formatMinutes(entry.durationMinutes ?? 0)}
                  </span>
                </div>
                {entry.deviationReason ? (
                  <p className="mt-1 text-gray-600">{entry.deviationReason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
