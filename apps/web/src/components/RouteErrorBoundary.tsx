import { useRouteError } from "react-router";
import { formatApiError } from "../lib/format-error.js";
import { ErrorMessage } from "./ErrorMessage.js";

export function RouteErrorBoundary() {
  const error = useRouteError();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <ErrorMessage message={formatApiError(error)} />
      </div>
    </div>
  );
}
