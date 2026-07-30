import { describe, expect, test } from "bun:test";
import { formatApiError } from "./format-error.js";

describe("formatApiError", () => {
  test("TypeError（fetch自体の失敗）はネットワーク接続の文言にする", () => {
    expect(formatApiError(new TypeError("Failed to fetch"))).toBe(
      "サーバーに接続できませんでした。通信環境を確認してください。",
    );
  });

  test("通常の Error はそのメッセージをそのまま表示する", () => {
    expect(formatApiError(new Error("Unauthorized"))).toBe("Unauthorized");
  });

  test("Error インスタンスでない値（境界値）はフォールバック文言にする", () => {
    expect(formatApiError("plain string")).toBe("予期しないエラーが発生しました。");
    expect(formatApiError(undefined)).toBe("予期しないエラーが発生しました。");
  });
});
