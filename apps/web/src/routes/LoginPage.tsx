import { signIn } from "../lib/auth-client.js";

export function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-gray-50 px-4">
      <h1 className="text-3xl font-bold text-gray-900">Tsumori</h1>
      <p className="text-center text-sm text-gray-600">
        「つもりだった時間」と「実際」の差を記録する
      </p>
      <button
        type="button"
        onClick={() =>
          void signIn
            .social({ provider: "google", callbackURL: "/" })
            .catch((error: unknown) => console.error(error))
        }
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
      >
        Googleでログイン
      </button>
    </main>
  );
}
