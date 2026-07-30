import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";

const useMeMock = mock();
const useSettingsMock = mock();
const useUpdateSettingsMock = mock();
const useCategoriesMock = mock();
const useCreateCategoryMock = mock();
const useUpdateCategoryMock = mock();
const useHideCategoryMock = mock();
const signOutMock = mock(() => Promise.resolve());

mock.module("../hooks/use-me.js", () => ({
  useMe: useMeMock,
}));
mock.module("../hooks/use-settings.js", () => ({
  useSettings: useSettingsMock,
  useUpdateSettings: useUpdateSettingsMock,
}));
mock.module("../hooks/use-categories.js", () => ({
  useCategories: useCategoriesMock,
  useCreateCategory: useCreateCategoryMock,
  useUpdateCategory: useUpdateCategoryMock,
  useHideCategory: useHideCategoryMock,
}));
mock.module("../lib/auth-client.js", () => ({
  signOut: signOutMock,
}));

const { SettingsPage } = await import("./SettingsPage.js");

function mutationResult(
  overrides: Partial<{ mutate: unknown; isPending: boolean; error: unknown }> = {},
) {
  return { mutate: mock(), isPending: false, error: null, ...overrides };
}

function settings(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user_1",
    breakExtendsDeadline: true,
    soundEnabled: true,
    preAlarmMinutes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function category(overrides: Record<string, unknown> = {}) {
  return {
    id: "cat_1",
    userId: "user_1",
    name: "仕事",
    color: "#3b82f6",
    isActive: true,
    createdAt: null,
    ...overrides,
  };
}

describe("SettingsPage", () => {
  beforeEach(() => {
    useMeMock.mockReturnValue({ data: { userId: "user_1" }, isPending: false, error: null });
    useUpdateSettingsMock.mockReturnValue(mutationResult());
    useCreateCategoryMock.mockReturnValue(mutationResult());
    useUpdateCategoryMock.mockReturnValue(mutationResult());
    useHideCategoryMock.mockReturnValue(mutationResult());
    signOutMock.mockClear();
  });

  test("読み込み中はローディング画面を表示する", () => {
    useSettingsMock.mockReturnValue({ data: undefined, isPending: true, error: null });
    useCategoriesMock.mockReturnValue({ data: undefined, isPending: true, error: null });

    render(<SettingsPage />);

    expect(screen.getByText("読み込み中…")).toBeTruthy();
  });

  test("取得に失敗したらエラーを表示する", () => {
    useSettingsMock.mockReturnValue({
      data: undefined,
      isPending: false,
      error: new Error("サーバーに接続できませんでした。通信環境を確認してください。"),
    });
    useCategoriesMock.mockReturnValue({ data: [], isPending: false, error: null });

    render(<SettingsPage />);

    expect(
      screen.getByText("サーバーに接続できませんでした。通信環境を確認してください。"),
    ).toBeTruthy();
  });

  describe("設定・カテゴリの取得に成功した場合", () => {
    beforeEach(() => {
      useSettingsMock.mockReturnValue({ data: settings(), isPending: false, error: null });
      useCategoriesMock.mockReturnValue({ data: [category()], isPending: false, error: null });
    });

    test("現在の休憩延長トグルの状態を表示する", () => {
      render(<SettingsPage />);

      const extend = screen.getByRole("button", { name: "延ばす" });
      expect(extend.getAttribute("aria-pressed")).toBe("true");
    });

    test("「延ばさない」を押すとbreakExtendsDeadline: falseで更新する", () => {
      const mutate = mock();
      useUpdateSettingsMock.mockReturnValue(mutationResult({ mutate }));

      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: "延ばさない" }));

      expect(mutate).toHaveBeenCalledWith({ breakExtendsDeadline: false });
    });

    test("アラーム音のOFFを押すとsoundEnabled: falseで更新する", () => {
      const mutate = mock();
      useUpdateSettingsMock.mockReturnValue(mutationResult({ mutate }));

      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: "OFF" }));

      expect(mutate).toHaveBeenCalledWith({ soundEnabled: false });
    });

    test("予告時間を選ぶとpreAlarmMinutesで更新する", () => {
      const mutate = mock();
      useUpdateSettingsMock.mockReturnValue(mutationResult({ mutate }));

      render(<SettingsPage />);
      fireEvent.change(screen.getByLabelText("何分前に予告するか"), { target: { value: "5" } });

      expect(mutate).toHaveBeenCalledWith({ preAlarmMinutes: 5 });
    });

    test("予告時間を「なし」にするとpreAlarmMinutes: nullで更新する", () => {
      const mutate = mock();
      useSettingsMock.mockReturnValue({
        data: settings({ preAlarmMinutes: 5 }),
        isPending: false,
        error: null,
      });
      useUpdateSettingsMock.mockReturnValue(mutationResult({ mutate }));

      render(<SettingsPage />);
      fireEvent.change(screen.getByLabelText("何分前に予告するか"), { target: { value: "" } });

      expect(mutate).toHaveBeenCalledWith({ preAlarmMinutes: null });
    });

    test("設定更新中はトグル・選択を無効化する（多重送信防止）", () => {
      useUpdateSettingsMock.mockReturnValue(mutationResult({ isPending: true }));

      render(<SettingsPage />);

      const extend = screen.getByRole("button", { name: "延ばす" }) as HTMLButtonElement;
      const select = screen.getByLabelText("何分前に予告するか") as HTMLSelectElement;
      expect(extend.disabled).toBe(true);
      expect(select.disabled).toBe(true);
    });

    test("設定更新のエラーを表示する", () => {
      useUpdateSettingsMock.mockReturnValue(
        mutationResult({ error: new Error("更新に失敗しました") }),
      );

      render(<SettingsPage />);

      expect(screen.getByText("更新に失敗しました")).toBeTruthy();
    });

    test("カテゴリ一覧を表示する", () => {
      render(<SettingsPage />);

      expect(screen.getByText("仕事")).toBeTruthy();
    });

    test("自分のカテゴリには編集・非表示ボタンが表示される", () => {
      render(<SettingsPage />);

      expect(screen.getByRole("button", { name: "編集" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "非表示" })).toBeTruthy();
    });

    test("共通カテゴリ（userId: null）には編集・非表示ボタンが表示されない", () => {
      useCategoriesMock.mockReturnValue({
        data: [category({ userId: null })],
        isPending: false,
        error: null,
      });

      render(<SettingsPage />);

      expect(screen.queryByRole("button", { name: "編集" })).toBeNull();
      expect(screen.queryByRole("button", { name: "非表示" })).toBeNull();
    });

    test("編集ボタンを押すと名前を編集でき、保存でupdateCategoryを呼ぶ", () => {
      const mutate = mock();
      useUpdateCategoryMock.mockReturnValue(mutationResult({ mutate }));

      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: "編集" }));
      fireEvent.change(screen.getByLabelText("仕事の名前"), { target: { value: "作業" } });
      fireEvent.click(screen.getByRole("button", { name: "保存" }));

      expect(mutate).toHaveBeenCalledWith({ id: "cat_1", name: "作業", color: "#3b82f6" });
    });

    test("編集をキャンセルすると更新を呼ばず表示に戻る", () => {
      const mutate = mock();
      useUpdateCategoryMock.mockReturnValue(mutationResult({ mutate }));

      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: "編集" }));
      fireEvent.change(screen.getByLabelText("仕事の名前"), { target: { value: "作業" } });
      fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

      expect(mutate).not.toHaveBeenCalled();
      expect(screen.getByText("仕事")).toBeTruthy();
    });

    test("非表示ボタンを押すとhideCategoryをカテゴリIDで呼ぶ", () => {
      const mutate = mock();
      useHideCategoryMock.mockReturnValue(mutationResult({ mutate }));

      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: "非表示" }));

      expect(mutate).toHaveBeenCalledWith("cat_1");
    });

    test("名前を入力して追加すると、trimしてcreateCategoryを呼ぶ", () => {
      const mutate = mock();
      useCreateCategoryMock.mockReturnValue(mutationResult({ mutate }));

      render(<SettingsPage />);
      fireEvent.change(screen.getByLabelText("新しいカテゴリ名"), {
        target: { value: " 趣味 " },
      });
      fireEvent.click(screen.getByRole("button", { name: "追加" }));

      expect(mutate).toHaveBeenCalledWith({ name: "趣味", color: "#3b82f6" });
    });

    test("カテゴリ名が空では追加ボタンが無効", () => {
      render(<SettingsPage />);

      const button = screen.getByRole("button", { name: "追加" }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    test("カテゴリ操作中は追加・編集・非表示ボタンをまとめて無効化する", () => {
      useHideCategoryMock.mockReturnValue(mutationResult({ isPending: true }));

      render(<SettingsPage />);

      const editButton = screen.getByRole("button", { name: "編集" }) as HTMLButtonElement;
      const hideButton = screen.getByRole("button", { name: "非表示" }) as HTMLButtonElement;
      expect(editButton.disabled).toBe(true);
      expect(hideButton.disabled).toBe(true);
    });

    test("ログアウトボタンを押すとsignOutを呼ぶ", async () => {
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: "ログアウト" }));

      expect(signOutMock).toHaveBeenCalled();
    });
  });
});
