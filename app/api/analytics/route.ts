import { NextResponse } from 'next/server';
import { AnalyticsTool } from '@/lib/tools/AnalyticsTool';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const repo = searchParams.get('repo');
        if (!repo) {
            return NextResponse.json(
                { error: 'repo parameter is required' },
                { status: 400 }
            );
        }

        const [prDist, avgMerge, contributors, ciRate, stalePrs] = await Promise.all([
            AnalyticsTool.getPrDistributionByStatus(repo),
            AnalyticsTool.getAverageMergeTime(repo),
            AnalyticsTool.getContributorRanking(repo),
            AnalyticsTool.getCiFailureRate(repo),
            AnalyticsTool.getStalePrCount(repo),
        ]);

        return NextResponse.json({
            repo,
            pr_distribution: prDist,
            avg_merge_time: avgMerge,
            contributor_ranking: contributors,
            ci_failure_rate: ciRate,
            stale_pr_count: stalePrs,
        });
    } catch (error) {
        console.error('[Analytics] Error:', error);
        return NextResponse.json(
            {
                error: 'Analytics query failed',
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
