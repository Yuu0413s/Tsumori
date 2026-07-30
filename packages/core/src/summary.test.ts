import { describe, expect, test } from "bun:test";
import { summarizeByCategory, type SummarizableEntry } from "./summary.js";

function makeEntry(overrides: Partial<SummarizableEntry> = {}): SummarizableEntry {
  return {
    categoryId: "cat_1",
    category: { name: "学習", color: "#3b82f6" },
    plannedDurationMinutes: 60,
    durationMinutes: 90,
    ...overrides,
  };
}

describe("summarizeByCategory", () => {
  test("記録が0件なら空配列を返す", () => {
    expect(summarizeByCategory([])).toEqual([]);
  });

  test("同じカテゴリの複数記録は合算される", () => {
    const result = summarizeByCategory([
      makeEntry({ plannedDurationMinutes: 30, durationMinutes: 20 }),
      makeEntry({ plannedDurationMinutes: 60, durationMinutes: 70 }),
    ]);
    expect(result).toEqual([
      {
        categoryId: "cat_1",
        categoryName: "学習",
        categoryColor: "#3b82f6",
        plannedMinutes: 90,
        actualMinutes: 90,
      },
    ]);
  });

  test("異なるカテゴリはそれぞれ別エントリになる", () => {
    const result = summarizeByCategory([
      makeEntry({ categoryId: "cat_1", category: { name: "学習", color: "#3b82f6" } }),
      makeEntry({ categoryId: "cat_2", category: { name: "運動", color: "#ef4444" } }),
    ]);
    expect(result.map((r) => r.categoryId).sort()).toEqual(["cat_1", "cat_2"]);
  });

  test("plannedDurationMinutesがnullの記録は0として扱われる", () => {
    const result = summarizeByCategory([makeEntry({ plannedDurationMinutes: null })]);
    expect(result[0]?.plannedMinutes).toBe(0);
  });

  test("durationMinutesがnullの記録は0として扱われる（防御的なケース）", () => {
    const result = summarizeByCategory([makeEntry({ durationMinutes: null })]);
    expect(result[0]?.actualMinutes).toBe(0);
  });

  test("実績時間の降順でソートされる", () => {
    const result = summarizeByCategory([
      makeEntry({ categoryId: "cat_1", durationMinutes: 30 }),
      makeEntry({ categoryId: "cat_2", durationMinutes: 90 }),
      makeEntry({ categoryId: "cat_3", durationMinutes: 60 }),
    ]);
    expect(result.map((r) => r.categoryId)).toEqual(["cat_2", "cat_3", "cat_1"]);
  });
});
