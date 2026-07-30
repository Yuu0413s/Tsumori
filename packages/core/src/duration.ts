/**
 * 秒数を HH:MM:SS 形式に整形する。
 * 負の値・NaN・Infinity は 0 として扱う。
 */
export function formatDuration(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
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

/**
 * 分数を「1時間30分」のような日本語表記に整形する（サマリー画面表示用）。
 * formatDuration（HH:MM:SS）とは用途が異なり、こちらは人が読む一覧・集計向け。
 * 負の値・NaN・Infinityは0分として扱う。
 */
export function formatMinutes(totalMinutes: number): string {
  const safe = Number.isFinite(totalMinutes) ? Math.max(0, Math.floor(totalMinutes)) : 0;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}
