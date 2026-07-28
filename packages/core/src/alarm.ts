export type AlarmEntry = {
  startedAt: Date;
  plannedDurationMinutes: number | null;
  totalBreakSeconds: number;
  breakStartedAt: Date | null;
  breakExtendsDeadline: boolean;
};

/**
 * 締切を計算する。`plannedDurationMinutes` が null なら締切なし（null）。
 * `breakExtendsDeadline = true` のとき、休憩時間ぶん締切を後ろに延ばす
 * （休憩中なら `now` から進行中の休憩の経過分も加算する）。
 */
export function calcDeadline(entry: AlarmEntry, now: Date): Date | null {
  const {
    startedAt,
    plannedDurationMinutes,
    totalBreakSeconds,
    breakStartedAt,
    breakExtendsDeadline,
  } = entry;

  if (plannedDurationMinutes === null) return null;

  const baseMs = startedAt.getTime() + plannedDurationMinutes * 60_000;

  if (!breakExtendsDeadline) {
    return new Date(baseMs);
  }

  const ongoingBreakSeconds =
    breakStartedAt !== null ? Math.max(0, (now.getTime() - breakStartedAt.getTime()) / 1000) : 0;

  return new Date(baseMs + (totalBreakSeconds + ongoingBreakSeconds) * 1000);
}

/**
 * アラームを発火すべきか判定する。
 * 「延ばす」設定で休憩中のときは、締切自体が動き続けている途中なので発火させない。
 */
export function shouldFireAlarm(entry: AlarmEntry, now: Date): boolean {
  if (entry.breakExtendsDeadline && entry.breakStartedAt !== null) {
    return false;
  }

  const deadline = calcDeadline(entry, now);
  if (deadline === null) return false;

  return now.getTime() >= deadline.getTime();
}
