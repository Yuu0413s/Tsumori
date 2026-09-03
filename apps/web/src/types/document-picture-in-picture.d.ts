// Document Picture-in-Picture API は Chrome/Edge の実験的機能であり、
// TypeScript 標準の DOM lib にまだ含まれていない（2026-09時点）ため、
// 使用箇所の型検査を通すのに必要な最小限の型だけをここで補う。
export {};

declare global {
  interface DocumentPictureInPicture extends EventTarget {
    readonly window: Window | null;
    requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
  }

  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}
