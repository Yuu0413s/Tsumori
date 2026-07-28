import { describe, expect, spyOn, test } from "bun:test";
import { Hono } from "hono";
import { requireAuth, type AuthVariables } from "./require-auth.js";

function buildApp(getSession: Parameters<typeof requireAuth>[0]) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.get("/protected", requireAuth(getSession), (c) => c.json({ userId: c.get("userId") }));
  return app;
}

describe("requireAuth", () => {
  test("セッションが無いとき 401 を返す", async () => {
    const app = buildApp(async () => null);
    const res = await app.request("/protected");

    expect(res.status).toBe(401);
  });

  test("セッションがあるとき userId をセットして次に進む", async () => {
    const app = buildApp(async () => ({ user: { id: "user_1" } }));
    const res = await app.request("/protected");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { userId: string };
    expect(body).toEqual({ userId: "user_1" });
  });

  test("getSession が例外を投げたとき 500 を返し、サーバー側にログを残す（DB障害等を401と混同しない）", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    const app = buildApp(async () => {
      throw new Error("connection lost");
    });
    const res = await app.request("/protected");

    expect(res.status).toBe(500);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
