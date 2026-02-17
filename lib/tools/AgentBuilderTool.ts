// ─── Elastic Agent Builder API Client ───
// Uses Kibana APIs: /api/agent_builder/converse
// Agent and tools are created via Kibana UI, not programmatically
// Supports both API key auth (serverless) and basic auth (hosted)

const KIBANA_URL = process.env.KIBANA_URL || process.env.ELASTICSEARCH_URL?.replace('.es.', '.kb.') || '';

// Auth: prefer basic auth for Kibana, fall back to API key (works on serverless)
const KIBANA_USERNAME = process.env.KIBANA_USERNAME || '';
const KIBANA_PASSWORD = process.env.KIBANA_PASSWORD || '';
const KIBANA_API_KEY = process.env.KIBANA_API_KEY || process.env.ELASTICSEARCH_API_KEY || '';

// Agent ID — created via Kibana Agent Builder UI
const AGENT_ID = process.env.ELASTIC_AGENT_ID || '';

function getAuthHeader(): string {
    if (KIBANA_USERNAME && KIBANA_PASSWORD) {
        const encoded = Buffer.from(`${KIBANA_USERNAME}:${KIBANA_PASSWORD}`).toString('base64');
        return `Basic ${encoded}`;
    }
    if (KIBANA_API_KEY) {
        return `ApiKey ${KIBANA_API_KEY}`;
    }
    return '';
}

// ─── Types ───

interface ConverseResponse {
    output: string;
    message?: string;
    tool_calls?: Array<{
        tool_id: string;
        input: Record<string, unknown>;
        output: unknown;
    }>;
    reasoning?: string;
    steps?: AgentStep[];
}

export interface AgentStep {
    type: 'reasoning' | 'tool_call';
    reasoning?: string;
    tool_id?: string;
    params?: Record<string, unknown>;
    results?: Array<{
        type: string;
        data: Record<string, unknown>;
    }>;
}

// ─── API Helpers ───

async function kibanaFetch<T>(
    path: string,
    method: 'GET' | 'POST' | 'PUT' = 'GET',
    body?: unknown
): Promise<T> {
    const url = `${KIBANA_URL}${path}`;
    const authHeader = getAuthHeader();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'kbn-xsrf': 'true',
    };
    if (authHeader) {
        headers['Authorization'] = authHeader;
    }

    const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const text = await res.text();

        // Handle specific trial expiration / auth errors
        if (res.status === 401 || res.status === 403) {
            throw new Error(`Authentication Failed (401/403). The Elastic Cloud trial or API key may have expired. Please check your credentials in .env.`);
        }
        if (res.status === 502 || res.status === 503) {
            throw new Error(`Service Unavailable (${res.status}). The Elastic Cloud deployment may be dormant or expired.`);
        }

        throw new Error(`Agent Builder API error ${res.status}: ${text.slice(0, 300)}`);
    }

    return res.json() as Promise<T>;
}

// ─── Public API ───

interface AgentBuilderConverseResponse {
    conversation_id: string;
    steps?: AgentStep[];
    response: {
        output?: string;
        message?: string;
        tool_calls?: Array<{
            tool_id: string;
            input: Record<string, unknown>;
            output: unknown;
        }>;
        reasoning?: string;
    };
}

async function converse(
    message: string,
    conversationId?: string
): Promise<{ response: ConverseResponse; conversationId: string | null }> {
    const body: Record<string, unknown> = {
        input: message,
        agent_id: AGENT_ID,
    };
    if (conversationId) {
        body.conversation_id = conversationId;
    }

    const result = await kibanaFetch<AgentBuilderConverseResponse>(
        '/api/agent_builder/converse',
        'POST',
        body
    );

    const innerResponse = result.response || {};

    return {
        response: {
            output: innerResponse.output || innerResponse.message || '',
            message: innerResponse.output || innerResponse.message || '',
            tool_calls: innerResponse.tool_calls,
            reasoning: innerResponse.reasoning,
            steps: result.steps || [],
        },
        conversationId: result.conversation_id || null,
    };
}

async function isAvailable(): Promise<boolean> {
    if (!KIBANA_URL) return false;
    if (!AGENT_ID) return false;
    if (!KIBANA_API_KEY && !(KIBANA_USERNAME && KIBANA_PASSWORD)) return false;
    try {
        await kibanaFetch('/api/status', 'GET');
        return true;
    } catch {
        return false;
    }
}

function getAgentId(): string {
    return AGENT_ID;
}

export const AgentBuilderTool = {
    converse,
    isAvailable,
    getAgentId,
};
