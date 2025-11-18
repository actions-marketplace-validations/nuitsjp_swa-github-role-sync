# TODO: 次の課題リスト

1) 実環境でのE2E検証
- Azure Static Web AppsとDiscussionsが有効なGitHubリポジトリで、サンプルWorkflow（READMEの例）を実行し、招待リンク生成・役割更新・Discussion作成が正しく行われることを確認。
- 実行時に必要なシークレット/permissions（`id-token: write`, `discussions: write`, `contents: read`）を付与し、`azure/login`が成功することを必ず事前に確認。

  - OIDC 設定とロール割り当て確認/登録手順（CLI）
    - サービス プリンシパル存在確認: `az ad sp show --id <AZURE_CLIENT_ID>`
    - 無い場合の作成: `az ad sp create --id <AZURE_CLIENT_ID>`（既存アプリを SP 化）
    - フェデレーション資格情報作成（GitHub OIDC）:
      - `ORG=nuitsjp`、`REPO=swa-github-role-sync`、`ENV=main`
      - `az ad app federated-credential create --id <AZURE_CLIENT_ID> --parameters "{\"name\":\"gh-$ENV\",\"issuer\":\"https://token.actions.githubusercontent.com\",\"subject\":\"repo:$ORG/$REPO:ref:refs/heads/$ENV\",\"audiences\":[\"api://AzureADTokenExchange\"]}"`
    - サブスクリプション ロール付与（例: `Contributor` または SWA 必要ロール）:
      - `SUBSCRIPTION_ID=<AZURE_SUBSCRIPTION_ID>`
      - `az role assignment create --assignee <AZURE_CLIENT_ID> --role "Contributor" --scope "/subscriptions/$SUBSCRIPTION_ID"`
    - Static Web Apps スコープで限定する場合（推奨）:
      - `SWA_ID=$(az staticwebapp show --name <swa-name> --resource-group <rg> --query id -o tsv)`
      - `az role assignment create --assignee <AZURE_CLIENT_ID> --role "Contributor" --scope "$SWA_ID"`

2) 失敗時のハンドリング/ログ強化
- Azure CLI失敗やDiscussion作成失敗時のリトライ・例外メッセージ整備を検討（現在はWarningで継続）。
- core.summaryには成功/失敗の詳細を追加するか検討。

3) テスト拡充
- `src/main.ts`のE2Eに近いユニット/統合テストを追加（OctokitとAzure CLIをモック）。招待/更新/削除の各分岐とDiscussion作成成功/失敗の分岐をカバー。
- coverage閾値設定を検討（jestのcoverageThreshold）。

4) 入力バリデーション/テンプレート
- `discussion-category-name`が存在しない場合の明示的な事前チェックや、テンプレート置換キー欠如時のログ出力を検討。
- `{summaryMarkdown}`を埋め込まないテンプレート指定時の挙動（意図どおりか）を決める。

5) リリース準備
- バージョン付け（例: `v0.1.0` → `v1.0.0`）と`v1`タグ運用の整備。
- Marketplace公開を想定した`branding`調整とREADMEのスクリーンショット/使用例追記。

6) CI/CD改善
- 現在CIはformat/lint/testのみ。`check-dist`ワークフローで`dist`差分を検証済みだが、必要なら`npm run bundle`をCIジョブに追加。
- SAST/依存関係スキャン（CodeQL継続利用、npm auditの扱い）方針を決める。
