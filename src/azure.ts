import { execFile, type ExecFileException } from 'node:child_process'
import { promisify } from 'node:util'
import * as core from '@actions/core'
import type { SwaUser } from './types.js'

// Jestから差し替えやすいようにexecFileをPromise化した関数を共有で持つ
const execFileAsync = promisify(execFile)

// Azure CLIを呼び出す共通ルーチン。stderrの情報を握り潰さないように整形する
async function runAzCommand(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('az', args, {
      maxBuffer: 10 * 1024 * 1024
    })
    return stdout
  } catch (error) {
    const execError = error as ExecFileException & { stderr?: string }
    const stderr =
      typeof execError?.stderr === 'string' ? execError.stderr.trim() : ''
    if (stderr && !execError.message.includes(stderr)) {
      execError.message = `${execError.message}\n${stderr}`
    }
    throw execError
  }
}

// provider文字列はケースや空白が不定なのでここでそろえて比較する
function normalizeProvider(provider: string | undefined): string {
  return provider ? provider.trim().toLowerCase() : ''
}

/**
 * SWAに登録されているGitHubユーザー一覧を取得する。
 * @param name Static Web App名。
 * @param resourceGroup リソースグループ名。
 * @returns GitHubプロバイダーのユーザーのみを返す配列。
 */
export async function listSwaUsers(
  name: string,
  resourceGroup: string
): Promise<SwaUser[]> {
  // ユーザー一覧はproviderでフィルタするため、JSON出力を取得して後段で処理する
  const stdout = await runAzCommand([
    'staticwebapp',
    'users',
    'list',
    '--name',
    name,
    '--resource-group',
    resourceGroup,
    '--output',
    'json'
  ])
  const users = JSON.parse(stdout) as SwaUser[]
  // GitHub経由のユーザーのみを対象にする（Azure ADなど他プロバイダーは除外）
  const githubUsers = users.filter(
    (user): user is SwaUser => normalizeProvider(user.provider) === 'github'
  )
  core.debug(`Fetched ${githubUsers.length} SWA GitHub users`)
  return githubUsers
}

/**
 * SWAの既定ホスト名（*.azurestaticapps.netやカスタムドメイン）を解決する。
 * @param name Static Web App名。
 * @param resourceGroup リソースグループ名。
 * @returns 既定ホスト名。
 * @throws 解決できない場合。
 */
export async function getSwaDefaultHostname(
  name: string,
  resourceGroup: string
): Promise<string> {
  // 既定ホスト名はtsv形式で1行だけ返るのでtrimして空判定する
  const stdout = await runAzCommand([
    'staticwebapp',
    'show',
    '--name',
    name,
    '--resource-group',
    resourceGroup,
    '--query',
    'defaultHostname',
    '--output',
    'tsv'
  ])
  const domain = stdout.trim()
  if (!domain) {
    throw new Error('Failed to resolve default hostname for Static Web App')
  }
  return domain
}

/**
 * GitHubユーザーをSWAへ招待するためのURLを発行する。
 * @param name Static Web App名。
 * @param resourceGroup リソースグループ名。
 * @param domain 招待URLに含めるドメイン。
 * @param githubUser 招待対象のGitHubログイン。
 * @param roles 付与するロール（カンマ区切り）。
 * @param expirationHours 招待リンクの有効期限（時間）。省略時は24時間。
 * @returns 招待URL。
 */
export async function inviteUser(
  name: string,
  resourceGroup: string,
  domain: string,
  githubUser: string,
  roles: string,
  expirationHours = 24
): Promise<string> {
  // 招待APIは複数種のキーでURLを返すことがあるので既知の順で引き当てる
  const stdout = await runAzCommand([
    'staticwebapp',
    'users',
    'invite',
    '--name',
    name,
    '--resource-group',
    resourceGroup,
    '--authentication-provider',
    'GitHub',
    '--user-details',
    githubUser,
    '--roles',
    roles,
    '--domain',
    domain,
    '--invitation-expiration-in-hours',
    String(expirationHours),
    '--output',
    'json'
  ])
  const result = JSON.parse(stdout) as Record<string, string>
  const url = result.inviteUrl ?? result.invitationUrl ?? result.url ?? ''
  if (!url) {
    throw new Error(`Failed to retrieve invite URL for ${githubUser}`)
  }
  return url
}

/**
 * 既存のSWAユーザーに対してロールを更新する。
 * @param name Static Web App名。
 * @param resourceGroup リソースグループ名。
 * @param githubUser 対象GitHubユーザー。
 * @param roles 設定するロール（カンマ区切り）。空文字で削除を指示。
 */
export async function updateUserRoles(
  name: string,
  resourceGroup: string,
  githubUser: string,
  roles: string
): Promise<void> {
  // updateコマンドはinviteと違い戻り値を使わない
  await runAzCommand([
    'staticwebapp',
    'users',
    'update',
    '--name',
    name,
    '--resource-group',
    resourceGroup,
    '--authentication-provider',
    'GitHub',
    '--user-details',
    githubUser,
    '--roles',
    roles
  ])
}

/**
 * SWAユーザーからすべてのロールを削除する。
 * @param name Static Web App名。
 * @param resourceGroup リソースグループ名。
 * @param githubUser 対象GitHubユーザー。
 */
export async function clearUserRoles(
  name: string,
  resourceGroup: string,
  githubUser: string
): Promise<void> {
  // 空文字を渡すことでAzure CLI側にロール削除を指示する
  await updateUserRoles(name, resourceGroup, githubUser, '')
}
