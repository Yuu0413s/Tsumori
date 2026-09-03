import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useDocumentPictureInPicture } from "./use-document-picture-in-picture.js";

function createFakePipWindow() {
  const doc = document.implementation.createHTMLDocument();
  const target = new EventTarget();
  const win = {
    document: doc,
    close: mock(() => target.dispatchEvent(new Event("pagehide"))),
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  };
  return win as unknown as Window;
}

describe("useDocumentPictureInPicture", () => {
  afterEach(() => {
    delete (window as { documentPictureInPicture?: unknown }).documentPictureInPicture;
  });

  test("documentPictureInPicture 非対応環境では isSupported が false", () => {
    delete (window as { documentPictureInPicture?: unknown }).documentPictureInPicture;

    const { result } = renderHook(() => useDocumentPictureInPicture({ width: 240, height: 160 }));

    expect(result.current.isSupported).toBe(false);
    expect(result.current.pipWindow).toBeNull();
  });

  test("open() は指定サイズで PiP ウィンドウを要求し、既存スタイルシートをコピーする", async () => {
    const fakeWindow = createFakePipWindow();
    const requestWindow = mock(async () => fakeWindow);
    (
      window as unknown as { documentPictureInPicture: { requestWindow: typeof requestWindow } }
    ).documentPictureInPicture = { requestWindow };

    const style = document.createElement("style");
    style.textContent = "body { color: red; }";
    document.head.appendChild(style);

    try {
      const { result } = renderHook(() => useDocumentPictureInPicture({ width: 240, height: 160 }));
      expect(result.current.isSupported).toBe(true);

      await act(async () => {
        await result.current.open();
      });

      expect(requestWindow).toHaveBeenCalledWith({ width: 240, height: 160 });
      expect(result.current.pipWindow).toBe(fakeWindow);
      expect(fakeWindow.document.head.querySelector("style")?.textContent).toContain(
        "body { color: red; }",
      );
    } finally {
      style.remove();
    }
  });

  test("PiP ウィンドウが閉じられる（pagehide）と pipWindow が null に戻る", async () => {
    const fakeWindow = createFakePipWindow();
    const requestWindow = mock(async () => fakeWindow);
    (
      window as unknown as { documentPictureInPicture: { requestWindow: typeof requestWindow } }
    ).documentPictureInPicture = { requestWindow };

    const { result } = renderHook(() => useDocumentPictureInPicture({ width: 240, height: 160 }));
    await act(async () => {
      await result.current.open();
    });
    expect(result.current.pipWindow).not.toBeNull();

    act(() => {
      fakeWindow.dispatchEvent(new Event("pagehide"));
    });

    expect(result.current.pipWindow).toBeNull();
  });

  test("close() は開いている PiP ウィンドウの close() を呼ぶ", async () => {
    const fakeWindow = createFakePipWindow();
    const requestWindow = mock(async () => fakeWindow);
    (
      window as unknown as { documentPictureInPicture: { requestWindow: typeof requestWindow } }
    ).documentPictureInPicture = { requestWindow };

    const { result } = renderHook(() => useDocumentPictureInPicture({ width: 240, height: 160 }));
    await act(async () => {
      await result.current.open();
    });

    act(() => {
      result.current.close();
    });

    expect(fakeWindow.close).toHaveBeenCalled();
  });

  test("アンマウント時に開いている PiP ウィンドウを閉じる", async () => {
    const fakeWindow = createFakePipWindow();
    const requestWindow = mock(async () => fakeWindow);
    (
      window as unknown as { documentPictureInPicture: { requestWindow: typeof requestWindow } }
    ).documentPictureInPicture = { requestWindow };

    const { result, unmount } = renderHook(() =>
      useDocumentPictureInPicture({ width: 240, height: 160 }),
    );
    await act(async () => {
      await result.current.open();
    });

    unmount();

    expect(fakeWindow.close).toHaveBeenCalled();
  });
});
