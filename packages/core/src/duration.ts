/**
 * 秒数を HH:MM:SS 形式に整形する。
 * 負の値は 0 として扱う。
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * 分を秒に変換する。null / undefined はそのまま null を返す。
 */
export function parseDurationMinutes(minutes: number | null | undefined): number | null {
  if (minutes === null || minutes === undefined) return null;
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  return Math.floor(minutes) * 60;
}
