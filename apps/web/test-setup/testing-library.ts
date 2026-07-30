import { afterEach } from "bun:test";
import { cleanup } from "@testing-library/react";

// happy-dom.ts の後に読み込まれる前提（root package.json の "test" スクリプトでの --preload 順）。
afterEach(() => {
  cleanup();
});
