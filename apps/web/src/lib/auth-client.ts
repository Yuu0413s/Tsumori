import { createAuthClient } from "better-auth/react";

// baseURL 省略時は同一オリジン + "/api/auth" になり、apps/api 側の
// マウント先（app.basePath("/api") + "/auth/*"）とデフォルトのまま一致する。
export const authClient = createAuthClient();

export const { useSession, signIn, signOut } = authClient;
