import { createMiddleware } from "hono/factory";
import type { Context } from "hono";

export type AuthVariables = {
  userId: string;
};

type Session = { user: { id: string } };
type GetSession<E extends { Variables: AuthVariables }> = (
  c: Context<E>,
) => Promise<Session | null>;

/**
 * セッション取得手段を差し替え可能にしている。
 * DB/Google に依存する better-auth 本体を経由せずに 401 分岐だけを
 * 単体テストできるようにするための設計（Issue #6）。
 *
 * better-auth の api.getSession は「未ログイン」では null を返すだけで、
 * 例外を投げるのは DB障害などの内部エラーをラップした場合のみ。
 * そのため例外は401（未ログイン）と区別し、500として扱う
 * （Codexレビュー対応：401にまとめると障害検知の指標が歪む）。
 */
export function requireAuth<E extends { Variables: AuthVariables }>(getSession: GetSession<E>) {
  return createMiddleware<E>(async (c, next) => {
    let session: Session | null;
    try {
      session = await getSession(c);
    } catch (error) {
      console.error("requireAuth: getSession failed", error);
      return c.json({ error: "Internal Server Error" }, 500);
    }

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("userId", session.user.id);
    await next();
  });
}
