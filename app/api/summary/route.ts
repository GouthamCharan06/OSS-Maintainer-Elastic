import { NextResponse } from 'next/server';
import { AnalyticsTool } from '@/lib/tools/AnalyticsTool';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const repo = searchParams.get('repo');

    if (!repo) {
        return NextResponse.json({ error: 'repo parameter is required' }, { status: 400 });
    }

    try {
        const summary = await AnalyticsTool.getRepoHealthSummary(repo);
        return NextResponse.json(summary);
    } catch (error) {
        console.error('[Summary] Error:', error);
        return NextResponse.json(
            {
                error: 'Summary query failed',
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 }
        );
    }
}
