import { describe, expect, test, spyOn } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useClock } from "./use-clock.js";

describe("useClock", () => {
  test("マウント時に1秒間隔のタイマーを設定する", () => {
    const setIntervalSpy = spyOn(globalThis, "setInterval");
    try {
      renderHook(() => useClock());
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    } finally {
      setIntervalSpy.mockRestore();
    }
  });

  test("アンマウント時にタイマーを解除する（積み上げを防ぐ）", () => {
    const clearIntervalSpy = spyOn(globalThis, "clearInterval");
    try {
      const { unmount } = renderHook(() => useClock());
      unmount();
      expect(clearIntervalSpy).toHaveBeenCalled();
    } finally {
      clearIntervalSpy.mockRestore();
    }
  });

  test("アンマウント時に visibilitychange のリスナーを解除する", () => {
    const removeEventListenerSpy = spyOn(document, "removeEventListener");
    try {
      const { unmount } = renderHook(() => useClock());
      unmount();
      expect(removeEventListenerSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    } finally {
      removeEventListenerSpy.mockRestore();
    }
  });

  test("visibilitychange イベントで現在時刻を再計算する（タブ復帰時のズレ対策）", () => {
    const { result } = renderHook(() => useClock());
    const before = result.current;

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // 新しい Date インスタンスに更新されている（同一参照のままではない）ことを確認する
    expect(result.current).not.toBe(before);
    expect(result.current.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });
});
