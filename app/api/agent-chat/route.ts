import { NextRequest } from 'next/server';
import { AgentBuilderTool } from '@/lib/tools/AgentBuilderTool';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { message, repo, conversationId } = await req.json();

        if (!message) {
            return Response.json({ error: 'message is required' }, { status: 400 });
        }

        // Check if Agent Builder is available
        const available = await AgentBuilderTool.isAvailable();

        if (!available) {
            return Response.json({
                response: {
                    message: 'Agent Builder is not configured. Please set KIBANA_URL, ELASTIC_AGENT_ID, and authentication credentials in your .env file. Create an agent in the Kibana Agent Builder UI first.',
                    tool_calls: [],
                },
                conversationId: null,
                agentBuilderAvailable: false,
            });
        }

        // Enrich message with repo context if provided
        const enrichedMessage = repo
            ? `[Repository: ${repo}] ${message}`
            : message;

        const result = await AgentBuilderTool.converse(enrichedMessage, conversationId);

        return Response.json({
            ...result,
            agentId: AgentBuilderTool.getAgentId(),
            agentBuilderAvailable: true,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[AgentChat] Error:', message);
        return Response.json({ error: message }, { status: 500 });
    }
}
