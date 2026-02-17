import type { GitHubRateLimitInfo } from '../types';

// ─── Types ───

export interface PRData {
    repo: string;
    pr_number: number;
    title: string;
    body: string;
    state: string;
    author: string;
    labels: string[];
    created_at: string;
    updated_at: string;
    merged_at: string | null;
    closed_at: string | null;
    files_changed: number;
    lines_added: number;
    lines_deleted: number;
    is_first_time_contributor: boolean;
    pr_age_days: number;
    ci_status: string;
    html_url: string;
}

export interface IssueData {
    repo: string;
    issue_number: number;
    title: string;
    body: string;
    state: string;
    author: string;
    labels: string[];
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    comments_count: number;
    html_url: string;
}

export interface ContributorData {
    repo: string;
    login: string;
    contributions: number;
    avatar_url: string;
    profile_url: string;
}

// ─── Constants ───

const GITHUB_API = 'https://api.github.com';
const MAX_BACKOFF_MS = 30_000;
const RATE_LIMIT_BUFFER = 3;

// ─── ETag Cache ───

interface CacheEntry {
    etag: string;
    data: unknown;
    timestamp: number;
}

const etagCache = new Map<string, CacheEntry>();

// ─── Rate Limit State ───

let currentRateLimit: GitHubRateLimitInfo | null = null;

function parseRateLimitHeaders(headers: Headers): void {
    const remaining = headers.get('x-ratelimit-remaining');
    const limit = headers.get('x-ratelimit-limit');
    const reset = headers.get('x-ratelimit-reset');
    const used = headers.get('x-ratelimit-used');

    if (remaining !== null && limit !== null && reset !== null) {
        currentRateLimit = {
            remaining: parseInt(remaining, 10),
            limit: parseInt(limit, 10),
            reset: parseInt(reset, 10),
            used: used ? parseInt(used, 10) : 0,
        };
    }
}

export function getRateLimitInfo(): GitHubRateLimitInfo | null {
    return currentRateLimit;
}

// ─── Backoff ───

async function sleepMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRateLimitReset(): Promise<void> {
    if (!currentRateLimit || currentRateLimit.remaining >= RATE_LIMIT_BUFFER) return;

    const now = Math.floor(Date.now() / 1000);
    const waitSec = Math.max(0, currentRateLimit.reset - now) + 1;
    if (waitSec > 0 && waitSec < 900) { // max 15 min wait, not 1 hour
        console.log(`[GitHub] Rate limit low (${currentRateLimit.remaining} remaining). Waiting ${waitSec}s for reset...`);
        await sleepMs(waitSec * 1000);
    }
}

// ─── Core Fetch with ETag + Rate Limit + Backoff ───

function buildHeaders(token?: string): Record<string, string> {
    const h: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'OSS-Maintainer-Elastic/2.0',
    };
    if (token) {
        h['Authorization'] = `Bearer ${token}`;
    }
    return h;
}

async function ghFetch<T>(url: string, token?: string, useEtag = true): Promise<T> {
    await waitForRateLimitReset();

    const h = buildHeaders(token);

    // Conditional request with ETag
    const cached = etagCache.get(url);
    if (useEtag && cached?.etag) {
        h['If-None-Match'] = cached.etag;
    }

    let lastError: Error | null = null;
    let backoff = 1000;

    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const res = await fetch(url, { headers: h });
            parseRateLimitHeaders(res.headers);

            // 304 Not Modified — return cached data
            if (res.status === 304 && cached) {
                return cached.data as T;
            }

            // Rate limited — backoff
            if (res.status === 403 || res.status === 429) {
                const retryAfter = res.headers.get('retry-after');
                const waitMs = retryAfter
                    ? parseInt(retryAfter, 10) * 1000
                    : Math.min(backoff + Math.random() * 500, MAX_BACKOFF_MS);

                console.warn(`[GitHub] Rate limited (${res.status}). Retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/5)`);
                await sleepMs(waitMs);
                backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
                continue;
            }

            if (!res.ok) {
                const body = await res.text();
                throw new Error(`GitHub API error ${res.status} for ${url}: ${body.slice(0, 200)}`);
            }

            const data = await res.json() as T;

            // Cache the response with ETag
            const etag = res.headers.get('etag');
            if (etag) {
                etagCache.set(url, { etag, data, timestamp: Date.now() });
            }

            return data;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < 4) {
                const waitMs = Math.min(backoff + Math.random() * 500, MAX_BACKOFF_MS);
                console.warn(`[GitHub] Fetch error. Retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/5): ${lastError.message}`);
                await sleepMs(waitMs);
                backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
            }
        }
    }

    throw lastError || new Error(`Failed to fetch ${url} after 5 attempts`);
}

