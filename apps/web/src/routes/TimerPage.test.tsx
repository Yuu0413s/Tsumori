import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";

const useCurrentTimeEntryMock = mock();
const useCategoriesMock = mock();
const useStartTimeEntryMock = mock();
const useStartBreakMock = mock();
const useResumeTimeEntryMock = mock();
const useEndTimeEntryMock = mock();
const useClockMock = mock(() => new Date("2026-07-30T10:00:00.000Z"));

mock.module("../hooks/use-time-entry.js", () => ({
  useCurrentTimeEntry: useCurrentTimeEntryMock,
  useStartTimeEntry: useStartTimeEntryMock,
  useStartBreak: useStartBreakMock,
  useResumeTimeEntry: useResumeTimeEntryMock,
  useEndTimeEntry: useEndTimeEntryMock,
}));
mock.module("../hooks/use-categories.js", () => ({
  useCategories: useCategoriesMock,
}));
mock.module("../hooks/use-clock.js", () => ({
  useClock: useClockMock,
}));

const { TimerPage } = await import("./TimerPage.js");

function mutationResult(
  overrides: Partial<{ mutate: unknown; isPending: boolean; error: unknown }> = {},
) {
  return { mutate: mock(), isPending: false, error: null, ...overrides };
}

function workingEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry_1",
    userId: "user_1",
    categoryId: "cat_1",
    name: "資料作成",
    date: "2026-07-30",
    plannedStartAt: null,
    plannedDurationMinutes: 30,
    startedAt: "2026-07-30T10:00:00.000Z",
    endedAt: null,
    durationMinutes: null,
    breakStartedAt: null,
    totalBreakSeconds: 0,
    status: "working",
    memo: null,
    deviationFocused: null,
    deviationReason: null,
    alarmEnabled: true,
    alarmFiredAt: null,
    breakExtendsDeadline: true,
    createdAt: "2026-07-30T10:00:00.000Z",
    updatedAt: "2026-07-30T10:00:00.000Z",
    ...overrides,
  };
}

