import { useCallback, useEffect, useRef, useState } from "react";

/** 対応ブラウザ（Chrome/Edge 130+）でのみ true。Firefox/Safari では false。 */
export function isDocumentPipSupported(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}

type PipSize = { width: number; height: number };

/**
 * Document Picture-in-Picture ウィンドウの開閉を管理する。
 * 開いた瞬間に既存のスタイルシートをコピーしないと、PiP ウィンドウ内で
 * Tailwind が効かず表示が崩れるため、ここでまとめて行う。
 */
export function useDocumentPictureInPicture({ width, height }: PipSize) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipWindowRef = useRef<Window | null>(null);

  const open = useCallback(async () => {
    const pip = window.documentPictureInPicture;
    if (!pip || pipWindowRef.current !== null) return;

    const win = await pip.requestWindow({ width, height });

    for (const sheet of document.styleSheets) {
      try {
        const style = win.document.createElement("style");
        style.textContent = [...sheet.cssRules].map((rule) => rule.cssText).join("");
        win.document.head.appendChild(style);
      } catch {
        // cross-origin のスタイルシートは cssRules が読めないため無視する
      }
    }

    // タブ側から見て PiP ウィンドウを閉じたときの同期。ユーザーが PiP の
    // 閉じるボタンを押した場合もここを通る。
    win.addEventListener(
      "pagehide",
      () => {
        pipWindowRef.current = null;
        setPipWindow(null);
      },
      { once: true },
    );

    pipWindowRef.current = win;
    setPipWindow(win);
  }, [width, height]);

  const close = useCallback(() => {
    pipWindowRef.current?.close();
  }, []);

  // 呼び出し元（タイマー画面）が閉じられたとき、ポータル先を失った PiP
  // ウィンドウが空のまま残り続けないようにする。
  useEffect(() => {
    return () => {
      pipWindowRef.current?.close();
    };
  }, []);

  return { pipWindow, isSupported: isDocumentPipSupported(), open, close };
}