// ─── Parse Repo URL ───

export function parseRepoUrl(url: string): { owner: string; repo: string } {
    const cleaned = url.replace(/\.git$/, '').replace(/\/$/, '');
    const ghMatch = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (ghMatch) {
        return { owner: ghMatch[1], repo: ghMatch[2] };
    }
    const slashMatch = cleaned.match(/^([^/]+)\/([^/]+)$/);
    if (slashMatch) {
        return { owner: slashMatch[1], repo: slashMatch[2] };
    }
    throw new Error(`Invalid GitHub repo URL: ${url}`);
}

// ─── Fetch Pull Requests ───

interface GHPullListItem {
    number: number;
    title: string;
    body: string | null;
    state: string;
    user: { login: string } | null;
    labels: Array<{ name: string }>;
    created_at: string;
    updated_at: string;
    merged_at: string | null;
    closed_at: string | null;
    html_url: string;
    head: { sha: string };
}

interface GHPullDetail {
    additions: number;
    deletions: number;
    changed_files: number;
}

interface GHCombinedStatus {
    state: string;
}

export async function fetchPullRequests(
    owner: string,
    repo: string,
    token?: string,
    maxPrs = 20,
    onProgress?: (current: number, total: number) => void
): Promise<PRData[]> {
    const repoFullName = `${owner}/${repo}`;
    const cap = Math.min(maxPrs, 100);

    const prList = await ghFetch<GHPullListItem[]>(
        `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=all&per_page=${cap}&sort=created&direction=desc`,
        token
    );

    console.log(`[GitHub] Fetched ${prList.length} PRs for ${repoFullName}`);

    const results: PRData[] = [];
    const batchSize = 5;

    for (let i = 0; i < prList.length; i += batchSize) {
        const batch = prList.slice(i, i + batchSize);
        const batchResults = await Promise.all(
            batch.map(async (pr) => {
                let filesChanged = 0, linesAdded = 0, linesDeleted = 0;
                try {
                    const detail = await ghFetch<GHPullDetail>(
                        `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pr.number}`,
                        token
                    );
                    filesChanged = detail.changed_files;
                    linesAdded = detail.additions;
                    linesDeleted = detail.deletions;
                } catch (err) {
                    console.warn(`[GitHub] Could not fetch detail for PR #${pr.number}: ${err}`);
                }

                let ciStatus = 'unknown';
                try {
                    const status = await ghFetch<GHCombinedStatus>(
                        `${GITHUB_API}/repos/${owner}/${repo}/commits/${pr.head.sha}/status`,
                        token
                    );
                    ciStatus = status.state || 'unknown';
                } catch {
                    // CI not available
                }

                const createdDate = new Date(pr.created_at);
                const endDate = pr.merged_at
                    ? new Date(pr.merged_at)
                    : pr.closed_at
                        ? new Date(pr.closed_at)
                        : new Date();
                const prAgeDays =
                    (endDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);

                let isFirstTime = false;
                // Only check first-time contributor with a token — the search API
                // is very aggressively rate-limited for unauthenticated users
                if (token && pr.user?.login) {
                    try {
                        isFirstTime = await isFirstTimeContributor(owner, repo, pr.user.login, token);
                    } catch {
                        // default false
                    }
                }

                return {
                    repo: repoFullName,
                    pr_number: pr.number,
                    title: pr.title,
                    body: pr.body || '',
                    state: pr.merged_at ? 'merged' : pr.state,
                    author: pr.user?.login || 'unknown',
                    labels: pr.labels.map((l) => l.name),
                    created_at: pr.created_at,
                    updated_at: pr.updated_at,
                    merged_at: pr.merged_at,
                    closed_at: pr.closed_at,
                    files_changed: filesChanged,
                    lines_added: linesAdded,
                    lines_deleted: linesDeleted,
                    is_first_time_contributor: isFirstTime,
                    pr_age_days: Math.round(prAgeDays * 100) / 100,
                    ci_status: ciStatus,
                    html_url: pr.html_url,
                } satisfies PRData;
            })
        );
        results.push(...batchResults);
        onProgress?.(Math.min(results.length, prList.length), prList.length);
    }

    return results;
}

