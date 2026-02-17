import { Client } from '@elastic/elasticsearch';

let _client: Client | null = null;

function getClient(): Client {
    if (!_client) {
        _client = new Client({
            node: process.env.ELASTICSEARCH_URL!,
            auth: {
                apiKey: process.env.ELASTICSEARCH_API_KEY!,
            },
            tls: {
                rejectUnauthorized: false,
            },
        });
    }
    return _client;
}

export const ElasticTool = {
    getClient,
    ensureIndices,
    bulkUpsert,
    bulkIndex,
    deleteRepoData,
    getLastIngestionTime,
    indexOrchestrationRun,
    indexReasoningTraces,
};

// ─── Index Mappings ───

const PR_MAPPINGS = {
    properties: {
        repo: { type: 'keyword' as const },
        pr_number: { type: 'integer' as const },
        title: { type: 'text' as const },
        body: { type: 'text' as const },
        state: { type: 'keyword' as const },
        author: { type: 'keyword' as const },
        labels: { type: 'keyword' as const },
        created_at: { type: 'date' as const },
        updated_at: { type: 'date' as const },
        merged_at: { type: 'date' as const },
        closed_at: { type: 'date' as const },
        files_changed: { type: 'integer' as const },
        lines_added: { type: 'integer' as const },
        lines_deleted: { type: 'integer' as const },
        is_first_time_contributor: { type: 'boolean' as const },
        pr_age_days: { type: 'float' as const },
        ci_status: { type: 'keyword' as const },
        risk_score: { type: 'float' as const },
        risk_factors: { type: 'object' as const, enabled: false },
        html_url: { type: 'keyword' as const },
        ingested_at: { type: 'date' as const },
    },
};

const ISSUE_MAPPINGS = {
    properties: {
        repo: { type: 'keyword' as const },
        issue_number: { type: 'integer' as const },
        title: { type: 'text' as const },
        body: { type: 'text' as const },
        state: { type: 'keyword' as const },
        author: { type: 'keyword' as const },
        labels: { type: 'keyword' as const },
        created_at: { type: 'date' as const },
        updated_at: { type: 'date' as const },
        closed_at: { type: 'date' as const },
        comments_count: { type: 'integer' as const },
        html_url: { type: 'keyword' as const },
        ingested_at: { type: 'date' as const },
    },
};

const CONTRIBUTOR_MAPPINGS = {
    properties: {
        repo: { type: 'keyword' as const },
        login: { type: 'keyword' as const },
        contributions: { type: 'integer' as const },
        avatar_url: { type: 'keyword' as const },
        profile_url: { type: 'keyword' as const },
        ingested_at: { type: 'date' as const },
    },
};

const ORCHESTRATION_RUN_MAPPINGS = {
    properties: {
        repo: { type: 'keyword' as const },
        run_id: { type: 'keyword' as const },
        started_at: { type: 'date' as const },
        completed_at: { type: 'date' as const },
        status: { type: 'keyword' as const },
        agent_timings: { type: 'object' as const, enabled: false },
        total_duration_ms: { type: 'integer' as const },
        briefing_summary: { type: 'object' as const, enabled: false },
    },
};

const REASONING_TRACE_MAPPINGS = {
    properties: {
        repo: { type: 'keyword' as const },
        pr_number: { type: 'integer' as const },
        run_id: { type: 'keyword' as const },
        risk_score: { type: 'float' as const },
        classification: { type: 'keyword' as const },
        factors: { type: 'object' as const, enabled: false },
        suggested_labels: { type: 'keyword' as const },
        created_at: { type: 'date' as const },
    },
};

// ─── Verification ───

async function verifyConnection(): Promise<void> {
    try {
        await getClient().ping();
    } catch (err: any) {
        const status = err.meta?.statusCode;
        if (status === 401 || status === 403) {
            throw new Error(`Authentication Failed (401/403). The Elastic Cloud trial or API key may have expired. Please check your credentials in .env.`);
        }
        if (status === 502 || status === 503) {
            throw new Error(`Service Unavailable (${status}). The Elastic Cloud deployment may be dormant or expired.`);
        }
        throw err;
    }
}

// ─── Index Management ───

async function createIndexIfNotExists(
    name: string,
    mappings: Record<string, unknown>
): Promise<void> {
    const exists = await getClient().indices.exists({ index: name });
    if (!exists) {
        await getClient().indices.create({
            index: name,
            body: { mappings },
        });
        console.log(`[Elastic] Created index: ${name}`);
    }
}

export async function ensureIndices(): Promise<void> {
    await verifyConnection();
    await Promise.all([
        createIndexIfNotExists('repo_prs', PR_MAPPINGS),
        createIndexIfNotExists('repo_issues', ISSUE_MAPPINGS),
        createIndexIfNotExists('repo_contributors', CONTRIBUTOR_MAPPINGS),
        createIndexIfNotExists('orchestration_runs', ORCHESTRATION_RUN_MAPPINGS),
        createIndexIfNotExists('reasoning_traces', REASONING_TRACE_MAPPINGS),
    ]);
}

