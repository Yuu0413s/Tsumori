import { describe, expect, test } from "bun:test";
import { toUtcDateString } from "./date.js";

describe("toUtcDateString", () => {
  test("UTC基準の YYYY-MM-DD を返す", () => {
    expect(toUtcDateString(new Date("2026-07-29T12:00:00.000Z"))).toBe("2026-07-29");
  });

  test("日付の境界（UTC 0時ちょうど）", () => {
    expect(toUtcDateString(new Date("2026-07-29T00:00:00.000Z"))).toBe("2026-07-29");
  });

  test("UTCで日付が変わる時刻（現地時間とはズレうる）", () => {
    expect(toUtcDateString(new Date("2026-07-29T23:59:59.000Z"))).toBe("2026-07-29");
  });
});
