import { describe, expect, test } from "bun:test";
import { formatDuration, parseDurationMinutes } from "./duration.js";

describe("formatDuration", () => {
  test("0秒は 00:00:00", () => {
    expect(formatDuration(0)).toBe("00:00:00");
  });

  test("分と秒に繰り上がる", () => {
    expect(formatDuration(61)).toBe("00:01:01");
  });

  test("時間に繰り上がる", () => {
    expect(formatDuration(3661)).toBe("01:01:01");
  });

  test("負の値は 0 として扱う", () => {
    expect(formatDuration(-5)).toBe("00:00:00");
  });

  test("小数は切り捨てる", () => {
    expect(formatDuration(59.9)).toBe("00:00:59");
  });

  test("NaN は 00:00:00", () => {
    expect(formatDuration(NaN)).toBe("00:00:00");
  });

  test("Infinity は 00:00:00", () => {
    expect(formatDuration(Infinity)).toBe("00:00:00");
  });
});

describe("parseDurationMinutes", () => {
  test("分を秒に変換する", () => {
    expect(parseDurationMinutes(30)).toBe(1800);
  });

  test("0分は0秒に変換する", () => {
    expect(parseDurationMinutes(0)).toBe(0);
  });

  test("null はそのまま null", () => {
    expect(parseDurationMinutes(null)).toBeNull();
  });

  test("undefined はそのまま null", () => {
    expect(parseDurationMinutes(undefined)).toBeNull();
  });

  test("負の値は null", () => {
    expect(parseDurationMinutes(-1)).toBeNull();
  });
});