// ─── Incremental Upsert (deterministic _id) ───

function generateDocId(index: string, doc: Record<string, unknown>): string {
    const repo = doc.repo as string || '';
    if (index === 'repo_prs') return `pr:${repo}:${doc.pr_number}`;
    if (index === 'repo_issues') return `issue:${repo}:${doc.issue_number}`;
    if (index === 'repo_contributors') return `contrib:${repo}:${doc.login}`;
    return `${index}:${Math.random().toString(36).slice(2)}`;
}

export async function bulkUpsert(
    index: string,
    docs: Record<string, unknown>[]
): Promise<number> {
    if (docs.length === 0) return 0;

    const now = new Date().toISOString();
    const operations = docs.flatMap((doc) => {
        const id = generateDocId(index, doc);
        const enriched = { ...doc, ingested_at: now };
        return [
            { update: { _index: index, _id: id } },
            { doc: enriched, doc_as_upsert: true },
        ];
    });

    const result = await getClient().bulk({ refresh: true, operations });

    if (result.errors) {
        const errorItems = result.items.filter((item) => item.update?.error);
        console.error(
            `[Elastic] Bulk upsert errors in ${index}:`,
            JSON.stringify(errorItems.slice(0, 3), null, 2)
        );
    }

    const successCount = result.items.filter(
        (item) => item.update && !item.update.error
    ).length;
    console.log(`[Elastic] Upserted ${successCount}/${docs.length} docs into ${index}`);
    return successCount;
}

// ─── Legacy Bulk Index (for new indices without deterministic IDs) ───

export async function bulkIndex(
    index: string,
    docs: object[]
): Promise<number> {
    if (docs.length === 0) return 0;

    const operations = docs.flatMap((doc) => [
        { index: { _index: index } },
        doc,
    ]);

    const result = await getClient().bulk({ refresh: true, operations });

    if (result.errors) {
        const errorItems = result.items.filter((item) => item.index?.error);
        console.error(
            `[Elastic] Bulk index errors in ${index}:`,
            JSON.stringify(errorItems.slice(0, 3), null, 2)
        );
    }

    const successCount = result.items.filter(
        (item) => item.index && !item.index.error
    ).length;
    console.log(`[Elastic] Indexed ${successCount}/${docs.length} docs into ${index}`);
    return successCount;
}

// ─── Debounce: Check Last Ingestion Time ───

export async function getLastIngestionTime(repo: string): Promise<string | null> {
    try {
        const result = await getClient().search({
            index: 'repo_prs',
            size: 1,
            query: { term: { repo } },
            sort: [{ ingested_at: { order: 'desc' } }],
            _source: ['ingested_at'],
        });

        if (result.hits.hits.length > 0) {
            const source = result.hits.hits[0]._source as Record<string, unknown>;
            return (source?.ingested_at as string) || null;
        }
        return null;
    } catch {
        return null;
    }
}

// ─── Persist Orchestration Run ───

export async function indexOrchestrationRun(run: Record<string, unknown>): Promise<void> {
    try {
        await getClient().index({
            index: 'orchestration_runs',
            body: run,
            refresh: true,
        });
        console.log(`[Elastic] Orchestration run indexed for ${run.repo}`);
    } catch (err) {
        console.error(`[Elastic] Failed to index orchestration run:`, err);
    }
}

// ─── Persist Reasoning Traces ───

export async function indexReasoningTraces(
    traces: Record<string, unknown>[]
): Promise<void> {
    if (traces.length === 0) return;

    try {
        const operations = traces.flatMap((trace) => [
            { index: { _index: 'reasoning_traces' } },
            { ...trace, created_at: new Date().toISOString() },
        ]);

        await getClient().bulk({ refresh: true, operations });
        console.log(`[Elastic] Indexed ${traces.length} reasoning traces`);
    } catch (err) {
        console.error(`[Elastic] Failed to index reasoning traces:`, err);
    }
}

// ─── Delete repo data (for manual cleanup) ───

export async function deleteRepoData(repo: string): Promise<void> {
    const indices = ['repo_prs', 'repo_issues', 'repo_contributors'];
    for (const index of indices) {
        try {
            await getClient().deleteByQuery({
                index,
                body: {
                    query: { term: { repo } },
                },
                refresh: true,
            });
            console.log(`[Elastic] Cleared old data for ${repo} from ${index}`);
        } catch (err: unknown) {
            const error = err as { meta?: { statusCode?: number } };
            if (error.meta?.statusCode !== 404) throw err;
        }
    }
}
