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
 */
export function requireAuth<E extends { Variables: AuthVariables }>(getSession: GetSession<E>) {
  return createMiddleware<E>(async (c, next) => {
    const session = await getSession(c).catch(() => null);

    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("userId", session.user.id);
    await next();
  });
}
