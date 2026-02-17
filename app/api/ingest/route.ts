import { NextResponse } from 'next/server';
import { GithubTool } from '@/lib/tools/GithubTool';
import { RiskScoreTool } from '@/lib/tools/RiskScoreTool';
import { ElasticTool } from '@/lib/tools/ElasticTool';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { repo_url, token } = body as { repo_url: string; token?: string };

        if (!repo_url) {
            return NextResponse.json({ error: 'repo_url is required' }, { status: 400 });
        }

        const { owner, repo } = GithubTool.parseRepoUrl(repo_url);
        const repoFullName = `${owner}/${repo}`;

        await ElasticTool.ensureIndices();

        const prs = await GithubTool.fetchPullRequests(owner, repo, token);
        const issues = await GithubTool.fetchIssues(owner, repo, token);
        const contributors = await GithubTool.fetchContributors(owner, repo, token);

        const prsWithRisk = prs.map((pr) => {
            const { risk_score, risk_factors } = RiskScoreTool.computeRiskScore(pr);
            return { ...pr, risk_score, risk_factors };
        });

        const highRiskCount = prsWithRisk.filter((p) => p.risk_score >= 40).length;

        const prCount = await ElasticTool.bulkUpsert(
            'repo_prs',
            prsWithRisk as unknown as Record<string, unknown>[]
        );
        const issueCount = await ElasticTool.bulkUpsert(
            'repo_issues',
            issues as unknown as Record<string, unknown>[]
        );
        const contributorCount = await ElasticTool.bulkUpsert(
            'repo_contributors',
            contributors as unknown as Record<string, unknown>[]
        );

        return NextResponse.json({
            success: true,
            repo: repoFullName,
            counts: { prs: prCount, issues: issueCount, contributors: contributorCount },
            high_risk_prs: highRiskCount,
        });
    } catch (error) {
        console.error('[Ingest] Error:', error);
        return NextResponse.json(
            {
                error: 'Ingestion failed',
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
