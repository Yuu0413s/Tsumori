import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { DeviationModal } from "./DeviationModal.js";

describe("DeviationModal", () => {
  test("見出しと質問文を表示する", () => {
    render(<DeviationModal onSubmit={mock()} onCancel={mock()} />);

    expect(screen.getByText("予定時間と差がありました")).toBeTruthy();
    expect(screen.getByText("集中できましたか？")).toBeTruthy();
  });

  test("「集中できたか」を選ぶまでは終了するボタンが無効", () => {
    render(<DeviationModal onSubmit={mock()} onCancel={mock()} />);

    const button = screen.getByRole("button", { name: "終了する" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  test("「はい」を選ぶと終了するボタンが有効になる", () => {
    render(<DeviationModal onSubmit={mock()} onCancel={mock()} />);

    fireEvent.click(screen.getByRole("button", { name: "はい" }));

    const button = screen.getByRole("button", { name: "終了する" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
  });

  test("見出しとダイアログが aria-labelledby で関連付けられている（スクリーンリーダー対応）", () => {
    render(<DeviationModal onSubmit={mock()} onCancel={mock()} />);

    const dialog = screen.getByRole("dialog");
    const heading = screen.getByText("予定時間と差がありました");
    expect(dialog.getAttribute("aria-labelledby")).toBe(heading.id);
  });

  test("「はい」を選ぶと、はいボタンだけ aria-pressed=true になる", () => {
    render(<DeviationModal onSubmit={mock()} onCancel={mock()} />);

    fireEvent.click(screen.getByRole("button", { name: "はい" }));

    expect(screen.getByRole("button", { name: "はい" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "いいえ" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  test("focused=true・理由入力ありで終了すると、trimした理由付きでonSubmitを呼ぶ", () => {
    const onSubmit = mock();
    render(<DeviationModal onSubmit={onSubmit} onCancel={mock()} />);

    fireEvent.click(screen.getByRole("button", { name: "はい" }));
    fireEvent.change(screen.getByLabelText("理由（任意）"), {
      target: { value: "  会議が延びた  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "終了する" }));

    expect(onSubmit).toHaveBeenCalledWith({ focused: true, reason: "会議が延びた" });
  });

  test("理由が空のままだと reason は undefined で送る", () => {
    const onSubmit = mock();
    render(<DeviationModal onSubmit={onSubmit} onCancel={mock()} />);

    fireEvent.click(screen.getByRole("button", { name: "いいえ" }));
    fireEvent.click(screen.getByRole("button", { name: "終了する" }));

    expect(onSubmit).toHaveBeenCalledWith({ focused: false, reason: undefined });
  });

  test("キャンセルを押すとonCancelを呼ぶ", () => {
    const onCancel = mock();
    render(<DeviationModal onSubmit={mock()} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onCancel).toHaveBeenCalled();
  });
});
