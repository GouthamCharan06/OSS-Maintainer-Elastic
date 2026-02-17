import { NextResponse } from 'next/server';
import { ElasticTool } from '@/lib/tools/ElasticTool';

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

        const limit = parseInt(searchParams.get('limit') || '20', 10);
        const client = ElasticTool.getClient();

        const result = await client.search({
            index: 'repo_prs',
            size: limit,
            query: {
                term: { repo },
            },
            sort: [{ risk_score: { order: 'desc' } }],
            _source: [
                'pr_number', 'title', 'state', 'author',
                'risk_score', 'risk_factors',
                'files_changed', 'lines_added', 'lines_deleted',
                'is_first_time_contributor', 'pr_age_days',
                'ci_status', 'labels', 'created_at', 'html_url',
            ],
        });

        const prs = result.hits.hits.map((hit) => hit._source);

        return NextResponse.json({
            repo,
            total: result.hits.total,
            high_risk_prs: prs,
        });
    } catch (error) {
        console.error('[Risk] Error:', error);
        return NextResponse.json(
            {
                error: 'Risk query failed',
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
