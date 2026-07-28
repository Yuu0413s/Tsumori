import { describe, expect, test } from "bun:test";
import { isLocalDev, type Bindings } from "./env.js";

function bindings(overrides: Partial<Bindings> = {}): Bindings {
  return {
    ENVIRONMENT: "development",
    DATABASE_URL: "postgresql://user:pass@localhost/db",
    BETTER_AUTH_SECRET: "secret",
    BETTER_AUTH_URL: "http://localhost:8787",
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    ...overrides,
  };
}

describe("isLocalDev", () => {
  test("BETTER_AUTH_URL が http://localhost のとき true", () => {
    expect(isLocalDev(bindings({ BETTER_AUTH_URL: "http://localhost:8787" }))).toBe(true);
  });

  test("BETTER_AUTH_URL が本番ドメインのとき false", () => {
    expect(isLocalDev(bindings({ BETTER_AUTH_URL: "https://tsumori.yuu0413.com" }))).toBe(false);
  });

  test("ENVIRONMENT が development でも BETTER_AUTH_URL が本番ドメインなら false（wrangler.jsonc の ENVIRONMENT は本番でも development のままのため信頼しない）", () => {
    expect(
      isLocalDev(
        bindings({ ENVIRONMENT: "development", BETTER_AUTH_URL: "https://tsumori.yuu0413.com" }),
      ),
    ).toBe(false);
  });

  test("BETTER_AUTH_URL が未設定(undefined)でも例外を投げず false を返す（/health等の認証不要ルートを巻き込まないため）", () => {
    const withoutUrl = bindings({ BETTER_AUTH_URL: undefined as unknown as string });
    expect(isLocalDev(withoutUrl)).toBe(false);
  });

  test("BETTER_AUTH_URL が URL としてパースできない文字列でも例外を投げず false を返す", () => {
    expect(isLocalDev(bindings({ BETTER_AUTH_URL: "not-a-url" }))).toBe(false);
  });

  test("hostname が localhost に前方一致するだけの紛らわしい値（なりすまし）は false（厳密な host 一致のみ true）", () => {
    expect(isLocalDev(bindings({ BETTER_AUTH_URL: "http://localhost.evil.example" }))).toBe(false);
  });

  test("127.0.0.1 も http のときは local dev として true", () => {
    expect(isLocalDev(bindings({ BETTER_AUTH_URL: "http://127.0.0.1:8787" }))).toBe(true);
  });

  test("localhost でも https のときは false（ローカルは http 前提のため）", () => {
    expect(isLocalDev(bindings({ BETTER_AUTH_URL: "https://localhost:8787" }))).toBe(false);
  });
});
