# Discussion投稿機能 実装完了レポート

## 実装内容

### 1. 設定ファイル
- `config.json.template`: Discussion設定セクションを追加
  - `enabled`: Discussion投稿の有効/無効
  - `categoryId`: DiscussionカテゴリID
  - `titleTemplate`: タイトルテンプレートファイル
  - `bodyTemplate`: 本文テンプレートファイル

### 2. テンプレートファイル
- `invitation-title-template.txt`: Discussionタイトル
- `invitation-body-template.txt`: Discussion本文（`{{INVITATIONS}}`プレースホルダー含む）

### 3. 共通関数（scripts/common-functions.ps1）
- `Get-TemplateContent`: テンプレートファイル読み込み
- `New-GitHubDiscussion`: GitHub Discussions投稿（GraphQL API使用）
- `Get-Configuration`: Discussion設定の読み込み対応

### 4. メインスクリプト（scripts/Sync-SwaUsers.ps1）
- `Add-AzureStaticWebAppUser`: 招待URL抽出（`--output json`使用）
- 招待結果を配列に収集
- 同期完了後、Discussion投稿処理を追加

### 5. ドキュメント更新
- `USAGE.md`: Discussion設定、カテゴリID取得方法、テンプレートカスタマイズ
- `GITHUB_ACTIONS_SETUP.md`: GH_PATのrepoスコープ必要性を明記
- `README.md`: 新機能の追加

## テスト結果

### ✅ 全テスト成功

1. **共通関数の構文チェック**: OK
2. **テンプレートファイル読み込み**: OK
3. **GitHub API（リポジトリID取得）**: OK
4. **GitHub API（DiscussionカテゴリID取得）**: OK
5. **Discussion作成（単純なテスト）**: OK
   - 作成URL: https://github.com/nuitsjp/swa-github-auth-study/discussions/7
6. **Discussion作成（招待リンク付き）**: OK
   - 作成URL: https://github.com/nuitsjp/swa-github-auth-study/discussions/8
7. **設定ファイル読み込み**: OK
8. **統合テスト（完全フロー）**: OK
   - 作成URL: https://github.com/nuitsjp/swa-github-auth-study/discussions/9
9. **Sync-SwaUsers.ps1 構文チェック**: OK
10. **Sync-SwaUsers.ps1 実行テスト**: OK（Azure認証までOK、リソース未存在で期待通り停止）

## 使用方法

### 1. DiscussionカテゴリIDの取得
```bash
gh api graphql -f query='
{
  repository(owner: "owner", name: "repo") {
    discussionCategories(first: 10) {
      nodes { id name }
    }
  }
}'
```

### 2. config.jsonの設定
```json
{
  "discussion": {
    "enabled": true,
    "categoryId": "DIC_kwDOxxxxxx",
    "titleTemplate": "invitation-title-template.txt",
    "bodyTemplate": "invitation-body-template.txt"
  }
}
```

### 3. スクリプト実行
```bash
pwsh -File ./scripts/Sync-SwaUsers.ps1
```

## 確認事項

- ✅ GraphQL API呼び出しの正しいエスケープ処理
- ✅ GitHub CLIの`-F`オプションで変数を安全に渡す
- ✅ 設定ファイルのパス解決（リポジトリルートからの相対パス）
- ✅ テンプレートプレースホルダーの置換
- ✅ エラーハンドリングとログ出力
- ✅ 実際のGitHub Discussionsへの投稿成功

## 作成されたテストDiscussions

1. #7: Test Discussion - Please Ignore
2. #8: Azure Static Web App への招待リンク（2ユーザー）
3. #9: Azure Static Web App への招待リンク（2ユーザー）

すべて正常に作成され、フォーマットも正しく表示されています。

## 実装完了

招待リンクをGitHub Discussionsに自動投稿する機能が完全に実装され、テスト済みです。
