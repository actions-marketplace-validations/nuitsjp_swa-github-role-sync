# TODO: 次の課題リスト

1. 実環境でのE2E検証 ... done
2. 失敗時のハンドリング/ログ強化... done
3. テスト拡充... done
4. 入力バリデーション/テンプレート... done
5. CI/CD改善 ... done
6. リリース準備

- バージョン付け（例: `v0.1.0` → `v1.0.0`）と`v1`タグ運用の整備。
- Marketplace公開を想定した`branding`調整とREADMEの使用例追記。
- リリースフローの具体化:
  1. `main`最新化 → `npm run verify && npm run package`で`dist/`を刷新。
  2. `release/vX.Y.Z`ブランチでREADME/ドキュメント更新 + `dist/`コミット → PRでレビュー。
  3. マージ後にGitHub Actions `Release`ワークフローを`workflow_dispatch`で実行し、`version`入力（例: `1.0.0`）を渡す。
  4. ワークフロー内で`git tag vX.Y.Z`, `git tag -f v1`, `gh release create vX.Y.Z --generate-notes`を実行。
  5. `release`ワークフローは`workflow_dispatch`に加えて`push`の`v*`タグでも起動できるようにし、CLI(`gh workflow run release.yml -f version=...`)からも再現可能にする。
- Release Notes方針: GitHubの自動リリースノート生成(`gh release create vX.Y.Z --generate-notes`)を採用し、追加のMarkdownファイル管理は行わない。
- リリーストリガー案: GitHub UIからの手動実行に加え、保守しやすいのは「タグをpushした時に同じ`release`ワークフローが走る」構成。タグが唯一のソースになるため、UIでの入力ミスを避けつつ、必要に応じてUI `workflow_dispatch`で再実行できる二段構成を採用。