describe("TimerPage", () => {
  beforeEach(() => {
    useStartTimeEntryMock.mockReturnValue(mutationResult());
    useStartBreakMock.mockReturnValue(mutationResult());
    useResumeTimeEntryMock.mockReturnValue(mutationResult());
    useEndTimeEntryMock.mockReturnValue(mutationResult());
    useClockMock.mockReturnValue(new Date("2026-07-30T10:00:00.000Z"));
  });

  test("進行中の記録を取得中はローディング画面を表示する", () => {
    useCurrentTimeEntryMock.mockReturnValue({ data: undefined, isPending: true, error: null });

    render(<TimerPage />);

    expect(screen.getByText("読み込み中…")).toBeTruthy();
  });

  test("進行中の記録の取得に失敗したらエラーを表示する", () => {
    useCurrentTimeEntryMock.mockReturnValue({
      data: undefined,
      isPending: false,
      error: new Error("サーバーに接続できませんでした。通信環境を確認してください。"),
    });

    render(<TimerPage />);

    expect(
      screen.getByText("サーバーに接続できませんでした。通信環境を確認してください。"),
    ).toBeTruthy();
  });

  describe("進行中の記録が無い場合（開始フォーム）", () => {
    beforeEach(() => {
      useCurrentTimeEntryMock.mockReturnValue({ data: null, isPending: false, error: null });
      useCategoriesMock.mockReturnValue({
        data: [
          {
            id: "cat_1",
            userId: null,
            name: "仕事",
            color: "#3b82f6",
            isActive: true,
            createdAt: null,
          },
        ],
        isPending: false,
        error: null,
      });
    });

    test("カテゴリ一覧が選択肢に表示される", () => {
      render(<TimerPage />);

      expect(screen.getByText("仕事")).toBeTruthy();
    });

    test("カテゴリ未選択では開始するボタンが無効", () => {
      render(<TimerPage />);

      const button = screen.getByRole("button", { name: "開始する" }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    test("カテゴリを選び開始すると、入力内容でstartTimeEntryを呼ぶ", () => {
      const mutate = mock();
      useStartTimeEntryMock.mockReturnValue(mutationResult({ mutate }));
      render(<TimerPage />);

      fireEvent.change(screen.getByLabelText("カテゴリ"), { target: { value: "cat_1" } });
      fireEvent.change(screen.getByLabelText("タスク名（任意）"), {
        target: { value: "資料作成" },
      });
      fireEvent.change(screen.getByLabelText("計画時間（分・任意）"), {
        target: { value: "30" },
      });
      fireEvent.click(screen.getByRole("button", { name: "開始する" }));

      expect(mutate).toHaveBeenCalledWith({
        categoryId: "cat_1",
        name: "資料作成",
        plannedDurationMinutes: 30,
      });
    });

    test("タスク名・計画時間を省略しても開始できる（任意項目）", () => {
      const mutate = mock();
      useStartTimeEntryMock.mockReturnValue(mutationResult({ mutate }));
      render(<TimerPage />);

      fireEvent.change(screen.getByLabelText("カテゴリ"), { target: { value: "cat_1" } });
      fireEvent.click(screen.getByRole("button", { name: "開始する" }));

      expect(mutate).toHaveBeenCalledWith({
        categoryId: "cat_1",
        name: undefined,
        plannedDurationMinutes: undefined,
      });
    });

    test("開始リクエスト実行中は、submitイベントが来てもstartTimeEntryを呼ばない（多重送信防止）", () => {
      const mutate = mock();
      useStartTimeEntryMock.mockReturnValue(mutationResult({ mutate, isPending: true }));
      const { container } = render(<TimerPage />);

      fireEvent.change(screen.getByLabelText("カテゴリ"), { target: { value: "cat_1" } });
      const form = container.querySelector("form");
      if (form === null) throw new Error("form要素が見つかりません");
      fireEvent.submit(form);

      expect(mutate).not.toHaveBeenCalled();
    });
  });

  describe("進行中の記録がある場合（タイマー実行中）", () => {
    test("経過秒数を HH:MM:SS で表示する", () => {
      useCurrentTimeEntryMock.mockReturnValue({
        data: workingEntry(),
        isPending: false,
        error: null,
      });
      useClockMock.mockReturnValue(new Date("2026-07-30T10:00:30.000Z"));

      render(<TimerPage />);

      expect(screen.getByText("00:00:30")).toBeTruthy();
    });

    test("作業中は休憩ボタンを表示する", () => {
      useCurrentTimeEntryMock.mockReturnValue({
        data: workingEntry(),
        isPending: false,
        error: null,
      });

      render(<TimerPage />);

      expect(screen.getByRole("button", { name: "休憩" })).toBeTruthy();
    });

    test("休憩ボタン押下で対象エントリのidでstartBreakを呼ぶ", () => {
      const mutate = mock();
      useCurrentTimeEntryMock.mockReturnValue({
        data: workingEntry(),
        isPending: false,
        error: null,
      });
      useStartBreakMock.mockReturnValue(mutationResult({ mutate }));

      render(<TimerPage />);
      fireEvent.click(screen.getByRole("button", { name: "休憩" }));

      expect(mutate).toHaveBeenCalledWith("entry_1");
    });

    test("休憩中は再開ボタンと「休憩中」表示になる（経過時間は増えない）", () => {
      useCurrentTimeEntryMock.mockReturnValue({
        data: workingEntry({ status: "on_break", breakStartedAt: "2026-07-30T10:05:00.000Z" }),
        isPending: false,
        error: null,
      });
      useClockMock.mockReturnValue(new Date("2026-07-30T10:20:00.000Z"));

      render(<TimerPage />);

      expect(screen.getByRole("button", { name: "再開" })).toBeTruthy();
      expect(screen.getByText("休憩中")).toBeTruthy();
      expect(screen.getByText("00:05:00")).toBeTruthy();
    });

    test("再開ボタン押下で対象エントリのidでresumeTimeEntryを呼ぶ", () => {
      const mutate = mock();
      useCurrentTimeEntryMock.mockReturnValue({
        data: workingEntry({ status: "on_break", breakStartedAt: "2026-07-30T10:05:00.000Z" }),
        isPending: false,
        error: null,
      });
      useResumeTimeEntryMock.mockReturnValue(mutationResult({ mutate }));

      render(<TimerPage />);
      fireEvent.click(screen.getByRole("button", { name: "再開" }));

      expect(mutate).toHaveBeenCalledWith("entry_1");
    });

    test("休憩リクエスト実行中は、休憩・終了ボタンをまとめて無効化する（多重送信防止）", () => {
      useCurrentTimeEntryMock.mockReturnValue({
        data: workingEntry(),
        isPending: false,
        error: null,
      });
      useStartBreakMock.mockReturnValue(mutationResult({ isPending: true }));

      render(<TimerPage />);

      const breakButton = screen.getByRole("button", { name: "休憩" }) as HTMLButtonElement;
      const endButton = screen.getByRole("button", { name: "終了" }) as HTMLButtonElement;
      expect(breakButton.disabled).toBe(true);
      expect(endButton.disabled).toBe(true);
    });

    test("乖離が10分未満なら終了ボタンで即座に終了する（モーダルを出さない）", () => {
      const mutate = mock();
      useCurrentTimeEntryMock.mockReturnValue({
        data: workingEntry({ plannedDurationMinutes: 30 }),
        isPending: false,
        error: null,
      });
      useClockMock.mockReturnValue(new Date("2026-07-30T10:25:00.000Z")); // 25分経過、乖離5分
      useEndTimeEntryMock.mockReturnValue(mutationResult({ mutate }));

      render(<TimerPage />);
      fireEvent.click(screen.getByRole("button", { name: "終了" }));

      expect(mutate).toHaveBeenCalledWith({ id: "entry_1" });
      expect(screen.queryByText("予定時間と差がありました")).toBeNull();
    });

    test("乖離が10分以上なら終了ボタンで乖離モーダルを表示する（境界値ちょうど）", () => {
      useCurrentTimeEntryMock.mockReturnValue({
        data: workingEntry({ plannedDurationMinutes: 30 }),
        isPending: false,
        error: null,
      });
      useClockMock.mockReturnValue(new Date("2026-07-30T10:40:00.000Z")); // 40分経過、乖離10分

      render(<TimerPage />);
      fireEvent.click(screen.getByRole("button", { name: "終了" }));

      expect(screen.getByText("予定時間と差がありました")).toBeTruthy();
    });

    test("乖離モーダルで回答すると、focused/reason付きでendTimeEntryを呼ぶ", () => {
      const mutate = mock();
      useCurrentTimeEntryMock.mockReturnValue({
        data: workingEntry({ plannedDurationMinutes: 30 }),
        isPending: false,
        error: null,
      });
      useClockMock.mockReturnValue(new Date("2026-07-30T10:41:00.000Z"));
      useEndTimeEntryMock.mockReturnValue(mutationResult({ mutate }));

      render(<TimerPage />);
      fireEvent.click(screen.getByRole("button", { name: "終了" }));
      fireEvent.click(screen.getByRole("button", { name: "いいえ" }));
      fireEvent.click(screen.getByRole("button", { name: "終了する" }));

      expect(mutate).toHaveBeenCalledWith({ id: "entry_1", focused: false, reason: undefined });
    });

    test("乖離モーダルをキャンセルすると終了せずモーダルを閉じる", () => {
      const mutate = mock();
      useCurrentTimeEntryMock.mockReturnValue({
        data: workingEntry({ plannedDurationMinutes: 30 }),
        isPending: false,
        error: null,
      });
      useClockMock.mockReturnValue(new Date("2026-07-30T10:41:00.000Z"));
      useEndTimeEntryMock.mockReturnValue(mutationResult({ mutate }));

      render(<TimerPage />);
      fireEvent.click(screen.getByRole("button", { name: "終了" }));
      fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

      expect(mutate).not.toHaveBeenCalled();
      expect(screen.queryByText("予定時間と差がありました")).toBeNull();
    });

    test("計画時間が未設定なら乖離判定をせず終了ボタンで即座に終了する", () => {
      const mutate = mock();
      useCurrentTimeEntryMock.mockReturnValue({
        data: workingEntry({ plannedDurationMinutes: null }),
        isPending: false,
        error: null,
      });
      useClockMock.mockReturnValue(new Date("2026-07-30T12:00:00.000Z")); // 2時間経過
      useEndTimeEntryMock.mockReturnValue(mutationResult({ mutate }));

      render(<TimerPage />);
      fireEvent.click(screen.getByRole("button", { name: "終了" }));

      expect(mutate).toHaveBeenCalledWith({ id: "entry_1" });
    });
  });
});
