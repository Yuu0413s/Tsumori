import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { NotFoundPage } from "./NotFoundPage.js";

function renderNotFound() {
  const router = createMemoryRouter(
    [
      { path: "/", element: <div>タイマー画面</div> },
      { path: "*", element: <NotFoundPage /> },
    ],
    { initialEntries: ["/foo"] },
  );
  return render(<RouterProvider router={router} />);
}

describe("NotFoundPage", () => {
  test("存在しないパスでは見出しと案内文を表示する", () => {
    renderNotFound();

    expect(screen.getByText("ページが見つかりません")).toBeTruthy();
  });

  test("タイマー画面へ戻るリンクを表示する", () => {
    renderNotFound();

    const link = screen.getByRole("link", { name: "タイマー画面に戻る" });
    expect(link.getAttribute("href")).toBe("/");
  });
});
