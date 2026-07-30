import { describe, expect, test } from "bun:test";
import {
  isValidBreakExtendsDeadline,
  isValidSoundEnabled,
  isValidPreAlarmMinutes,
} from "./settings.js";

describe("isValidBreakExtendsDeadline", () => {
  test("真偽値は有効", () => {
    expect(isValidBreakExtendsDeadline(true)).toBe(true);
    expect(isValidBreakExtendsDeadline(false)).toBe(true);
  });

  test("真偽値以外は無効", () => {
    expect(isValidBreakExtendsDeadline("true")).toBe(false);
    expect(isValidBreakExtendsDeadline(1)).toBe(false);
    expect(isValidBreakExtendsDeadline(null)).toBe(false);
    expect(isValidBreakExtendsDeadline(undefined)).toBe(false);
  });
});

describe("isValidSoundEnabled", () => {
  test("真偽値は有効", () => {
    expect(isValidSoundEnabled(true)).toBe(true);
    expect(isValidSoundEnabled(false)).toBe(true);
  });

  test("真偽値以外は無効", () => {
    expect(isValidSoundEnabled("false")).toBe(false);
    expect(isValidSoundEnabled(0)).toBe(false);
    expect(isValidSoundEnabled(null)).toBe(false);
  });
});

describe("isValidPreAlarmMinutes", () => {
  test("null は有効（予告なし）", () => {
    expect(isValidPreAlarmMinutes(null)).toBe(true);
  });

  test("0〜1440の整数は有効", () => {
    expect(isValidPreAlarmMinutes(0)).toBe(true);
    expect(isValidPreAlarmMinutes(5)).toBe(true);
    expect(isValidPreAlarmMinutes(1440)).toBe(true);
  });

  test("負の値は無効", () => {
    expect(isValidPreAlarmMinutes(-1)).toBe(false);
  });

  test("上限（1440分）を超えたら無効", () => {
    expect(isValidPreAlarmMinutes(1441)).toBe(false);
  });

  test("整数以外は無効", () => {
    expect(isValidPreAlarmMinutes(5.5)).toBe(false);
  });

  test("文字列やundefinedは無効", () => {
    expect(isValidPreAlarmMinutes("5")).toBe(false);
    expect(isValidPreAlarmMinutes(undefined)).toBe(false);
  });
});
