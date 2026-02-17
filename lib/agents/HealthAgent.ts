import { AnalyticsTool } from '../tools/AnalyticsTool';
import type { HealthTelemetry } from '../types';

export const HealthStep = {
    name: 'Analyzing Health',
    description: 'Uses ES|QL telemetry and Elasticsearch aggregations to monitor repository pulse, merge velocity trends, backlog growth, CI stability, and maintenance load.',

    run: async (repo: string, onStep?: (step: string) => void): Promise<HealthTelemetry> => {
        onStep?.('Running ES|QL telemetry for repository health metrics...');
        const summary = await AnalyticsTool.getRepoHealthSummary(repo) as Record<string, unknown>;

        const pullRequests = summary.pull_requests as HealthTelemetry['pull_requests'];
        const trends = summary.trends as HealthTelemetry['trends'];
        const issues = summary.issues as HealthTelemetry['issues'];
        const topContributors = (summary.top_contributors as HealthTelemetry['top_contributors']) || [];

        onStep?.('Computing composite health classification...');

        // Composite health classification
        const openCount = pullRequests.distribution.find(d => d.state === 'open')?.count || 1;
        const staleRatio = pullRequests.stale_count / Math.max(openCount, 1);
        const ciFailureRate = pullRequests.ci_failure_rate.failure_rate_pct;

        // Merge velocity trend analysis: declining = warning
        let velocityTrending: 'up' | 'down' | 'stable' = 'stable';
        if (trends.mergeVelocity.length >= 4) {
            const recent = trends.mergeVelocity.slice(-2).reduce((a, b) => a + b.count, 0);
            const older = trends.mergeVelocity.slice(-4, -2).reduce((a, b) => a + b.count, 0);
            if (recent > older * 1.2) velocityTrending = 'up';
            else if (recent < older * 0.7) velocityTrending = 'down';
        }

        // Composite score: 0=unhealthy, 100=healthy
        let compositeScore = 100;
        compositeScore -= Math.min(staleRatio * 40, 30); // stale penalty
        compositeScore -= Math.min(ciFailureRate * 0.5, 25); // CI penalty
        if (velocityTrending === 'down') compositeScore -= 15;
        compositeScore = Math.max(0, Math.round(compositeScore));

        let classification: HealthTelemetry['classification'] = 'OPTIMAL';
        if (compositeScore < 40 || staleRatio > 0.4 || ciFailureRate > 30) {
            classification = 'CRITICAL';
        } else if (compositeScore < 70 || staleRatio > 0.2 || ciFailureRate > 15) {
            classification = 'STABLE';
        }

        onStep?.('Health analysis complete.');

        return {
            repo,
            classification,
            compositeScore,
            pull_requests: pullRequests,
            trends,
            issues,
            top_contributors: topContributors,
        };
    }
};
