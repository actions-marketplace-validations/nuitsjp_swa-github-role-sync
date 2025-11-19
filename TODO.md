# TODO: 次の課題リスト

1. 実環境でのE2E検証 ... done
2. 失敗時のハンドリング/ログ強化... done
3. テスト拡充... done
4. 入力バリデーション/テンプレート... done
5. CI/CD改善

- 現在CIはformat/lint/testのみ。`check-dist`ワークフローで`dist`差分を検証済みだが、必要なら`npm run bundle`をCIジョブに追加。
- SAST/依存関係スキャン（CodeQL継続利用、npm auditの扱い）方針を決める。
- 現在、GitHub Actionsの各ワークフローが独立しているが、必要に応じてジョブを統合し、効率化を図る。LintやCheck系などは一つのワークフローにまとめて、並行実行を活用することも検討。

6. リリース準備

- バージョン付け（例: `v0.1.0` → `v1.0.0`）と`v1`タグ運用の整備。
- Marketplace公開を想定した`branding`調整とREADMEのスクリーンショット/使用例追記。

