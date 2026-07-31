import { describe, expect, test } from "bun:test";
import { shouldRetryQuery } from "./query-client.js";
import { UnauthorizedError } from "./unauthorized-error.js";

describe("shouldRetryQuery", () => {
  test("UnauthorizedError（セッション切れ）はリトライしない", () => {
    expect(shouldRetryQuery(0, new UnauthorizedError())).toBe(false);
  });

  test("それ以外のエラーは1回までリトライする", () => {
    expect(shouldRetryQuery(0, new Error("サーバーエラー"))).toBe(true);
  });

  test("1回失敗済み（境界値）ならそれ以上リトライしない", () => {
    expect(shouldRetryQuery(1, new Error("サーバーエラー"))).toBe(false);
  });
});
