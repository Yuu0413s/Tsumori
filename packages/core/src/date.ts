/**
 * UTC基準の YYYY-MM-DD 文字列に変換する。
 * time_entries.date は歴史的にUTC基準で書き込まれてきたため（schema.ts参照）、
 * サーバー側で「今日」を決めるときも同じ基準に揃える。
 */
export function toUtcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
