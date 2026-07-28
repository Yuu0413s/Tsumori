# 開発ルール

## 開発フロー

必ずこの順番で進める。`main` に直接コミットしない。

```
Issue作成 → ブランチ作成 → 実装 → PR作成 → CI通過 → Codexレビュー → マージ
```

## ブランチ命名規則

```
<種別>/<Issue番号>-<内容の短い英語>
```

| 種別       | 用途                   | 例                          |
| ---------- | ---------------------- | --------------------------- |
| `feat`     | 機能追加               | `feat/10-alarm-foreground`  |
| `fix`      | バグ修正               | `fix/15-timer-drift`        |
| `refactor` | 挙動を変えない内部改善 | `refactor/18-extract-alarm` |
| `chore`    | 設定・依存更新・雑務   | `chore/1-monorepo-scaffold` |
| `docs`     | ドキュメント           | `docs/22-update-readme`     |
| `test`     | テスト追加             | `test/3-alarm-unit-test`    |

## コミットメッセージ

Conventional Commits に従い、本文は日本語で書く。

```
feat: 予定時間経過時にアラームを鳴らす機能を追加
fix: バックグラウンド復帰時にタイマーがズレる問題を修正
refactor: 締切計算ロジックを packages/core に切り出し
chore: モノレポの雛形と CI を追加
```

## マージ戦略

**Squash and merge** を使う。GitHub の Settings → General → Pull Requests で以下を推奨。

- [x] Allow squash merging
- [ ] Allow merge commits（オフ）
- [ ] Allow rebase merging（オフ）
- [x] Automatically delete head branches

## ブランチ保護

Settings → Branches で `main` を保護する。

- Require a pull request before merging
- Require status checks to pass before merging
  - `Lint / Format / Typecheck / Test / Build`
- Block force pushes

> ⚠️ ステータスチェックは CI が一度実行されるまで選択肢に出てこない。最初の PR の CI が完了してから設定すること。

## コードレビュー

このリポジトリでは AI レビューを2本立てで使う。

### CodeRabbit（自動・PR単位）

GitHub App として導入する。**`.coderabbit.yaml` はあくまで設定ファイルで、これを置いただけでは動かない。** [coderabbit.ai](https://coderabbit.ai) でアカウントを作り、リポジトリに App をインストールする必要がある。

- 出力言語は `.coderabbit.yaml` の `language: "ja-JP"` で日本語に固定している
- `profile: "chill"` で重要な指摘に絞っている。細かく見てほしくなったら `"assertive"` に変える
- `request_changes_workflow: false` なので、CodeRabbit がマージをブロックすることはない
- Draft PR はレビューしない

パス別のレビュー観点を `path_instructions` に定義してある。新しいディレクトリを追加したときは、ここにも観点を足すこと。

PR コメントで指示できる主なコマンド:

| コマンド                      | 内容                                 |
| ----------------------------- | ------------------------------------ |
| `@coderabbitai review`        | 手動で再レビュー                     |
| `@coderabbitai full review`   | 差分ではなく全体を再レビュー         |
| `@coderabbitai resolve`       | 未対応コメントをすべて解決済みにする |
| `@coderabbitai configuration` | 現在の設定を表示                     |

### Codex（手動・観点指定）

PR テンプレートに記載の依頼文を使い、①バグ ②パフォーマンス ③品質 ④セキュリティ の4観点で依頼する。問題がない観点は「問題なし」と明記させる。

## モノレポの約束

### パッケージ間の依存方向

```
apps/web  ──┐
apps/api  ──┼──▶ packages/core   （純粋ロジック。何にも依存しない）
apps/mobile ┘
apps/api  ─────▶ packages/db     （Drizzle。api からのみ使う）
```

- ❌ `packages/core` から `packages/db` や `apps/*` を import しない
- ❌ `apps/web` から `packages/db` を import しない（**DBは必ず api 経由**）
- ✅ `apps/web` と `apps/mobile` は `apps/api` の `AppType` を Hono RPC 経由で使う

`packages/core` を何にも依存させないのは、ここが最もテストされるべき場所だから。DB やブラウザ API に依存すると途端にテストしづらくなる。

### ビルドステップを持たない

`packages/*` は `exports` が `./src/index.ts` を直接指しており、ビルド成果物を作らない。bun / Vite / esbuild はいずれも TypeScript をそのまま解決できるため、中間ビルドは不要。

そのため各 `tsconfig.json` は project references を使わず、独立して `tsc --noEmit` を実行する。

### 新しいパッケージを足すとき

1. `packages/<name>/package.json` に `"name": "@tsumori/<name>"` と `"exports"` を書く
2. `scripts` に `typecheck` と `build` を必ず定義する（root の `--filter '*'` が全ワークスペースを舐めるため）
3. 使う側の `dependencies` に `"@tsumori/<name>": "workspace:*"` を追加
4. `bun install` でシンボリックリンクを張り直す

## 環境変数

| 変数名                              | 使う場所 | 備考                                       |
| ----------------------------------- | -------- | ------------------------------------------ |
| `DATABASE_URL`                      | api      | Neon の接続文字列                          |
| `BETTER_AUTH_SECRET`                | api      | `openssl rand -base64 32`                  |
| `BETTER_AUTH_URL`                   | api      | 本番は `https://tsumori.yuu0413.com`       |
| `GOOGLE_CLIENT_ID` / `_SECRET`      | api      | Google ログイン用                          |
| `VAPID_PUBLIC_KEY` / `_PRIVATE_KEY` | api      | Web Push（Phase 4）                        |
| `VITE_API_BASE_URL`                 | web      | **`VITE_` 接頭辞はクライアントに露出する** |

⚠️ `VITE_` で始まる変数はビルド成果物に埋め込まれてブラウザから見える。**秘密情報を絶対に入れないこと。**

本番のシークレットは Wrangler で登録する。`.env` はローカル専用。

```bash
cd apps/api
bunx wrangler secret put DATABASE_URL
```

## DBスキーマ変更の手順

`db:push` は使わない。**`db:generate` を正とする。**

1. `packages/db/src/schema.ts` を編集
2. `bun run db:generate`
3. **生成された SQL を目で読む**（意図しない `DROP COLUMN` が無いか）
4. `bun run db:migrate` で適用
5. 生成された SQL と `drizzle/meta/` をコミットに含める

## テスト方針

`bun test` を使う。vitest / jest は入れない。

- **必ずテストを書く**: `packages/core` の純粋関数
- **書いたほうがよい**: `apps/api` のルートハンドラ
- **書かなくてよい**: 見た目だけのコンポーネント

テストファイルは対象と同じディレクトリに `*.test.ts` として置く。
