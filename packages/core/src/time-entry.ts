const MAX_NAME_LENGTH = 200;

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
  return typeof minutes === "number" && Number.isInteger(minutes) && minutes >= 0;
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
