import { GlobalRegistrator } from "@happy-dom/global-registrator";

// @testing-library/dom は import 時点の document の有無で screen の実装を確定してしまうため、
// テスト側が @testing-library/react を import するより前に、必ずこのファイル単体で
// window/document を登録し切っておく必要がある（testing-library.ts を別ファイルに分けている理由）。
// better-auth の createAuthClient() は baseURL 省略時に window.location.origin を使うため、
// 開発サーバーと同じ origin を明示する。
GlobalRegistrator.register({ url: "http://localhost:5173" });
