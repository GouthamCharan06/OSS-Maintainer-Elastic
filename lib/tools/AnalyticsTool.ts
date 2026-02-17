import { ElasticTool } from './ElasticTool';
import type { WeeklyDataPoint, BacklogDataPoint, StalePRDetail } from '../types';

const { getClient } = ElasticTool;

// ─── ES|QL Runner ───

async function runEsql(query: string): Promise<{
    columns: Array<{ name: string; type: string }>;
    values: unknown[][];
}> {
    const client = getClient();
    const result = await client.esql.query({
        query,
        format: 'json',
    });

    return result as unknown as {
        columns: Array<{ name: string; type: string }>;
        values: unknown[][];
    };
}

function esqlToObjects(result: {
    columns: Array<{ name: string; type: string }>;
    values: unknown[][];
}): Record<string, unknown>[] {
    return result.values.map((row) => {
        const obj: Record<string, unknown> = {};
        result.columns.forEach((col, i) => {
            obj[col.name] = row[i];
        });
        return obj;
    });
}

// ─── PR Distribution by Status ───

export async function getPrDistributionByStatus(
    repo: string
): Promise<Array<{ state: string; count: number }>> {
    try {
        const query = `FROM repo_prs | WHERE repo == "${repo}" | STATS count = COUNT(*) BY state | SORT count DESC`;
        const result = await runEsql(query);
        return esqlToObjects(result) as Array<{ state: string; count: number }>;
    } catch {
        return [];
    }
}

// ─── Average Merge Time ───

export async function getAverageMergeTime(
    repo: string
): Promise<{ avg_merge_time_days: number | null }> {
    try {
        const client = getClient();
        const result = await client.search({
            index: 'repo_prs',
            size: 0,
            query: {
                bool: {
                    must: [
                        { term: { repo } },
                        { exists: { field: 'merged_at' } },
                    ],
                },
            },
            aggs: {
                avg_pr_age: {
                    avg: { field: 'pr_age_days' },
                },
            },
        });

        const aggs = result.aggregations as
            | { avg_pr_age: { value: number | null } }
            | undefined;
        const avgDays = aggs?.avg_pr_age?.value ?? null;
        return {
            avg_merge_time_days: avgDays ? Math.round(avgDays * 100) / 100 : null,
        };
    } catch {
        return { avg_merge_time_days: null };
    }
}

// ─── Contributor Ranking ───

export async function getContributorRanking(
    repo: string
): Promise<Array<{ author: string; merged_count: number }>> {
    try {
        const query = `FROM repo_prs | WHERE repo == "${repo}" AND state == "merged" | STATS merged_count = COUNT(*) BY author | SORT merged_count DESC | LIMIT 20`;
        const result = await runEsql(query);
        return esqlToObjects(result) as Array<{ author: string; merged_count: number }>;
    } catch {
        return [];
    }
}

// ─── CI Failure Rate ───

export async function getCiFailureRate(
    repo: string
): Promise<{ total: number; failures: number; failure_rate_pct: number }> {
    try {
        const queryTotal = `FROM repo_prs | WHERE repo == "${repo}" AND ci_status != "unknown" | STATS total = COUNT(*)`;
        const queryFailures = `FROM repo_prs | WHERE repo == "${repo}" AND ci_status == "failure" | STATS failures = COUNT(*)`;

        const [totalResult, failureResult] = await Promise.all([
            runEsql(queryTotal),
            runEsql(queryFailures),
        ]);

        const total = (totalResult.values[0]?.[0] as number) || 0;
        const failures = (failureResult.values[0]?.[0] as number) || 0;
        const rate = total > 0 ? Math.round((failures / total) * 10000) / 100 : 0;

        return { total, failures, failure_rate_pct: rate };
    } catch {
        return { total: 0, failures: 0, failure_rate_pct: 0 };
    }
}

// ─── Stale PR Count ───

