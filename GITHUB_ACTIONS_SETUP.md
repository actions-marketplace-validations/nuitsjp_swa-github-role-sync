# GitHub Actionsでの定期実行設定例

## 概要

このファイルでは、GitHub Actionsを使用してユーザー同期スクリプトを定期実行する方法を説明します。

## ワークフローファイルの作成

`.github/workflows/sync-swa-users.yml` を作成してください：

```yaml
name: Sync Azure Static Web App Users

on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: '変更を適用せずに差分だけ確認する'
        required: false
        default: 'false'
        type: choice
        options:
          - 'false'
          - 'true'
  schedule:
    - cron: '0 0 * * *'

jobs:
  sync-users:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      discussions: write
    env:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      DRY_RUN_INPUT: ${{ github.event_name == 'workflow_dispatch' && github.event.inputs.dry_run || 'false' }}

    steps:
      - name: Ensure GITHUB_TOKEN is available
        run: |
          if [ -z "${GH_TOKEN:-}" ]; then
            echo "GITHUB_TOKEN is required." >&2
            exit 1
          fi

      - uses: actions/checkout@v4

      - uses: azure/login@v2
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Install GitHub CLI if needed
        run: |
          if ! command -v gh >/dev/null 2>&1; then
            sudo apt-get update
            sudo apt-get install -y gh
          fi
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Validate GitHub CLI authentication
        run: gh auth status
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Configure dry-run mode
        shell: pwsh
        run: |
          $configPath = "config.json"
          $config = Get-Content $configPath -Raw | ConvertFrom-Json
          $config.sync.dryRun = ($env:DRY_RUN_INPUT -eq 'true')
          $config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding utf8

      - name: Sync Static Web App users
        shell: pwsh
        run: |
          & "$PWD/scripts/Sync-SwaUsers.ps1"
```

**注意**: `config.json` をリポジトリにコミットし、Azure Static Web App 名やリソースグループ名を記載しておく必要があります。
機密情報は含まれないため、パブリックリポジトリでも安全に管理できます。

スクリプトは、チェックアウトされたリポジトリの `origin` リモート (`${{ github.repository }}`) から GitHub リポジトリ名を自動検出します。ローカル・CI ともに `git remote get-url origin` が期待するGitHubリポジトリを指しているか必ず確認してください。`origin` が未設定、または GitHub 以外を指す場合はスクリプトがエラーで停止します。

> ℹ️ `GITHUB_TOKEN` のワークフローパーミッションをリポジトリ設定で `Read and write` にしておくと、Discussions への投稿権限（`discussions: write`）が付与され、追加の PAT は不要です。

## 必要なGitHub Secretsの設定

リポジトリの Settings > Secrets and variables > Actions で以下のシークレットを設定してください：

### 1. AZURE_CREDENTIALS

Azureサービスプリンシパルの認証情報（JSON形式）

```json
{
  "clientId": "<GUID>",
  "clientSecret": "<STRING>",
  "subscriptionId": "<GUID>",
  "tenantId": "<GUID>"
}
```

**作成方法:**

```bash
az ad sp create-for-rbac --name "github-actions-swa-sync" --role contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/{resource-group}/providers/Microsoft.Web/staticSites/{static-site-name} \
  --sdk-auth
```

このコマンドの出力をそのままシークレットに設定してください。

### 2. config.json

リポジトリにコミットされた `config.json` に、Azure Static Web App名とリソースグループ名を記載しておきます。
CI 環境でも同じファイルが使用されるため、値の整合性を定期的に確認してください。

## cronスケジュールの例

```yaml
# 毎日午前0時（UTC）
- cron: '0 0 * * *'

# 毎日午前9時（JST = UTC+9、つまりUTC 0時）
- cron: '0 0 * * *'

# 毎週月曜日の午前0時（UTC）
- cron: '0 0 * * 1'

# 毎月1日の午前0時（UTC）
- cron: '0 0 1 * *'

# 毎時0分
- cron: '0 * * * *'
```

## ドライランモードでのテスト

手動実行 (`Run workflow`) 時に `dry_run` 入力を `true` に切り替えると、ワークフローが `config.json` の `sync.dryRun` を自動的に `true` に更新して差分だけを確認します。スケジュール実行時は常に `false` が適用され、本番同期が実行されます。

## 手動実行の方法

1. GitHubリポジトリのActionsタブに移動
2. "Sync Azure SWA Users"ワークフローを選択
3. "Run workflow"ボタンをクリックし、必要に応じて `dry_run` を `true` に変更
4. ブランチを選択して"Run workflow"を実行

## ログの確認

1. GitHubリポジトリのActionsタブに移動
2. 実行されたワークフローをクリック
3. "Sync Users"ステップを展開してログを確認

## トラブルシューティング

### "Azure Login failed"

**原因:** AZURE_CREDENTIALSが正しく設定されていない

**解決方法:**
- シークレットが正しいJSON形式であることを確認
- サービスプリンシパルに適切な権限があることを確認

### "GitHub authentication failed"

**原因:** `GITHUB_TOKEN` のパーミッションが不足、またはリポジトリ設定でワークフロートークンが無効化されている

**解決方法:**
- リポジトリ設定の「Actions > General > Workflow permissions」で `Read and write permissions` を選択
- ワークフロー内の `permissions` セクションに `discussions: write` が含まれているか確認

### "Resource not found"

**原因:** `config.json` 内の Static Web App 名またはリソースグループ名が正しくない

**解決方法:**
- Azure Portalで正しいリソース名を確認
- `config.json` を修正して再度実行

## セキュリティのベストプラクティス

1. **最小権限の原則**: サービスプリンシパルには必要最小限の権限のみを付与
2. **トークンのローテーション**: Personal Access Tokenは定期的に更新
3. **シークレットの管理**: シークレットをコードにハードコーディングしない
4. **監査ログの確認**: 定期的にワークフローの実行ログを確認

## 通知の追加（オプション）

### Slackへの通知

```yaml
      - name: Notify Slack
        if: always()
        uses: slackapi/slack-github-action@v1.24.0
        with:
          payload: |
            {
              "text": "Azure SWA User Sync: ${{ job.status }}",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "User sync completed with status: *${{ job.status }}*"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Emailでの通知

GitHub Actionsはデフォルトでワークフロー失敗時にメール通知を送信します。
Settings > Notifications で設定を確認してください。

## まとめ

GitHub Actionsを使用することで、ユーザー同期を完全に自動化できます。
定期実行により、GitHubリポジトリの権限変更が自動的にAzure Static Web Appに反映されます。

詳細は[USAGE.md](USAGE.md)を参照してください。
