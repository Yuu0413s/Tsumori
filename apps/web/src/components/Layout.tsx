import { Outlet } from "react-router";
import { signOut } from "../lib/auth-client.js";

export function Layout() {
  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <span className="font-bold text-gray-900">Tsumori</span>
        <button
          type="button"
          onClick={() => void signOut().catch((error: unknown) => console.error(error))}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ログアウト
        </button>
      </header>
      <main className="px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
