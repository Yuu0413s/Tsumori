import { describe, expect, test } from "bun:test";
import { ensureOk } from "./ensure-ok.js";

describe("ensureOk", () => {
  test("ok なレスポンスはそのまま返す", async () => {
    const res = new Response(JSON.stringify({ ok: true }), { status: 200 });

    expect(await ensureOk(res)).toBe(res);
  });

  test("エラーレスポンスは { error } のメッセージで throw する", async () => {
    const res = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    await expect(ensureOk(res)).rejects.toThrow("Unauthorized");
  });

  test("JSONボディが無い場合（境界値）でもステータスコード付きの文言で throw する", async () => {
    const res = new Response("", { status: 500 });

    await expect(ensureOk(res)).rejects.toThrow("リクエストに失敗しました（500）");
  });
});
