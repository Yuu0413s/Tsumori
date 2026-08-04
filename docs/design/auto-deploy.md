# 自動デプロイ

## 1. 目的

mainブランチへのマージ後、`apps/web` と `apps/api` をCloudflare Workersへ自動デプロイし、
`wrangler deploy` の手動実行漏れ・実行ミスを無くす。

## 2. ユーザー（デプロイの実行者・権限）

- デプロイをトリガーするのは「mainへのマージ（push）」という自動イベントのみ。`workflow_dispatch`（手動トリガー）は今回は無し
- Cloudflareの認証情報（API Token）はGitHub Secretsに1つ登録し、リポジトリ管理者（ゆう）のみが管理する
- 現状のコミッターは1人（ゆう）

## 3. 課題

- 現状は `wrangler deploy` を手動実行する運用のため、以下の負担・リスクがある
  - マージしたのにデプロイし忘れる
  - デプロイ手順（`bun run --filter @tsumori/web deploy` 等、ルートからの正しい呼び方）を毎回思い出す必要がある
- 自動化しないと、今後リリース頻度が上がるほどこの負担と事故リスクが増える

## 4. 機能

### MVPに含める

- mainへのpush（マージ）をトリガーに、`apps/api` → `apps/web` の順で `wrangler deploy`
- 既存の `ci.yml` の `quality` ジョブ（Lint/Format/Typecheck/Test/Build）が通ってからデプロイする（品質ゲート）
- Cloudflare API Tokenを新規ジョブ用にGitHub Secretsへ登録（発行・登録はユーザー側の作業）
- デプロイ失敗時の通知は、追加実装を行わずGitHub標準のActions失敗通知（メール等）に任せる
  - 届くかどうかは各自のGitHub通知設定（Settings > Notifications）に依存するため、有効になっているか各自確認する

### MVPに含めない（後回し）

- DBマイグレーションの自動実行（[[deploy]] 参照。破壊的操作のため対象外）
- Slack等、GitHub標準以外への通知
- ロールバックの自動化
- ステージング環境・プレビューデプロイ

## 5. ワークフロー構成

画面構成に代えて、GitHub Actionsのジョブ構成を示す。

```yaml
jobs:
  quality: # 既存（Lint/Format/Typecheck/Test/Build）
  db-check: # 既存（Drizzle schema drift チェック）
  deploy-api:
    needs: [quality]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    # apps/api を wrangler deploy
  deploy-web:
    needs: [deploy-api] # api成功後にwebを実行（順序を保証）
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    # apps/web を wrangler deploy
```

## 6. データ構造

該当なし（DBスキーマの変更は伴わない）。

## 7. API設計

該当なし（新規APIエンドポイントの追加は伴わない）。

## 8. フォルダ構成

既存の `.github/workflows/ci.yml` に `deploy-api` / `deploy-web` ジョブを追加する形とする（新規ワークフローファイルは作らない）。

```
.github/workflows/
└── ci.yml     ← quality, db-check に加えて deploy-api, deploy-web ジョブを追加
```

**採用しなかった案**: `deploy.yml` を新規に作り `workflow_run` でci.yml成功を待つ構成。
理由: `workflow_run` はSHAの取り扱いや動作確認がやや複雑で、このリポジトリの規模・運用頻度では
複雑さに見合うメリットが薄いと判断した。

## 9. 実装手順

1. Cloudflare API Tokenを発行し、GitHub Secretsに `CLOUDFLARE_API_TOKEN`（必要なら `CLOUDFLARE_ACCOUNT_ID` も）として登録する（ユーザー側の作業）
2. `.github/workflows/ci.yml` に `deploy-api` ジョブを追加（`needs: [quality]`、mainへのpush時のみ）
3. `.github/workflows/ci.yml` に `deploy-web` ジョブを追加（`needs: [deploy-api]`、mainへのpush時のみ）
4. Secretsが正しく渡っているか、実際にmainへマージして動作確認する

## 10. リスク

- Cloudflare API Tokenのスコープを絞らないと、必要以上の権限を持つ強いトークンになる（Workers編集権限のみに絞るべき）
- `deploy-api` が失敗すれば `deploy-web` は自動的にスキップされる（`needs` により安全側に倒れる）
- 逆に、apiは成功しwebだけ失敗した場合、apiは新バージョン・webは旧バージョンのまま不整合が一定時間続く可能性がある（今回はMVPとして許容）
- GitHub標準通知は個人の通知設定に依存するため、確実に気づける保証はない

## 関連する規約集の判断

- [docs/conventions/deploy.md](../conventions/deploy.md) — DBマイグレーションを自動デプロイに含めない方針
