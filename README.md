# Tsumori

「**つもり**だった時間」と「実際にかかった時間」のズレを記録して、時間の見積もり精度を上げるための作業時間トラッカー。

## 構成

```
tsumori/
├── apps/
│   ├── web/        Vite + React + Tailwind（PWA）→ Cloudflare Workers
│   ├── api/        Hono + better-auth + Drizzle → Cloudflare Workers
│   └── mobile/     Expo（Phase 5 で追加）
└── packages/
    ├── core/       締切計算などの純粋ロジック（bun test 対象）
    └── db/         Drizzle スキーマとマイグレーション
```

| レイヤ         | 技術                                           |
| -------------- | ---------------------------------------------- |
| パッケージ管理 | bun workspaces                                 |
| Web            | Vite / React 19 / TypeScript / Tailwind CSS v4 |
| API            | Hono（Cloudflare Workers）                     |
| DB             | Neon PostgreSQL + Drizzle ORM                  |
| テスト         | `bun test`                                     |
| CI             | GitHub Actions                                 |

## セットアップ

```bash
bun install
cp .env.example .env
# .env の値を埋める
```

## 開発

ターミナルを2つ使います。

```bash
bun run dev:api    # http://localhost:8787
bun run dev:web    # http://localhost:5173
```

Vite の dev サーバーが `/api` へのリクエストを `localhost:8787` にプロキシします。本番と同じ「同一オリジン」の状態がローカルで再現されるため、CORS や Cookie の挙動が本番と一致します。

## コマンド

| コマンド               | 内容                             |
| ---------------------- | -------------------------------- |
| `bun run lint`         | ESLint                           |
| `bun run format`       | Prettier で整形                  |
| `bun run format:check` | 整形漏れの検出（CI と同じ）      |
| `bun run typecheck`    | 全ワークスペースの型チェック     |
| `bun test`             | テスト                           |
| `bun run build`        | 全ワークスペースのビルド         |
| `bun run db:generate`  | スキーマからマイグレーション生成 |
| `bun run db:migrate`   | マイグレーション適用             |
| `bun run db:studio`    | Drizzle Studio                   |

## デプロイ

```
tsumori.yuu0413.com/api/*   → tsumori-api    (Workers Routes)
tsumori.yuu0413.com/*       → tsumori-web    (Workers Static Assets)
```

同一オリジンに揃えているため、CORS 設定と Cookie の domain 指定が不要です。

```bash
bun run --filter @tsumori/api deploy
bun run --filter @tsumori/web deploy
```

シークレットは `.env` ではなく Wrangler で登録します。

```bash
cd apps/api
bunx wrangler secret put DATABASE_URL
bunx wrangler secret put BETTER_AUTH_SECRET
```

## ドキュメント

開発フロー・ブランチ命名・コミット規約は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照。
