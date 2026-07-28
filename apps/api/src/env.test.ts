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
});
