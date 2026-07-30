import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { createRequireGuest } from "./RequireGuest.js";

function renderWithSession(useSession: Parameters<typeof createRequireGuest>[0]) {
  const RequireGuest = createRequireGuest(useSession);
  const router = createMemoryRouter(
    [
      {
        element: <RequireGuest />,
        children: [{ path: "/login", element: <div>ログイン画面</div> }],
      },
      { path: "/", element: <div>保護された画面</div> },
    ],
    { initialEntries: ["/login"] },
  );

  return render(<RouterProvider router={router} />);
}

describe("RequireGuest", () => {
  test("読み込み中はローディング画面を表示する", () => {
    renderWithSession(() => ({ data: null, isPending: true }));

    expect(screen.getByText("読み込み中…")).toBeTruthy();
  });

  test("未ログインならログイン画面を表示する", () => {
    renderWithSession(() => ({ data: null, isPending: false }));

    expect(screen.getByText("ログイン画面")).toBeTruthy();
  });

  test("ログイン済みなら / にリダイレクトする", () => {
    renderWithSession(() => ({ data: { user: { id: "user_1" } }, isPending: false }));

    expect(screen.getByText("保護された画面")).toBeTruthy();
  });
});
