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
tsumori.yuu0413.com/api, /api/*   → tsumori-api    (Workers Routes)
tsumori.yuu0413.com/*             → tsumori-web    (Workers Static Assets)
```

同一オリジンに揃えているため、CORS 設定と Cookie の domain 指定が不要です。
ルーティング設定は各 `wrangler.jsonc` の `routes` に記述済みです
（`/api` と `/api/*` の方が `/*` より具体的なパターンなので、定義順に関わらずそちらが優先されます。
`/api/*` の `*` は `/api/` より後ろにしかマッチしないため、末尾セグメントの無い `/api` 単体は
別途 `/api` の完全一致パターンで拾っています）。

### 初回セットアップ（`yuu0413.com` が Cloudflare 管理下にある前提）

1. **Wrangler にログイン**（初回のみ）

   ```bash
   bunx wrangler login
   ```

2. **DNS レコードを追加**（Cloudflare ダッシュボード → `yuu0413.com` → DNS）

   Workers Routes は実体のオリジンサーバーを必要としないため、ダミーの
   プロキシ済み（オレンジクラウド）レコードを追加します。

   | Type | Name      | Content     | Proxy status |
   | ---- | --------- | ----------- | ------------ |
   | A    | `tsumori` | `192.0.2.1` | Proxied      |

   `192.0.2.1` は疎通に使われない予約アドレス（TEST-NET-1）です。実際のリクエストは
   Workers Routes によって Cloudflare のエッジ上で Worker に転送されるため、
   このIPに実際に到達することはありません。
   既存の `yuu0413.com`（ポートフォリオ）のレコードは変更しないでください。

3. **シークレットを登録**（`.env` ではなく Wrangler 側）

   ```bash
   cd apps/api
   bunx wrangler secret put DATABASE_URL
   bunx wrangler secret put BETTER_AUTH_SECRET
   ```

4. **デプロイ**

   ```bash
   bun run --filter @tsumori/api deploy
   bun run --filter @tsumori/web deploy
   ```

   初回デプロイ時に、各 `wrangler.jsonc` の `routes` に基づいて
   Workers Route が自動作成されます。

5. **動作確認**

   ```bash
   curl -i https://tsumori.yuu0413.com/api/health   # 200 が返ること
   curl -i https://tsumori.yuu0413.com/             # web の index.html が返ること
   curl -i https://tsumori.yuu0413.com/no-such-path # SPA なので index.html が返ること
   curl -i https://yuu0413.com/                     # 既存ポートフォリオに影響が無いこと
   ```

以降のデプロイは 4. のコマンドのみで反映されます。

## ドキュメント

開発フロー・ブランチ命名・コミット規約は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照。
