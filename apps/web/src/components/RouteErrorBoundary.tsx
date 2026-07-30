import { useRouteError } from "react-router";
import { ErrorMessage } from "./ErrorMessage.js";

export function RouteErrorBoundary() {
  const error = useRouteError();
  // ここに来る例外はAPIエラーに限らない（Reactのレンダー例外等も含む）ため、
  // 内部の詳細をそのままユーザーに見せず、開発者向けにログだけ残す。
  console.error(error);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <ErrorMessage message="問題が発生しました。時間をおいて再度お試しください。" />
      </div>
    </div>
  );
}