// ─── First-time Contributor Check ───

interface GHCommitSearchResult {
    total_count: number;
}

async function isFirstTimeContributor(
    owner: string,
    repo: string,
    author: string,
    token?: string
): Promise<boolean> {
    try {
        const result = await ghFetch<GHCommitSearchResult>(
            `${GITHUB_API}/search/commits?q=author:${author}+repo:${owner}/${repo}&per_page=1`,
            token
        );
        return result.total_count <= 1;
    } catch {
        return false;
    }
}

// ─── Fetch Issues ───

interface GHIssueListItem {
    number: number;
    title: string;
    body: string | null;
    state: string;
    user: { login: string } | null;
    labels: Array<{ name: string }>;
    created_at: string;
    updated_at: string;
    closed_at: string | null;
    comments: number;
    html_url: string;
    pull_request?: unknown;
}

export async function fetchIssues(
    owner: string,
    repo: string,
    token?: string
): Promise<IssueData[]> {
    const repoFullName = `${owner}/${repo}`;

    const issues = await ghFetch<GHIssueListItem[]>(
        `${GITHUB_API}/repos/${owner}/${repo}/issues?state=all&per_page=30&sort=created&direction=desc`,
        token
    );

    const realIssues = issues.filter((i) => !i.pull_request);
    console.log(
        `[GitHub] Fetched ${realIssues.length} issues for ${repoFullName} (filtered from ${issues.length})`
    );

    return realIssues.map((issue) => ({
        repo: repoFullName,
        issue_number: issue.number,
        title: issue.title,
        body: issue.body || '',
        state: issue.state,
        author: issue.user?.login || 'unknown',
        labels: issue.labels.map((l) => l.name),
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at,
        comments_count: issue.comments,
        html_url: issue.html_url,
    }));
}

// ─── Fetch Contributors ───

interface GHContributorItem {
    login: string;
    contributions: number;
    avatar_url: string;
    html_url: string;
}

export async function fetchContributors(
    owner: string,
    repo: string,
    token?: string
): Promise<ContributorData[]> {
    const repoFullName = `${owner}/${repo}`;

    const contributors = await ghFetch<GHContributorItem[]>(
        `${GITHUB_API}/repos/${owner}/${repo}/contributors?per_page=30`,
        token
    );

    console.log(`[GitHub] Fetched ${contributors.length} contributors for ${repoFullName}`);

    return contributors.map((c) => ({
        repo: repoFullName,
        login: c.login,
        contributions: c.contributions,
        avatar_url: c.avatar_url,
        profile_url: c.html_url,
    }));
}

// ─── Exports ───

export const GithubTool = {
    parseRepoUrl,
    fetchPullRequests,
    fetchIssues,
    fetchContributors,
    isFirstTimeContributor,
    getRateLimitInfo,
};
