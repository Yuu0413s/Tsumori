import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { createRequireAuth } from "./RequireAuth.js";

function renderWithSession(useSession: Parameters<typeof createRequireAuth>[0]) {
  const RequireAuth = createRequireAuth(useSession);
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [{ path: "/", element: <div>保護された画面</div> }],
      },
      { path: "/login", element: <div>ログイン画面</div> },
    ],
    { initialEntries: ["/"] },
  );

  return render(<RouterProvider router={router} />);
}

describe("RequireAuth", () => {
  test("読み込み中はローディング画面を表示する", () => {
    renderWithSession(() => ({ data: null, isPending: true }));

    expect(screen.getByText("読み込み中…")).toBeTruthy();
  });

  test("未ログインなら /login にリダイレクトする", () => {
    renderWithSession(() => ({ data: null, isPending: false }));

    expect(screen.getByText("ログイン画面")).toBeTruthy();
  });

  test("ログイン済みなら保護された画面を表示する", () => {
    renderWithSession(() => ({ data: { user: { id: "user_1" } }, isPending: false }));

    expect(screen.getByText("保護された画面")).toBeTruthy();
  });
});
