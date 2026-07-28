import { describe, expect, test } from "bun:test";
import { calcDeadline, shouldFireAlarm, type AlarmEntry } from "./alarm.js";

const startedAt = new Date("2026-07-28T10:00:00.000Z");
// 休憩中でないケースでは now は結果に影響しないが、必須引数なので適当な値を渡す
const arbitraryNow = new Date("2026-07-28T10:20:00.000Z");

function baseEntry(overrides: Partial<AlarmEntry> = {}): AlarmEntry {
  return {
    startedAt,
    plannedDurationMinutes: 30,
    totalBreakSeconds: 0,
    breakStartedAt: null,
    breakExtendsDeadline: true,
    ...overrides,
  };
}

describe("calcDeadline", () => {
  test("休憩なし × 延ばす: 開始 + 計画時間", () => {
    const entry = baseEntry({ breakExtendsDeadline: true });
    expect(calcDeadline(entry, arbitraryNow)).toEqual(new Date("2026-07-28T10:30:00.000Z"));
  });

  test("休憩なし × 延ばさない: 開始 + 計画時間", () => {
    const entry = baseEntry({ breakExtendsDeadline: false });
    expect(calcDeadline(entry, arbitraryNow)).toEqual(new Date("2026-07-28T10:30:00.000Z"));
  });

  test("休憩あり（完了） × 延ばす: 累積休憩ぶん締切が後ろにずれる", () => {
    const entry = baseEntry({ breakExtendsDeadline: true, totalBreakSeconds: 300 });
    expect(calcDeadline(entry, arbitraryNow)).toEqual(new Date("2026-07-28T10:35:00.000Z"));
  });

  test("休憩あり（完了） × 延ばさない: 締切は動かない（壁時計）", () => {
    const entry = baseEntry({ breakExtendsDeadline: false, totalBreakSeconds: 300 });
    expect(calcDeadline(entry, arbitraryNow)).toEqual(new Date("2026-07-28T10:30:00.000Z"));
  });

  test("休憩中 × 延ばす: 現在休憩中の経過分も締切に加算する", () => {
    const entry = baseEntry({
      breakExtendsDeadline: true,
      totalBreakSeconds: 60,
      breakStartedAt: new Date("2026-07-28T10:10:00.000Z"),
    });
    const now = new Date("2026-07-28T10:15:00.000Z"); // 休憩開始から5分経過
    expect(calcDeadline(entry, now)).toEqual(new Date("2026-07-28T10:36:00.000Z"));
  });

  test("休憩中 × 延ばさない: 休憩中でも締切は動かない（壁時計）", () => {
    const entry = baseEntry({
      breakExtendsDeadline: false,
      totalBreakSeconds: 60,
      breakStartedAt: new Date("2026-07-28T10:10:00.000Z"),
    });
    const now = new Date("2026-07-28T10:15:00.000Z");
    expect(calcDeadline(entry, now)).toEqual(new Date("2026-07-28T10:30:00.000Z"));
  });

  test("plannedDurationMinutes が null なら締切なし", () => {
    const entry = baseEntry({ plannedDurationMinutes: null });
    expect(calcDeadline(entry, arbitraryNow)).toBeNull();
  });
});

describe("shouldFireAlarm", () => {
  test("締切前なら発火しない", () => {
    const entry = baseEntry({ breakExtendsDeadline: false });
    const now = new Date("2026-07-28T10:29:59.000Z");
    expect(shouldFireAlarm(entry, now)).toBe(false);
  });

  test("締切ちょうどなら発火する（境界値）", () => {
    const entry = baseEntry({ breakExtendsDeadline: false });
    const now = new Date("2026-07-28T10:30:00.000Z");
    expect(shouldFireAlarm(entry, now)).toBe(true);
  });

  test("締切後なら発火する", () => {
    const entry = baseEntry({ breakExtendsDeadline: false });
    const now = new Date("2026-07-28T10:31:00.000Z");
    expect(shouldFireAlarm(entry, now)).toBe(true);
  });

  test("延ばす設定かつ休憩中なら、締切を過ぎていても発火しない", () => {
    const entry = baseEntry({
      breakExtendsDeadline: true,
      breakStartedAt: new Date("2026-07-28T10:05:00.000Z"),
    });
    const now = new Date("2026-07-28T11:00:00.000Z"); // 素の締切(10:30)をとうに過ぎている
    expect(shouldFireAlarm(entry, now)).toBe(false);
  });

  test("延ばさない設定なら、休憩中でも締切を過ぎていれば発火する", () => {
    const entry = baseEntry({
      breakExtendsDeadline: false,
      breakStartedAt: new Date("2026-07-28T10:05:00.000Z"),
    });
    const now = new Date("2026-07-28T10:30:00.000Z");
    expect(shouldFireAlarm(entry, now)).toBe(true);
  });

  test("休憩から復帰した直後は、延ばした締切基準で正しく判定する（状態遷移の境界）", () => {
    const entry = baseEntry({
      breakExtendsDeadline: true,
      totalBreakSeconds: 600, // 休憩が終わって累積10分になった
      breakStartedAt: null, // 休憩から復帰済み
    });
    const beforeExtendedDeadline = new Date("2026-07-28T10:39:59.000Z");
    const atExtendedDeadline = new Date("2026-07-28T10:40:00.000Z");
    expect(shouldFireAlarm(entry, beforeExtendedDeadline)).toBe(false);
    expect(shouldFireAlarm(entry, atExtendedDeadline)).toBe(true);
  });

  test("plannedDurationMinutes が null なら発火しない", () => {
    const entry = baseEntry({ plannedDurationMinutes: null });
    const now = new Date("2026-07-28T12:00:00.000Z");
    expect(shouldFireAlarm(entry, now)).toBe(false);
  });
});
