import { formatDuration } from "@tsumori/core";
import { useMe } from "../hooks/use-me.js";
import { ErrorMessage } from "../components/ErrorMessage.js";
import { LoadingScreen } from "../components/LoadingScreen.js";
import { formatApiError } from "../lib/format-error.js";

export function DashboardPage() {
  const { data, isPending, error } = useMe();

  if (isPending) {
    return <LoadingScreen />;
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
      <p className="font-mono text-4xl tabular-nums text-gray-900">{formatDuration(3661)}</p>
      {error ? (
        <ErrorMessage message={formatApiError(error)} />
      ) : (
        <p className="text-sm text-gray-600">ログイン中のユーザーID: {data?.userId}</p>
      )}
    </div>
  );
}
