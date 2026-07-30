import { useState } from "react";
import { calcElapsedSeconds, formatDuration, isSignificantDeviation } from "@tsumori/core";
import { useCategories } from "../hooks/use-categories.js";
import {
  useCurrentTimeEntry,
  useStartTimeEntry,
  useStartBreak,
  useResumeTimeEntry,
  useEndTimeEntry,
  type TimeEntry,
} from "../hooks/use-time-entry.js";
import { useClock } from "../hooks/use-clock.js";
import { DeviationModal } from "../components/DeviationModal.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { LoadingScreen } from "../components/LoadingScreen.js";
import { formatApiError } from "../lib/format-error.js";

export function TimerPage() {
  const { data: currentEntry, isPending, error } = useCurrentTimeEntry();

  if (isPending) {
    return <LoadingScreen />;
  }
  if (error) {
    return <ErrorMessage message={formatApiError(error)} />;
  }

  // useClock（1秒ごとの再レンダー）は実行中表示にしか要らないため、
  // RunningTimer 側に閉じ込めて開始フォーム表示中の無駄な再レンダーを避ける。
  return currentEntry ? <RunningTimer entry={currentEntry} /> : <StartTimerForm />;
}

function StartTimerForm() {
  const { data: categories, isPending, error } = useCategories();
  const startTimeEntry = useStartTimeEntry();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [plannedDurationMinutes, setPlannedDurationMinutes] = useState("");

  if (isPending) {
    return <LoadingScreen />;
  }
  if (error) {
    return <ErrorMessage message={formatApiError(error)} />;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (categoryId === "") return;
        startTimeEntry.mutate({
          categoryId,
          name: name.trim() === "" ? undefined : name.trim(),
          plannedDurationMinutes:
            plannedDurationMinutes === "" ? undefined : Number(plannedDurationMinutes),
        });
      }}
      className="mx-auto flex max-w-sm flex-col gap-4"
    >
      <label className="flex flex-col gap-1 text-sm text-gray-700">
        カテゴリ
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          required
          className="min-h-11 rounded-md border border-gray-300 px-3 text-base text-gray-900"
        >
          <option value="" disabled>
            選択してください
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm text-gray-700">
        タスク名（任意）
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-11 rounded-md border border-gray-300 px-3 text-base text-gray-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm text-gray-700">
        計画時間（分・任意）
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={1440}
          value={plannedDurationMinutes}
          onChange={(e) => setPlannedDurationMinutes(e.target.value)}
          className="min-h-11 rounded-md border border-gray-300 px-3 text-base text-gray-900"
        />
      </label>

      {startTimeEntry.error ? (
        <ErrorMessage message={formatApiError(startTimeEntry.error)} />
      ) : null}

      <button
        type="submit"
        disabled={categoryId === "" || startTimeEntry.isPending}
        className="min-h-11 rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        開始する
      </button>
    </form>
  );
}

function RunningTimer({ entry }: { entry: TimeEntry }) {
  const startBreak = useStartBreak();
  const resumeTimeEntry = useResumeTimeEntry();
  const endTimeEntry = useEndTimeEntry();
  const [showDeviationModal, setShowDeviationModal] = useState(false);
  const now = useClock();

  // GET /current は進行中（working/on_break）のみ返すため completed は来ないが、
  // レスポンスの型自体は TimeEntry 全体の status（completed を含む）になっている。
  const elapsedSeconds = calcElapsedSeconds(
    {
      status: entry.status === "on_break" ? "on_break" : "working",
      startedAt: new Date(entry.startedAt),
      breakStartedAt: entry.breakStartedAt !== null ? new Date(entry.breakStartedAt) : null,
      totalBreakSeconds: entry.totalBreakSeconds,
    },
    now,
  );
  const actualMinutes = Math.floor(elapsedSeconds / 60);

  const handleEndClick = () => {
    if (isSignificantDeviation(entry.plannedDurationMinutes, actualMinutes)) {
      setShowDeviationModal(true);
      return;
    }
    endTimeEntry.mutate({ id: entry.id });
  };

  const mutationError =
    startBreak.error ?? resumeTimeEntry.error ?? endTimeEntry.error ?? undefined;
  // いずれかの操作が進行中は他のボタンも無効化する（Codexレビュー対応）。
  // 個別に isPending だけを見ていると、例えば休憩リクエスト送信中に終了ボタンを
  // 押せてしまい、サーバー側は409で弾くだけでユーザーには「押したのに終了できない」
  // ように見えてしまう。
  const isMutating = startBreak.isPending || resumeTimeEntry.isPending || endTimeEntry.isPending;

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
      {entry.name ? <p className="text-sm text-gray-600">{entry.name}</p> : null}
      <p className="font-mono text-4xl tabular-nums text-gray-900">
        {formatDuration(elapsedSeconds)}
      </p>
      {entry.status === "on_break" ? <p className="text-sm text-amber-600">休憩中</p> : null}

      {mutationError ? <ErrorMessage message={formatApiError(mutationError)} /> : null}

      <div className="flex w-full gap-2">
        {entry.status === "working" ? (
          <button
            type="button"
            onClick={() => startBreak.mutate(entry.id)}
            disabled={isMutating}
            className="min-h-11 flex-1 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            休憩
          </button>
        ) : (
          <button
            type="button"
            onClick={() => resumeTimeEntry.mutate(entry.id)}
            disabled={isMutating}
            className="min-h-11 flex-1 rounded-md border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            再開
          </button>
        )}
        <button
          type="button"
          onClick={handleEndClick}
          disabled={isMutating}
          className="min-h-11 flex-1 rounded-md bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          終了
        </button>
      </div>

      {showDeviationModal ? (
        <DeviationModal
          onCancel={() => setShowDeviationModal(false)}
          onSubmit={({ focused, reason }) => {
            setShowDeviationModal(false);
            endTimeEntry.mutate({ id: entry.id, focused, reason });
          }}
        />
      ) : null}
    </div>
  );
}
