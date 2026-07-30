import { Navigate, Outlet } from "react-router";
import { useSession as defaultUseSession } from "../lib/auth-client.js";
import { LoadingScreen } from "./LoadingScreen.js";

type SessionResult = {
  data: { user: { id: string } } | null | undefined;
  isPending: boolean;
};

type UseSessionHook = () => SessionResult;

/**
 * RequireAuth の逆方向のガード。ログイン済みユーザーが /login に入れてしまうと
 * 状態遷移として不自然になるため、その場合は "/" に戻す（Codexレビュー対応）。
 * DIの考え方は RequireAuth と同じ。
 */
export function createRequireGuest(useSession: UseSessionHook = defaultUseSession) {
  return function RequireGuest() {
    const { data: session, isPending } = useSession();

    if (isPending) {
      return <LoadingScreen />;
    }

    if (session) {
      return <Navigate to="/" replace />;
    }

    return <Outlet />;
  };
}

export const RequireGuest = createRequireGuest();