export async function getStalePrCount(
    repo: string
): Promise<{ stale_count: number }> {
    try {
        const query = `FROM repo_prs | WHERE repo == "${repo}" AND state == "open" AND pr_age_days > 14 | STATS stale_count = COUNT(*)`;
        const result = await runEsql(query);
        const count = (result.values[0]?.[0] as number) || 0;
        return { stale_count: count };
    } catch {
        return { stale_count: 0 };
    }
}

// ─── Stale PR Details ───

export async function getStalePrDetails(
    repo: string
): Promise<StalePRDetail[]> {
    try {
        const client = getClient();
        const result = await client.search({
            index: 'repo_prs',
            size: 20,
            query: {
                bool: {
                    must: [
                        { term: { repo } },
                        { term: { state: 'open' } },
                        { range: { pr_age_days: { gt: 14 } } },
                    ],
                },
            },
            sort: [{ pr_age_days: { order: 'desc' } }],
            _source: ['pr_number', 'title', 'author', 'pr_age_days', 'html_url'],
        });

        return result.hits.hits.map((hit) => {
            const s = hit._source as Record<string, unknown>;
            return {
                pr_number: s.pr_number as number,
                title: s.title as string,
                author: s.author as string,
                age_days: Math.round(s.pr_age_days as number),
                html_url: s.html_url as string,
            };
        });
    } catch {
        return [];
    }
}

// ─── Merge Velocity Trend (8 weeks) ───

export async function getMergeVelocityTrend(
    repo: string
): Promise<WeeklyDataPoint[]> {
    try {
        const client = getClient();
        const result = await client.search({
            index: 'repo_prs',
            size: 0,
            query: {
                bool: {
                    must: [
                        { term: { repo } },
                        { exists: { field: 'merged_at' } },
                        { range: { merged_at: { gte: 'now-8w/w' } } },
                    ],
                },
            },
            aggs: {
                weekly_merges: {
                    date_histogram: {
                        field: 'merged_at',
                        calendar_interval: 'week',
                        format: 'yyyy-MM-dd',
                        min_doc_count: 0,
                        extended_bounds: {
                            min: 'now-8w/w',
                            max: 'now/w',
                        },
                    },
                },
            },
        });

        const aggs = result.aggregations as {
            weekly_merges: { buckets: Array<{ key_as_string: string; doc_count: number }> };
        } | undefined;

        return (aggs?.weekly_merges?.buckets || []).map((b) => ({
            week: b.key_as_string,
            count: b.doc_count,
        }));
    } catch {
        return [];
    }
}

// ─── Backlog Growth (opened vs closed per week) ───

export async function getBacklogGrowth(
    repo: string
): Promise<BacklogDataPoint[]> {
    try {
        const client = getClient();
        const [openedResult, closedResult] = await Promise.all([
            client.search({
                index: 'repo_prs',
                size: 0,
                query: {
                    bool: {
                        must: [
                            { term: { repo } },
                            { range: { created_at: { gte: 'now-8w/w' } } },
                        ],
                    },
                },
                aggs: {
                    weekly: {
                        date_histogram: {
                            field: 'created_at',
                            calendar_interval: 'week',
                            format: 'yyyy-MM-dd',
                            min_doc_count: 0,
                            extended_bounds: { min: 'now-8w/w', max: 'now/w' },
                        },
                    },
                },
            }),
            client.search({
                index: 'repo_prs',
                size: 0,
                query: {
                    bool: {
                        must: [
                            { term: { repo } },
                            { exists: { field: 'closed_at' } },
                            { range: { closed_at: { gte: 'now-8w/w' } } },
                        ],
                    },
                },
                aggs: {
                    weekly: {
                        date_histogram: {
                            field: 'closed_at',
                            calendar_interval: 'week',
                            format: 'yyyy-MM-dd',
                            min_doc_count: 0,
                            extended_bounds: { min: 'now-8w/w', max: 'now/w' },
                        },
                    },
                },
            }),
        ]);

        const openedAggs = openedResult.aggregations as {
            weekly: { buckets: Array<{ key_as_string: string; doc_count: number }> };
        } | undefined;
        const closedAggs = closedResult.aggregations as {
            weekly: { buckets: Array<{ key_as_string: string; doc_count: number }> };
        } | undefined;

        const openedBuckets = openedAggs?.weekly?.buckets || [];
        const closedBuckets = closedAggs?.weekly?.buckets || [];

        const closedMap = new Map(closedBuckets.map((b) => [b.key_as_string, b.doc_count]));

        return openedBuckets.map((b) => ({
            week: b.key_as_string,
            opened: b.doc_count,
            closed: closedMap.get(b.key_as_string) || 0,
        }));
    } catch {
        return [];
    }
}

