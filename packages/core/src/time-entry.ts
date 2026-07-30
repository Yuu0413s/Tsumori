const MAX_NAME_LENGTH = 200;
const MAX_DEVIATION_REASON_LENGTH = 500;
// DBのinteger範囲（2147483647）まで許すと「1回の作業記録の計画時間」としては
// 非現実的な値まで通ってしまう。1回のセッションの計画時間として現実的な上限
// （24時間）に絞る（Codexレビュー対応）。
const MAX_PLANNED_DURATION_MINUTES = 1440;

/**
 * 作業記録を操作してよいか判定する。
 * categories と異なり time_entries は必ず所有者が居る（共通レコードが無い）ため、
 * 単純な一致判定でよい（Issue #9）。
 */
export function canModifyTimeEntry(entryUserId: string, currentUserId: string): boolean {
  return entryUserId === currentUserId;
}

/**
 * タスク名として有効か判定する。タスク名は任意項目のため undefined は許容するが、
 * null や空文字・空白のみは不正な入力として弾く。
 */
export function isValidTimeEntryName(name: unknown): name is string | undefined {
  if (name === undefined) return true;
  return typeof name === "string" && name.trim().length > 0 && name.length <= MAX_NAME_LENGTH;
}

/**
 * 計画時間（分）として有効か判定する。任意項目のため undefined は許容する。
 */
export function isValidPlannedDurationMinutes(minutes: unknown): minutes is number | undefined {
  if (minutes === undefined) return true;
  return (
    typeof minutes === "number" &&
    Number.isInteger(minutes) &&
    minutes >= 0 &&
    minutes <= MAX_PLANNED_DURATION_MINUTES
  );
}

/**
 * 乖離理由として有効か判定する。任意項目のため undefined は許容するが、
 * 上限（500文字）を超える入力は弾く（nameと同様、textカラムでも無制限にはしない）。
 */
export function isValidDeviationReason(reason: unknown): reason is string | undefined {
  if (reason === undefined) return true;
  return typeof reason === "string" && reason.length <= MAX_DEVIATION_REASON_LENGTH;
}

/**
 * 「集中できたか」として有効か判定する。乖離モーダルを出さなかった場合は
 * 送られないため undefined は許容するが、null は不正入力として弾く
 * （reason と同様の考え方）。
 */
export function isValidDeviationFocused(focused: unknown): focused is boolean | undefined {
  if (focused === undefined) return true;
  return typeof focused === "boolean";
}

/**
 * 実績時間（分）を計算する。経過時間から累積休憩時間を差し引く。
 * 休憩時間が経過時間を上回ることは通常無いが、念のため0未満にはしない。
 */
export function calcActualDurationMinutes(
  startedAt: Date,
  endedAt: Date,
  totalBreakSeconds: number,
): number {
  const elapsedSeconds = (endedAt.getTime() - startedAt.getTime()) / 1000;
  const actualSeconds = Math.max(0, elapsedSeconds - totalBreakSeconds);
  return Math.floor(actualSeconds / 60);
}

/**
 * 休憩終了時に、今回の休憩時間を累積休憩秒数へ加算する。
 */
export function accumulateBreakSeconds(
  breakStartedAt: Date,
  resumedAt: Date,
  priorTotalBreakSeconds: number,
): number {
  const breakSeconds = Math.max(0, (resumedAt.getTime() - breakStartedAt.getTime()) / 1000);
  return priorTotalBreakSeconds + Math.floor(breakSeconds);
}

export type ElapsedTimeEntry = {
  status: "working" | "on_break";
  startedAt: Date;
  breakStartedAt: Date | null;
  totalBreakSeconds: number;
};

/**
 * 画面表示用の経過秒数を計算する。作業中は now まで進み続けるが、
 * 休憩中は breakStartedAt 時点で止める（技術メモ: 休憩中は表示を止める）。
 * setInterval のカウント積み上げではなく、都度 now との差分を取り直す設計
 * （タブがバックグラウンドに回っても後から正しい値に復帰できるようにするため）。
 */
export function calcElapsedSeconds(entry: ElapsedTimeEntry, now: Date): number {
  const referenceTime =
    entry.status === "on_break" && entry.breakStartedAt !== null ? entry.breakStartedAt : now;
  const elapsedSeconds = (referenceTime.getTime() - entry.startedAt.getTime()) / 1000;
  return Math.floor(Math.max(0, elapsedSeconds - entry.totalBreakSeconds));
}

const SIGNIFICANT_DEVIATION_MINUTES = 10;

/**
 * 計画時間と実績時間の乖離が、終了前に確認を挟むべき大きさ（10分以上）か判定する。
 * plannedDurationMinutes が未設定（null）の場合は比較対象が無いため常に false。
 */
export function isSignificantDeviation(
  plannedDurationMinutes: number | null,
  actualMinutes: number,
): boolean {
  if (plannedDurationMinutes === null) return false;
  return Math.abs(actualMinutes - plannedDurationMinutes) >= SIGNIFICANT_DEVIATION_MINUTES;
}
