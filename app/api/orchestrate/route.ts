import { NextRequest } from 'next/server';
import { PipelineOrchestrator } from '@/lib/AgentOrchestrator';
import type { OrchestratorEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const { repo_url, token: userToken } = await req.json();
    // Use provided token, fall back to env var
    const token = userToken || process.env.GITHUB_PAT || undefined;

    if (!repo_url) {
        return new Response(JSON.stringify({ error: 'repo_url is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (event: OrchestratorEvent) => {
                try {
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
                    );
                } catch {
                    // Stream may be closed
                }
            };

            try {
                await PipelineOrchestrator.run(repo_url, token, sendEvent);
                controller.close();
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                sendEvent({
                    type: 'error',
                    message,
                    timestamp: new Date().toISOString(),
                });
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
