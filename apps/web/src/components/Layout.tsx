import { NavLink, Outlet } from "react-router";
import { signOut } from "../lib/auth-client.js";

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return `text-sm font-medium ${isActive ? "text-gray-900" : "text-gray-500 hover:text-gray-700"}`;
}

export function Layout() {
  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-bold text-gray-900">Tsumori</span>
          <button
            type="button"
            onClick={() => void signOut().catch((error: unknown) => console.error(error))}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ログアウト
          </button>
        </div>
        <nav className="flex gap-4 px-4 pb-2">
          <NavLink to="/" end className={navLinkClassName}>
            タイマー
          </NavLink>
          <NavLink to="/summary" className={navLinkClassName}>
            サマリー
          </NavLink>
        </nav>
      </header>
      <main className="px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
