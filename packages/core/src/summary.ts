export type CategorySummaryEntry = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  plannedMinutes: number;
  actualMinutes: number;
};

export type SummarizableEntry = {
  categoryId: string;
  category: { name: string; color: string };
  plannedDurationMinutes: number | null;
  durationMinutes: number | null;
};

/**
 * 完了済みの作業記録をカテゴリ別に集計する。
 * plannedDurationMinutes / durationMinutes が null の記録は0として扱う
 * （計画時間は任意項目のため未設定がありうる。durationMinutesは本来
 * completedなら必ず入るが、念のため防御的にnullを許容する）。
 * 実績時間の降順で返す（画面で目立つカテゴリから並べるため）。
 */
export function summarizeByCategory(entries: readonly SummarizableEntry[]): CategorySummaryEntry[] {
  const summaries = new Map<string, CategorySummaryEntry>();

  for (const entry of entries) {
    const planned = entry.plannedDurationMinutes ?? 0;
    const actual = entry.durationMinutes ?? 0;
    const existing = summaries.get(entry.categoryId);
    if (existing) {
      existing.plannedMinutes += planned;
      existing.actualMinutes += actual;
    } else {
      summaries.set(entry.categoryId, {
        categoryId: entry.categoryId,
        categoryName: entry.category.name,
        categoryColor: entry.category.color,
        plannedMinutes: planned,
        actualMinutes: actual,
      });
    }
  }

  return [...summaries.values()].sort((a, b) => b.actualMinutes - a.actualMinutes);
}
