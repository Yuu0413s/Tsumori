import { formatDuration } from "@tsumori/core";
import { ErrorMessage } from "./ErrorMessage.js";

type MiniTimerProps = {
  entryName: string | null;
  status: "working" | "on_break";
  elapsedSeconds: number;
  isMutating: boolean;
  errorMessage: string | null;
  onToggleBreak: () => void;
  onEnd: () => void;
};

/**
 * Document Picture-in-Picture ウィンドウの中身。本体（RunningTimer）から
 * 状態とハンドラをそのまま受け取るだけで、独自の状態は持たない。
 */
export function MiniTimer({
  entryName,
  status,
  elapsedSeconds,
  isMutating,
  errorMessage,
  onToggleBreak,
  onEnd,
}: MiniTimerProps) {
  return (
    // justify-center と overflow-y-auto の併用は、内容が枠より大きいとき先頭側が
    // スクロールしても見えなくなる既知の挙動があるため、160px高でエラー表示等が
    // 増えても操作できるよう justify-start + overflow-y-auto にする
    // （Codexレビュー対応）。
    <div className="flex h-dvh flex-col items-center justify-start gap-2 overflow-y-auto bg-gray-50 p-3 text-center">
      {entryName ? <p className="truncate text-xs text-gray-600">{entryName}</p> : null}
      <p className="font-mono text-2xl tabular-nums text-gray-900">
        {formatDuration(elapsedSeconds)}
      </p>
      {status === "on_break" ? <p className="text-xs text-amber-600">休憩中</p> : null}
      {errorMessage ? <ErrorMessage message={errorMessage} /> : null}

      <div className="flex w-full gap-2">
        <button
          type="button"
          onClick={onToggleBreak}
          disabled={isMutating}
          className="min-h-11 flex-1 rounded-md border border-gray-300 px-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "working" ? "休憩" : "再開"}
        </button>
        <button
          type="button"
          onClick={onEnd}
          disabled={isMutating}
          className="min-h-11 flex-1 rounded-md bg-gray-900 px-2 text-sm font-medium text-white hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          終了
        </button>
      </div>
    </div>
  );
}
