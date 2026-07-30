import { Navigate, Outlet } from "react-router";
import { useSession as defaultUseSession } from "../lib/auth-client.js";
import { LoadingScreen } from "./LoadingScreen.js";

type SessionResult = {
  data: { user: { id: string } } | null | undefined;
  isPending: boolean;
};

type UseSessionHook = () => SessionResult;

/**
 * セッション取得手段を差し替え可能にしている。better-auth 本体（Cookie/Google）
 * に依存せず、未ログイン/読み込み中/ログイン済みの3分岐だけを単体テストするための設計。
 * apps/api の requireAuth（Issue #6）と同じ考え方。
 */
export function createRequireAuth(useSession: UseSessionHook = defaultUseSession) {
  return function RequireAuth() {
    const { data: session, isPending } = useSession();

    if (isPending) {
      return <LoadingScreen />;
    }

    if (!session) {
      return <Navigate to="/login" replace />;
    }

    return <Outlet />;
  };
}

export const RequireAuth = createRequireAuth();
