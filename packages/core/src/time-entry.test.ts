import { describe, expect, test } from "bun:test";
import {
  canModifyTimeEntry,
  isValidTimeEntryName,
  isValidPlannedDurationMinutes,
  isValidDeviationReason,
  calcActualDurationMinutes,
  accumulateBreakSeconds,
} from "./time-entry.js";

describe("canModifyTimeEntry", () => {
  test("自分の記録は操作可能", () => {
    expect(canModifyTimeEntry("user_1", "user_1")).toBe(true);
  });

  test("他人の記録は操作不可", () => {
    expect(canModifyTimeEntry("user_1", "user_2")).toBe(false);
  });
});

describe("isValidTimeEntryName", () => {
  test("通常の文字列は有効", () => {
    expect(isValidTimeEntryName("資料作成")).toBe(true);
  });

  test("未指定（undefined）は有効（タスク名は任意）", () => {
    expect(isValidTimeEntryName(undefined)).toBe(true);
  });

  test("null は無効（明示的にnullを送るのは不正入力として扱う）", () => {
    expect(isValidTimeEntryName(null)).toBe(false);
  });

  test("空文字は無効", () => {
    expect(isValidTimeEntryName("")).toBe(false);
  });

  test("空白のみは無効", () => {
    expect(isValidTimeEntryName("   ")).toBe(false);
  });

  test("201文字以上は無効", () => {
    expect(isValidTimeEntryName("あ".repeat(201))).toBe(false);
  });

  test("200文字ちょうどは有効", () => {
    expect(isValidTimeEntryName("あ".repeat(200))).toBe(true);
  });

  test("文字列以外は無効", () => {
    expect(isValidTimeEntryName(123)).toBe(false);
  });
});

describe("isValidPlannedDurationMinutes", () => {
  test("正の整数は有効", () => {
    expect(isValidPlannedDurationMinutes(30)).toBe(true);
  });

  test("未指定（undefined）は有効（計画時間なしは許容）", () => {
    expect(isValidPlannedDurationMinutes(undefined)).toBe(true);
  });

  test("0は有効", () => {
    expect(isValidPlannedDurationMinutes(0)).toBe(true);
  });

  test("負の値は無効", () => {
    expect(isValidPlannedDurationMinutes(-1)).toBe(false);
  });

  test("小数は無効", () => {
    expect(isValidPlannedDurationMinutes(1.5)).toBe(false);
  });

  test("数値以外は無効", () => {
    expect(isValidPlannedDurationMinutes("30")).toBe(false);
  });

  test("null は無効", () => {
    expect(isValidPlannedDurationMinutes(null)).toBe(false);
  });
});

describe("isValidDeviationReason", () => {
  test("通常の文字列は有効", () => {
    expect(isValidDeviationReason("会議が延びた")).toBe(true);
  });

  test("未指定（undefined）は有効（乖離理由は任意）", () => {
    expect(isValidDeviationReason(undefined)).toBe(true);
  });

  test("500文字ちょうどは有効", () => {
    expect(isValidDeviationReason("あ".repeat(500))).toBe(true);
  });

  test("501文字以上は無効", () => {
    expect(isValidDeviationReason("あ".repeat(501))).toBe(false);
  });

  test("文字列以外は無効", () => {
    expect(isValidDeviationReason(123)).toBe(false);
    expect(isValidDeviationReason(null)).toBe(false);
  });
});

describe("calcActualDurationMinutes", () => {
  test("休憩無しなら経過時間そのまま（分に切り捨て）", () => {
    const startedAt = new Date("2026-07-29T10:00:00.000Z");
    const endedAt = new Date("2026-07-29T10:30:00.000Z");
    expect(calcActualDurationMinutes(startedAt, endedAt, 0)).toBe(30);
  });

  test("累積休憩時間を差し引く", () => {
    const startedAt = new Date("2026-07-29T10:00:00.000Z");
    const endedAt = new Date("2026-07-29T10:30:00.000Z");
    expect(calcActualDurationMinutes(startedAt, endedAt, 300)).toBe(25); // 30分 - 5分
  });

  test("端数の秒は切り捨てる", () => {
    const startedAt = new Date("2026-07-29T10:00:00.000Z");
    const endedAt = new Date("2026-07-29T10:00:59.000Z");
    expect(calcActualDurationMinutes(startedAt, endedAt, 0)).toBe(0);
  });

  test("休憩時間が経過時間を上回っても負にならない（0扱い）", () => {
    const startedAt = new Date("2026-07-29T10:00:00.000Z");
    const endedAt = new Date("2026-07-29T10:05:00.000Z");
    expect(calcActualDurationMinutes(startedAt, endedAt, 3600)).toBe(0);
  });
});

describe("accumulateBreakSeconds", () => {
  test("休憩時間を累積に加算する", () => {
    const breakStartedAt = new Date("2026-07-29T10:00:00.000Z");
    const resumedAt = new Date("2026-07-29T10:05:00.000Z");
    expect(accumulateBreakSeconds(breakStartedAt, resumedAt, 60)).toBe(360); // 60 + 300
  });

  test("既存の累積が0でも正しく加算する", () => {
    const breakStartedAt = new Date("2026-07-29T10:00:00.000Z");
    const resumedAt = new Date("2026-07-29T10:00:10.000Z");
    expect(accumulateBreakSeconds(breakStartedAt, resumedAt, 0)).toBe(10);
  });

  test("端数の秒は切り捨てる", () => {
    const breakStartedAt = new Date("2026-07-29T10:00:00.000Z");
    const resumedAt = new Date("2026-07-29T10:00:00.900Z");
    expect(accumulateBreakSeconds(breakStartedAt, resumedAt, 0)).toBe(0);
  });
});