// ─── CI Failure Time Series (weekly) ───

export async function getCiFailureTimeSeries(
    repo: string
): Promise<WeeklyDataPoint[]> {
    try {
        const client = getClient();
        const result = await client.search({
            index: 'repo_prs',
            size: 0,
            query: {
                bool: {
                    must: [
                        { term: { repo } },
                        { term: { ci_status: 'failure' } },
                        { range: { created_at: { gte: 'now-8w/w' } } },
                    ],
                },
            },
            aggs: {
                weekly_failures: {
                    date_histogram: {
                        field: 'created_at',
                        calendar_interval: 'week',
                        format: 'yyyy-MM-dd',
                        min_doc_count: 0,
                        extended_bounds: { min: 'now-8w/w', max: 'now/w' },
                    },
                },
            },
        });

        const aggs = result.aggregations as {
            weekly_failures: { buckets: Array<{ key_as_string: string; doc_count: number }> };
        } | undefined;

        return (aggs?.weekly_failures?.buckets || []).map((b) => ({
            week: b.key_as_string,
            count: b.doc_count,
        }));
    } catch {
        return [];
    }
}

// ─── Repo Health Summary (Enhanced) ───

export async function getRepoHealthSummary(
    repo: string
): Promise<Record<string, unknown>> {
    const [
        prDist, mergeTime, topContributors, ciRate, stalePrs,
        stalePrDetails, mergeVelocity, backlogGrowth, ciTimeSeries,
    ] = await Promise.all([
        getPrDistributionByStatus(repo),
        getAverageMergeTime(repo),
        getContributorRanking(repo),
        getCiFailureRate(repo),
        getStalePrCount(repo),
        getStalePrDetails(repo),
        getMergeVelocityTrend(repo),
        getBacklogGrowth(repo),
        getCiFailureTimeSeries(repo),
    ]);

    let totalIssues = 0, openIssues = 0, closedIssues = 0;
    try {
        const issueQuery = `FROM repo_issues | WHERE repo == "${repo}" | STATS count = COUNT(*) BY state`;
        const issueResult = await runEsql(issueQuery);
        const issueData = esqlToObjects(issueResult);
        for (const row of issueData) {
            const count = row.count as number;
            totalIssues += count;
            if (row.state === 'open') openIssues = count;
            if (row.state === 'closed') closedIssues = count;
        }
    } catch {
        // No issues data
    }

    return {
        repo,
        pull_requests: {
            distribution: prDist,
            avg_merge_time_days: mergeTime.avg_merge_time_days,
            stale_count: stalePrs.stale_count,
            stale_prs: stalePrDetails,
            ci_failure_rate: ciRate,
        },
        trends: {
            mergeVelocity: mergeVelocity,
            backlogGrowth: backlogGrowth,
            ciFailureTimeSeries: ciTimeSeries,
        },
        issues: {
            total: totalIssues,
            open: openIssues,
            closed: closedIssues,
        },
        top_contributors: topContributors.slice(0, 10),
    };
}

export const AnalyticsTool = {
    getPrDistributionByStatus,
    getAverageMergeTime,
    getContributorRanking,
    getCiFailureRate,
    getStalePrCount,
    getStalePrDetails,
    getMergeVelocityTrend,
    getBacklogGrowth,
    getCiFailureTimeSeries,
    getRepoHealthSummary,
};
