import * as core from '@actions/core'
import * as github from '@actions/github'
import { graphql } from '@octokit/graphql'
import type { DesiredUser } from './types.js'

type Collaborator = {
  login: string
  permissions?: {
    admin?: boolean
    maintain?: boolean
    push?: boolean
  }
}

// Action入力からowner/repo形式を解析し、省略時はWorkflowのコンテキストを使う
/**
 * target-repo入力を解析し、省略時は現在のworkflowコンテキストを採用する。
 * @param input Action入力`target-repo`の文字列（owner/repo形式）。
 * @param contextRepo デフォルトのリポジトリ情報。
 * @returns ownerとrepoの組。
 */
export function parseTargetRepo(
  input: string | undefined,
  contextRepo = github.context.repo
): { owner: string; repo: string } {
  if (!input) {
    return { owner: contextRepo.owner, repo: contextRepo.repo }
  }
  const [owner, repo] = input.split('/')
  if (!owner || !repo) {
    throw new Error(`Invalid target-repo format: ${input}`)
  }
  return { owner, repo }
}

// GitHubコラボレーターの権限からSWAに対応するロールを推定する
function toRole(collaborator: Collaborator): DesiredUser | null {
  const { login, permissions } = collaborator
  if (permissions?.admin) {
    return { login, role: 'admin' }
  }
  if (permissions?.maintain || permissions?.push) {
    return { login, role: 'write' }
  }
  return null
}

// GitHub APIから書き込み以上の権限を持つメンバーを集め、同期対象ユーザーへ変換する
/**
 * GitHub APIからwrite/maintain/admin権限を持つユーザーを列挙し、同期用の形へ整形する。
 * @param octokit Octokitインスタンス。
 * @param owner リポジトリ所有者。
 * @param repo リポジトリ名。
 */
export async function listEligibleCollaborators(
  octokit: ReturnType<typeof github.getOctokit>,
  owner: string,
  repo: string
): Promise<DesiredUser[]> {
  const collaborators = await octokit.paginate(
    octokit.rest.repos.listCollaborators,
    {
      owner,
      repo,
      per_page: 100,
      affiliation: 'all'
    }
  )
  const desired = collaborators
    .map(toRole)
    .filter((user): user is DesiredUser => Boolean(user))

  core.debug(`Eligible collaborators: ${desired.length}`)
  return desired
}

// Discussionの作成にはカテゴリIDとリポジトリIDが必要なのでGraphQLで先に取得する
/**
 * Discussion作成に必要なリポジトリIDとカテゴリIDをGraphQLで取得する。
 * @param token GitHubトークン。
 * @param owner リポジトリ所有者。
 * @param repo リポジトリ名。
 * @param categoryName Discussionカテゴリ名。
 * @returns repositoryIdとcategoryId。
 */
export async function getDiscussionCategoryId(
  token: string,
  owner: string,
  repo: string,
  categoryName: string
): Promise<{ repositoryId: string; categoryId: string }> {
  const graphqlClient = graphql.defaults({
    headers: { authorization: `token ${token}` }
  })

  const query = await graphqlClient<{
    repository: {
      id: string
      discussionCategories: { nodes: { id: string; name: string }[] }
    }
  }>(
    `
      query ($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
          discussionCategories(first: 100) {
            nodes {
              id
              name
            }
          }
        }
      }
    `,
    { owner, repo }
  )

  const category = query.repository.discussionCategories.nodes.find(
    (node) => node.name === categoryName
  )
  if (!category) {
    throw new Error(`Discussion category "${categoryName}" not found`)
  }
  return { repositoryId: query.repository.id, categoryId: category.id }
}

// Discussionの作成。カテゴリIDは事前に取得しておき、ここではミューテーションのみ実行する
/**
 * 取得済みカテゴリIDを使ってDiscussionを作成する。
 * @param token GitHubトークン。
 * @param owner リポジトリ所有者（ログ出力時の整合用）。
 * @param repo リポジトリ名（ログ出力時の整合用）。
 * @param categoryName Discussionカテゴリ名（ログ出力時の整合用）。
 * @param title Discussionタイトル。
 * @param body Discussion本文。
 * @param categoryIds 事前取得済みのリポジトリIDとカテゴリID。
 * @returns 作成されたDiscussionのURL。
 */
export async function createDiscussion(
  token: string,
  owner: string,
  repo: string,
  categoryName: string,
  title: string,
  body: string,
  categoryIds: { repositoryId: string; categoryId: string }
): Promise<string> {
  if (!categoryIds) {
    throw new Error('categoryIds is required to create a discussion')
  }
  const graphqlClient = graphql.defaults({
    headers: { authorization: `token ${token}` }
  })
  const { repositoryId, categoryId } = categoryIds

  const mutation = await graphqlClient<{
    createDiscussion: { discussion: { url: string } }
  }>(
    `
      mutation (
        $repositoryId: ID!
        $categoryId: ID!
        $title: String!
        $body: String!
      ) {
        createDiscussion(
          input: {
            repositoryId: $repositoryId
            categoryId: $categoryId
            title: $title
            body: $body
          }
        ) {
          discussion {
            url
          }
        }
      }
    `,
    { repositoryId, categoryId, title, body }
  )
  return mutation.createDiscussion.discussion.url
}
