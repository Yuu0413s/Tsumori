import { describe, expect, mock, spyOn, test } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createLoginPage } from "./LoginPage.js";

describe("LoginPage", () => {
  test("見出しとTsumoriの説明文を表示する", () => {
    const LoginPage = createLoginPage(mock(() => Promise.resolve()));
    render(<LoginPage />);

    expect(screen.getByText("Tsumori")).toBeTruthy();
    expect(screen.getByText("「つもりだった時間」と「実際」の差を記録する")).toBeTruthy();
  });

  test("旧アプリからの移行ユーザー向けの案内を表示する", () => {
    const LoginPage = createLoginPage(mock(() => Promise.resolve()));
    render(<LoginPage />);

    expect(
      screen.getByText("以前パスワードでログインしていた方も、Googleボタンからお入りください"),
    ).toBeTruthy();
  });

  test("ボタン押下でGoogleログインをcallbackURL「/」で呼び出す", () => {
    const signInSocial = mock(() => Promise.resolve());
    const LoginPage = createLoginPage(signInSocial);
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Googleでログイン" }));

    expect(signInSocial).toHaveBeenCalledWith({ provider: "google", callbackURL: "/" });
  });

  test("ログインに失敗してもエラーを握りつぶさずコンソールに出す", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    const signInSocial = mock(() => Promise.reject(new Error("network error")));
    const LoginPage = createLoginPage(signInSocial);
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Googleでログイン" }));

    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    consoleError.mockRestore();
  });
});
