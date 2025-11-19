# swa-github-role-sync

Sync Azure Static Web Apps roles with GitHub repository permissions and publish
invite links to a new Discussion.

## What this action does

- Collects repository collaborators who have `admin` or `write/maintain`
  permission.
- Lists existing GitHub provider users on the target Static Web App.
- Creates invites/role assignments for missing users, updates roles for existing
  users, and clears roles for users who lost access.
- Posts invite links and a summary to a fresh GitHub Discussion, and writes the
  same summary to `GITHUB_STEP_SUMMARY`.

## Prerequisites

- Run `azure/login` with OIDC before this action so `az staticwebapp users ...`
  works.
- Repository has Discussions enabled.
- Workflow `permissions` include `discussions: write`, `id-token: write`,
  `contents: read`.

## Inputs

- `github-token` (required): Token that can read collaborators and create
  Discussions (usually `${{ github.token }}`).
- `target-repo`: `owner/repo`. Defaults to the current repository.
- `swa-name` / `swa-resource-group` (required): Target Static Web App info.
- `swa-domain` (optional): Domain used for invite links. Defaults to SWA
  `defaultHostname` retrieved via `az staticwebapp show`.
- `role-for-admin` (default `github-admin`): SWA role for GitHub admins.
- `role-for-write` (default `github-writer`): SWA role for GitHub write/maintain
  users.
- `discussion-category-name` (required): Category name for the announcement
  Discussion.
- `discussion-title-template` (default
  `SWA access invites for {swaName} ({repo}) - {date}`).
- `discussion-body-template` (default body that embeds `{summaryMarkdown}`).

Placeholders: `{swaName}`, `{repo}`, `{date}`, `{summaryMarkdown}`.

## Outputs

- `added-count`, `updated-count`, `removed-count`: Operation counts.
- `discussion-url`: URL of the created Discussion (empty on failure).

## Example workflow

```yaml
name: Sync SWA roles from GitHub repo

on:
  workflow_dispatch:
  schedule:
    - cron: '0 9 * * 1'

permissions:
  id-token: write
  contents: read
  discussions: write

jobs:
  sync-swa-roles:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Azure login (OIDC)
        uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Sync SWA roles
        uses: ./
        with:
          github-token: ${{ github.token }}
          target-repo: ${{ github.repository }}
          swa-name: your-swa-name
          swa-resource-group: your-swa-resource-group
          role-for-admin: github-admin
          role-for-write: github-writer
          discussion-category-name: 'Announcements'
```

## Development

- Install deps: `npm install`
- Lint/test/build: `npm run lint && npm test && npm run package`
- Bundle for release: `npm run bundle` (runs prettier + `rollup`)

See `docs/design.md` for the detailed design.

## Release & versioning

- Tags follow SemVer (`v1.2.3`), while the floating `v1` tag always points to the
  latest stable major release.
- See [`docs/release.md`](docs/release.md) for the release checklistと自動リリースノート手順。
- GitHub Releaseは`gh release create vX.Y.Z --generate-notes`で自動生成ノートを利用し、
  追加のMarkdownファイルは不要です。
- リリースワークフローはGitHub UI(`workflow_dispatch`で`version`入力)と`push`の`v*`タグ
  トリガーの両方に対応し、手動/CLIのどちらからでも同じ処理を再現できます。
- `1.2.3-beta.1`のようなハイフン付きバージョンを指定した場合はpre-release扱いとなり、
  GitHub Releaseがプレリリース化され、`v1`タグ更新はスキップされます（動作検証時に便利）。
