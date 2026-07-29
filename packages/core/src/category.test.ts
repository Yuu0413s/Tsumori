import { describe, expect, test } from "bun:test";
import { isValidCategoryName, isValidCategoryColor, canModifyCategory } from "./category.js";

describe("isValidCategoryName", () => {
  test("通常の文字列は有効", () => {
    expect(isValidCategoryName("仕事")).toBe(true);
  });

  test("空文字は無効", () => {
    expect(isValidCategoryName("")).toBe(false);
  });

  test("空白のみは無効", () => {
    expect(isValidCategoryName("   ")).toBe(false);
  });

  test("101文字以上は無効", () => {
    expect(isValidCategoryName("あ".repeat(101))).toBe(false);
  });

  test("100文字ちょうどは有効", () => {
    expect(isValidCategoryName("あ".repeat(100))).toBe(true);
  });

  test("文字列以外は無効", () => {
    expect(isValidCategoryName(123)).toBe(false);
    expect(isValidCategoryName(null)).toBe(false);
    expect(isValidCategoryName(undefined)).toBe(false);
  });
});

describe("isValidCategoryColor", () => {
  test("#RRGGBB 形式は有効", () => {
    expect(isValidCategoryColor("#3b82f6")).toBe(true);
    expect(isValidCategoryColor("#FFFFFF")).toBe(true);
  });

  test("# が無いと無効", () => {
    expect(isValidCategoryColor("3b82f6")).toBe(false);
  });

  test("桁数が違うと無効", () => {
    expect(isValidCategoryColor("#fff")).toBe(false);
    expect(isValidCategoryColor("#3b82f60")).toBe(false);
  });

  test("16進以外の文字を含むと無効", () => {
    expect(isValidCategoryColor("#zzzzzz")).toBe(false);
  });

  test("文字列以外は無効", () => {
    expect(isValidCategoryColor(123)).toBe(false);
    expect(isValidCategoryColor(null)).toBe(false);
  });
});

describe("canModifyCategory", () => {
  test("自分のカテゴリは編集可能", () => {
    expect(canModifyCategory("user_1", "user_1")).toBe(true);
  });

  test("他人のカテゴリは編集不可", () => {
    expect(canModifyCategory("user_1", "user_2")).toBe(false);
  });

  test("共通カテゴリ（userId が null）は編集不可", () => {
    expect(canModifyCategory(null, "user_1")).toBe(false);
  });
});
