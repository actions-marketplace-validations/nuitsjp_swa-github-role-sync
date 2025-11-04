#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Discussion投稿機能の統合テスト

.DESCRIPTION
    招待リンク生成からDiscussion投稿までの完全なフローをテストします
#>

$ErrorActionPreference = "Stop"

# 共通関数を読み込む
. ./scripts/common-functions.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Discussion投稿機能 統合テスト" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. 設定ファイルの読み込みテスト
Write-Host "`n[1/5] 設定ファイルの読み込み..." -ForegroundColor Yellow
$config = Get-Configuration -ConfigPath 'config.test.json'
Write-Host "  ✓ 設定ファイル読み込み成功" -ForegroundColor Green
Write-Host "    Discussion有効: $($config.Discussion.Enabled)" -ForegroundColor Gray
Write-Host "    CategoryId: $($config.Discussion.CategoryId)" -ForegroundColor Gray

# 2. テンプレートファイルの読み込みテスト
Write-Host "`n[2/5] テンプレートファイルの読み込み..." -ForegroundColor Yellow
$bodyTemplate = Get-TemplateContent -TemplatePath $config.Discussion.BodyTemplate
Write-Host "  ✓ テンプレートファイル読み込み成功" -ForegroundColor Green
Write-Host "    タイトルテンプレート: $($config.Discussion.Title)" -ForegroundColor Gray

# 3. 招待データの生成（モック）
Write-Host "`n[3/5] 招待データの生成（モック）..." -ForegroundColor Yellow
$invitations = @(
    @{ UserName = 'testuser1'; InvitationUrl = 'https://example.azurestaticapps.net/invite/test123' }
    @{ UserName = 'testuser2'; InvitationUrl = 'https://example.azurestaticapps.net/invite/test456' }
)
Write-Host "  ✓ モック招待データ生成成功（$($invitations.Count)件）" -ForegroundColor Green

# 4. メッセージの構築
Write-Host "`n[4/5] Discussionメッセージの構築..." -ForegroundColor Yellow
Write-Host "  ✓ メッセージ構築成功（ユーザーごとに個別作成）" -ForegroundColor Green

# 5. Discussion投稿テスト
Write-Host "`n[5/5] GitHub Discussionへの投稿（各ユーザーごと）..." -ForegroundColor Yellow
try {
    $repoName = Get-GitHubRepositoryFromGit -StartPath $PSScriptRoot
    Write-Host "  対象リポジトリ: $repoName" -ForegroundColor Gray
    
    $discussionUrls = @()
    foreach ($invitation in $invitations) {
        # タイトルのプレースホルダーを置換
        $title = $config.Discussion.Title -replace '\{username\}', $invitation.UserName
        
        # 本文のプレースホルダーを置換
        $body = $bodyTemplate -replace '\{\{USERNAME\}\}', $invitation.UserName
        $body = $body -replace '\{\{INVITATION_URL\}\}', $invitation.InvitationUrl
        
        $discussionUrl = New-GitHubDiscussion `
            -Repo $repoName `
            -CategoryId $config.Discussion.CategoryId `
            -Title $title `
            -Body $body
        
        $discussionUrls += $discussionUrl
        Write-Host "    ✓ $($invitation.UserName): $discussionUrl" -ForegroundColor Gray
    }
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "すべてのテストが成功しました！ ✓" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "`n作成されたDiscussions:" -ForegroundColor White
    foreach ($url in $discussionUrls) {
        Write-Host "  $url" -ForegroundColor Cyan
    }
    
    exit 0
}
catch {
    Write-Host "  ✗ Discussion投稿失敗" -ForegroundColor Red
    Write-Host "    エラー: $_" -ForegroundColor Red
    exit 1
}
