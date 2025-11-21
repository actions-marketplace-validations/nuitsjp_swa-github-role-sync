# 期限切れDiscussion削除アクションの実装計画

GitHub Actionsの再利用可能なアクションとして、期限切れのSWA招待Discussionを削除する機能を追加します。
また、既存の同期アクションとの構成上の対称性を確保するため、既存コードのリファクタリングも行います。

## 1. 既存アクションの構成変更（対称性の確保）

- [ ] `src/index.ts` を `src/sync.ts` にリネームする
  - 同期アクションのエントリーポイントであることを明確にするため。
- [ ] `action.yml` の修正
  - `runs.main` のパスを `dist/index.js` から `dist/sync.js` に変更する。

## 2. 新規アクション `cleanup-discussions` の定義

- [ ] `cleanup-discussions/action.yml` の作成
  - **Inputs**:
    - `github-token`: (必須) GitHub APIトークン
    - `target-repo`: (任意) 対象リポジトリ (owner/repo)。デフォルトは実行リポジトリ。
    - `discussion-category-name`: (必須) 検索対象のDiscussionカテゴリ名。
    - `expiration-hours`: (任意) 削除対象とする経過時間（時間単位）。デフォルトは `24`。
    - `discussion-title-template`: (任意) 検索対象Discussionのタイトルパターン。同期アクションと一致させる必要がある。
  - **Runs**:
    - `using: 'node20'`
    - `main: '../dist/cleanup.js'`

## 3. 実装 (`src/cleanup.ts`)

- [ ] `src/cleanup.ts` の作成
  - **主な処理フロー**:
    1. Inputsの取得とバリデーション。
    2. 削除基準時刻の計算 (`現在時刻 - expiration-hours`)。
    3. GitHub GraphQL APIを使用してDiscussionを取得。
       - `src/github.ts` の既存関数 (`getDiscussionCategoryId` 等) を再利用またはリファクタリングして活用する。
       - ページネーション対応が必要。
    4. フィルタリング:
       - カテゴリが一致すること。
       - タイトルが `discussion-title-template` のパターン（正規表現等でマッチング）に合致すること。
       - 作成日時 (`createdAt`) が基準時刻より前であること。
    5. 対象Discussionの削除実行 (`deleteDiscussion` mutation)。
    6. 結果のサマリー出力 (削除数など)。

## 4. ビルド構成の更新 (`rollup.config.ts`)

- [ ] `rollup.config.ts` の修正
  - マルチエントリーポイント対応に変更する。
  - `src/sync.ts` -> `dist/sync.js`
  - `src/cleanup.ts` -> `dist/cleanup.js`

## 5. テスト

- [ ] `__tests__/cleanup.test.ts` の作成
  - モックを使用したユニットテストの実装。
  - 期限切れ判定ロジックのテスト。
  - API呼び出しのテスト。

## 6. 検証

- [ ] ビルド確認
  - `npm run package` を実行し、`dist/sync.js` と `dist/cleanup.js` が正しく生成されることを確認。
- [ ] テスト実行
  - `npm test` がパスすることを確認。
