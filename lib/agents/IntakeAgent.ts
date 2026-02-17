import { GithubTool } from '../tools/GithubTool';
import { ElasticTool } from '../tools/ElasticTool';
import { RiskScoreTool } from '../tools/RiskScoreTool';
import type { IntakeResult } from '../types';

const DEBOUNCE_SECONDS = 300; // 5 minutes

export const IntakeStep = {
    name: 'Fetching Repo Data',
    description: 'Ingests PRs, Issues, and CI status via GitHub API with incremental sync, rate-limit handling, and ETag caching.',

    run: async (
        repoUrl: string,
        token?: string,
        onStep?: (step: string) => void
    ): Promise<IntakeResult> => {
        onStep?.('Parsing repository URL...');
        const { owner, repo } = GithubTool.parseRepoUrl(repoUrl);
        const repoFullName = `${owner}/${repo}`;

        onStep?.('Ensuring Elasticsearch indices...');
        await ElasticTool.ensureIndices();

        // Debounce check
        const lastIngestion = await ElasticTool.getLastIngestionTime(repoFullName);
        if (lastIngestion) {
            const elapsed = (Date.now() - new Date(lastIngestion).getTime()) / 1000;
            if (elapsed < DEBOUNCE_SECONDS) {
                onStep?.(`Recent ingestion detected (${Math.round(elapsed)}s ago). Using cached data.`);
                // Return cached counts from ES
                const client = ElasticTool.getClient();
                const [prCount, issueCount, contribCount] = await Promise.all([
                    client.count({ index: 'repo_prs', query: { term: { repo: repoFullName } } }),
                    client.count({ index: 'repo_issues', query: { term: { repo: repoFullName } } }),
                    client.count({ index: 'repo_contributors', query: { term: { repo: repoFullName } } }),
                ]);

                return {
                    repo: repoFullName,
                    counts: {
                        prs: prCount.count,
                        issues: issueCount.count,
                        contributors: contribCount.count,
                    },
                    skippedPrs: 0,
                    rateLimit: GithubTool.getRateLimitInfo(),
                    incrementalSync: true,
                };
            }
        }

        // Fetch PRs with progress reporting
        onStep?.('Fetching Pull Requests (rate-limit aware)...');
        let prProgress = 0;
        const prs = await GithubTool.fetchPullRequests(owner, repo, token, 20, (current, total) => {
            const pct = Math.round((current / total) * 100);
            if (pct > prProgress + 15) {
                prProgress = pct;
                onStep?.(`Processing PRs: ${current}/${total} (${pct}%)`);
            }
        });

        // Compute risk scores
        onStep?.('Computing deterministic risk scores...');
        const prDocs = prs.map(pr => {
            const { risk_score, risk_factors } = RiskScoreTool.computeRiskScore(pr);
            return {
                ...pr,
                repo: repoFullName,
                risk_score,
                risk_factors,
            };
        });

        // Incremental upsert PRs
        onStep?.('Indexing PRs (incremental upsert)...');
        const prCount = await ElasticTool.bulkUpsert(
            'repo_prs',
            prDocs as unknown as Record<string, unknown>[]
        );

        // Fetch and upsert Issues
        onStep?.('Fetching and indexing Issues...');
        const issues = await GithubTool.fetchIssues(owner, repo, token);
        const issueDocs = issues.map(issue => ({ ...issue, repo: repoFullName }));
        const issueCount = await ElasticTool.bulkUpsert(
            'repo_issues',
            issueDocs as unknown as Record<string, unknown>[]
        );

        // Fetch and upsert Contributors
        onStep?.('Fetching and indexing Contributors...');
        const contributors = await GithubTool.fetchContributors(owner, repo, token);
        const contributorDocs = contributors.map(c => ({ ...c, repo: repoFullName }));
        const contributorCount = await ElasticTool.bulkUpsert(
            'repo_contributors',
            contributorDocs as unknown as Record<string, unknown>[]
        );

        onStep?.('Ingestion complete.');

        return {
            repo: repoFullName,
            counts: {
                prs: prCount,
                issues: issueCount,
                contributors: contributorCount,
            },
            skippedPrs: 0,
            rateLimit: GithubTool.getRateLimitInfo(),
            incrementalSync: !!lastIngestion,
        };
    }
};
