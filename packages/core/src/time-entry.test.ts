import { describe, expect, test } from "bun:test";
import {
  canModifyTimeEntry,
  isValidTimeEntryName,
  isValidPlannedDurationMinutes,
  isValidDeviationReason,
  isValidDeviationFocused,
  calcActualDurationMinutes,
  accumulateBreakSeconds,
  calcElapsedSeconds,
  isSignificantDeviation,
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

  test("1440分（24時間）ちょうどは有効", () => {
    expect(isValidPlannedDurationMinutes(1440)).toBe(true);
  });

  test("1441分以上は無効（1回のセッションとして非現実的な値は弾く）", () => {
    expect(isValidPlannedDurationMinutes(1441)).toBe(false);
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

describe("isValidDeviationFocused", () => {
  test("true は有効", () => {
    expect(isValidDeviationFocused(true)).toBe(true);
  });

  test("false は有効", () => {
    expect(isValidDeviationFocused(false)).toBe(true);
  });

  test("未指定（undefined）は有効（乖離モーダルを出さなかった場合は送られない）", () => {
    expect(isValidDeviationFocused(undefined)).toBe(true);
  });

  test("null は無効（明示的にnullを送るのは不正入力として扱う）", () => {
    expect(isValidDeviationFocused(null)).toBe(false);
  });

  test("真偽値以外は無効", () => {
    expect(isValidDeviationFocused("true")).toBe(false);
    expect(isValidDeviationFocused(1)).toBe(false);
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

describe("calcElapsedSeconds", () => {
  const startedAt = new Date("2026-07-29T10:00:00.000Z");

  test("作業中は startedAt から now までの経過秒数を返す", () => {
    const entry = {
      status: "working" as const,
      startedAt,
      breakStartedAt: null,
      totalBreakSeconds: 0,
    };
    const now = new Date("2026-07-29T10:00:30.000Z");
    expect(calcElapsedSeconds(entry, now)).toBe(30);
  });

  test("作業中は累積休憩時間を差し引く", () => {
    const entry = {
      status: "working" as const,
      startedAt,
      breakStartedAt: null,
      totalBreakSeconds: 300,
    };
    const now = new Date("2026-07-29T10:10:00.000Z");
    expect(calcElapsedSeconds(entry, now)).toBe(300); // 600 - 300
  });

  test("休憩中は breakStartedAt 時点で経過時間が止まる（now が進んでも変わらない）", () => {
    const entry = {
      status: "on_break" as const,
      startedAt,
      breakStartedAt: new Date("2026-07-29T10:05:00.000Z"),
      totalBreakSeconds: 0,
    };
    expect(calcElapsedSeconds(entry, new Date("2026-07-29T10:05:00.000Z"))).toBe(300);
    expect(calcElapsedSeconds(entry, new Date("2026-07-29T10:30:00.000Z"))).toBe(300);
  });

  test("on_break なのに breakStartedAt が未設定（本来あり得ない不整合値）なら working 扱いで now まで進める", () => {
    // startBreak は status と breakStartedAt を必ず同時にセットするため実運用では
    // 起きないが、型上は breakStartedAt: Date | null を許容している。
    // ここでは意図した（フォールバックする）挙動であることを固定しておく。
    const entry = {
      status: "on_break" as const,
      startedAt,
      breakStartedAt: null,
      totalBreakSeconds: 0,
    };
    const now = new Date("2026-07-29T10:00:30.000Z");
    expect(calcElapsedSeconds(entry, now)).toBe(30);
  });

  test("休憩を挟んで再開後は、その時点までの累積休憩時間を差し引く", () => {
    const entry = {
      status: "working" as const,
      startedAt,
      breakStartedAt: null,
      totalBreakSeconds: 120,
    };
    const now = new Date("2026-07-29T10:05:00.000Z"); // 300秒経過
    expect(calcElapsedSeconds(entry, now)).toBe(180); // 300 - 120
  });

  test("休憩時間が経過時間を上回っても負にならない（0扱い）", () => {
    const entry = {
      status: "working" as const,
      startedAt,
      breakStartedAt: null,
      totalBreakSeconds: 3600,
    };
    const now = new Date("2026-07-29T10:00:10.000Z");
    expect(calcElapsedSeconds(entry, now)).toBe(0);
  });

  test("端数の秒は切り捨てる", () => {
    const entry = {
      status: "working" as const,
      startedAt,
      breakStartedAt: null,
      totalBreakSeconds: 0,
    };
    const now = new Date("2026-07-29T10:00:00.900Z");
    expect(calcElapsedSeconds(entry, now)).toBe(0);
  });
});

describe("isSignificantDeviation", () => {
  test("計画時間が未設定（null）なら常に false（比較対象が無い）", () => {
    expect(isSignificantDeviation(null, 9999)).toBe(false);
  });

  test("実績が計画より10分以上長い場合は true（境界値ちょうど）", () => {
    expect(isSignificantDeviation(30, 40)).toBe(true);
  });

  test("実績が計画より9分長い場合は false（境界値の1つ内側）", () => {
    expect(isSignificantDeviation(30, 39)).toBe(false);
  });

  test("実績が計画より10分以上短い場合も true（短すぎる方向の乖離）", () => {
    expect(isSignificantDeviation(30, 20)).toBe(true);
  });

  test("実績と計画がぴったり一致する場合は false", () => {
    expect(isSignificantDeviation(30, 30)).toBe(false);
  });
});
