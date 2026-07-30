import { signIn } from "../lib/auth-client.js";

type SignInSocial = (params: { provider: "google"; callbackURL: string }) => Promise<unknown>;

function defaultSignInSocial(params: Parameters<SignInSocial>[0]) {
  return signIn.social(params);
}

/**
 * Google ログインの呼び出しをDIで差し替え可能にしている。RequireAuth/RequireGuest と同じ考え方
 * （better-auth 本体に依存せず、ボタン押下時の挙動だけを単体テストするため）。
 */
export function createLoginPage(signInSocial: SignInSocial = defaultSignInSocial) {
  return function LoginPage() {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <h1 className="text-3xl font-bold text-gray-900">Tsumori</h1>
        <p className="max-w-xs text-center text-sm text-gray-600">
          「つもりだった時間」と「実際」の差を記録する
        </p>
        <button
          type="button"
          onClick={() =>
            void signInSocial({ provider: "google", callbackURL: "/" }).catch(
              (error: unknown) => console.error(error),
            )
          }
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Googleでログイン
        </button>
        <p className="max-w-xs text-center text-xs text-gray-500">
          以前パスワードでログインしていた方も、Googleボタンからお入りください
        </p>
      </main>
    );
  };
}

export const LoginPage = createLoginPage();
