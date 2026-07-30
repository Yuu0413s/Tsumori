// 「何分前に予告するか」の上限。plannedDurationMinutes（time-entry.ts）と同じ
// 24時間を上限にしておく。予告時間が作業時間より長いのは非現実的だが、
// その相関チェックはユーザー設定単体では行えないため、ここでは単純な範囲チェックに留める。
const MAX_PRE_ALARM_MINUTES = 1440;

export function isValidBreakExtendsDeadline(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isValidSoundEnabled(value: unknown): value is boolean {
  return typeof value === "boolean";
}

/**
 * 予告時間（分）として有効か判定する。null は「予告しない」を意味する有効値。
 */
export function isValidPreAlarmMinutes(value: unknown): value is number | null {
  if (value === null) return true;
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_PRE_ALARM_MINUTES
  );
}
