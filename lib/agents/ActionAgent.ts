import type {
    MaintainerBriefing,
    RiskResult,
    HealthTelemetry,
    PriorityPR,
    StabilityWarning,
} from '../types';

export const ActionStep = {
    name: 'Generating Briefing',
    description: 'Synthesizes risk intelligence and health telemetry into a prioritized Maintainer Briefing with actionable recommendations.',

    run: async (
        repo: string,
        data: { risk: RiskResult; health: HealthTelemetry },
        onStep?: (step: string) => void
    ): Promise<MaintainerBriefing> => {
        onStep?.('Synthesizing risk and health data into triage queue...');

        const { risk, health } = data;
        const prs = risk.high_risk_prs;

        // ─── Priority Queue: Top high-risk open PRs ───
        const priorityQueue: PriorityPR[] = prs
            .filter(pr => pr.state === 'open' && pr.classification === 'Immediate Review')
            .slice(0, 5)
            .map(pr => ({
                pr_number: pr.pr_number,
                title: pr.title,
                author: pr.author,
                risk_score: pr.risk_score,
                ci_status: pr.ci_status,
                urgency: pr.risk_score >= 70 ? 'CRITICAL' as const : 'HIGH' as const,
                suggested_labels: pr.suggested_labels,
                html_url: pr.html_url,
            }));

        // Add medium-risk PRs if queue is small
        if (priorityQueue.length < 3) {
            const mediumPrs = prs
                .filter(pr => pr.state === 'open' && pr.classification === 'Schedule Review')
                .slice(0, 3 - priorityQueue.length)
                .map(pr => ({
                    pr_number: pr.pr_number,
                    title: pr.title,
                    author: pr.author,
                    risk_score: pr.risk_score,
                    ci_status: pr.ci_status,
                    urgency: 'MEDIUM' as const,
                    suggested_labels: pr.suggested_labels,
                    html_url: pr.html_url,
                }));
            priorityQueue.push(...mediumPrs);
        }

        // ─── Stability Warnings from trend analysis ───
        onStep?.('Analyzing stability trends...');
        const stabilityWarnings: StabilityWarning[] = [];

        // CI stability trend
        if (health.trends.ciFailureTimeSeries.length >= 4) {
            const recent = health.trends.ciFailureTimeSeries.slice(-2).reduce((a, b) => a + b.count, 0);
            const older = health.trends.ciFailureTimeSeries.slice(-4, -2).reduce((a, b) => a + b.count, 0);
            if (recent > older + 2) {
                stabilityWarnings.push({
                    metric: 'CI Failure Rate',
                    message: `CI failures trending up: ${recent} failures in last 2 weeks vs ${older} in prior 2 weeks.`,
                    severity: 'warning',
                });
            }
        }

        // Backlog growth warning
        if (health.trends.backlogGrowth.length >= 2) {
            const recent = health.trends.backlogGrowth.slice(-2);
            const netGrowth = recent.reduce((acc, w) => acc + (w.opened - w.closed), 0);
            if (netGrowth > 5) {
                stabilityWarnings.push({
                    metric: 'Backlog Growth',
                    message: `PR backlog growing: ${netGrowth} more PRs opened than closed in last 2 weeks.`,
                    severity: 'warning',
                });
            }
        }

        // Merge velocity decline
        if (health.trends.mergeVelocity.length >= 4) {
            const recent = health.trends.mergeVelocity.slice(-2).reduce((a, b) => a + b.count, 0);
            const older = health.trends.mergeVelocity.slice(-4, -2).reduce((a, b) => a + b.count, 0);
            if (older > 0 && recent < older * 0.5) {
                stabilityWarnings.push({
                    metric: 'Merge Velocity',
                    message: `Merge velocity dropped ${Math.round((1 - recent / older) * 100)}% compared to 4 weeks ago.`,
                    severity: 'critical',
                });
            }
        }

        // Stale PR load
        if (health.pull_requests.stale_count > 5) {
            stabilityWarnings.push({
                metric: 'Stale PRs',
                message: `${health.pull_requests.stale_count} PRs are stale (>14 days open). Review backlog increasing.`,
                severity: health.pull_requests.stale_count > 10 ? 'critical' : 'warning',
            });
        }

        // Overall health
        if (health.classification === 'CRITICAL') {
            stabilityWarnings.push({
                metric: 'Overall Health',
                message: `Repository health classified as CRITICAL (composite score: ${health.compositeScore}/100).`,
                severity: 'critical',
            });
        }

        // ─── Proposed Labels (aggregated) ───
        onStep?.('Generating label and reviewer suggestions...');
        const labelCounts = new Map<string, { count: number; reason: string }>();
        prs.filter(pr => pr.state === 'open').forEach(pr => {
            pr.suggested_labels.forEach(label => {
                const existing = labelCounts.get(label);
                if (existing) {
                    existing.count++;
                } else {
                    labelCounts.set(label, {
                        count: 1,
                        reason: getLabelReason(label),
                    });
                }
            });
        });

        const proposedLabels = Array.from(labelCounts.entries())
            .map(([label, data]) => ({ label, count: data.count, reason: data.reason }))
            .sort((a, b) => b.count - a.count);

        // ─── Impact Metrics ───
        const totalPrs = health.pull_requests.distribution.reduce(
            (a: number, b: { count: number }) => a + b.count, 0
        );
        const highRiskCount = prs.filter(p => p.risk_score >= 60).length;
        const estimatedSavesMinutes = prs.length * 5;
        const highRiskRatio = totalPrs > 0
            ? Math.round((highRiskCount / totalPrs) * 100)
            : 0;

        // ─── Urgency Score ───
        const urgencyScore = Math.min(100, Math.round(
            (health.pull_requests.stale_count * 8) +
            (health.pull_requests.ci_failure_rate.failure_rate_pct * 1.5) +
            (priorityQueue.length * 10) +
            (stabilityWarnings.filter(w => w.severity === 'critical').length * 15)
        ));

        // ─── Recommendations ───
        const recommendations: string[] = [];
        if (priorityQueue.length > 0) {
            recommendations.push(
                `Triage ${priorityQueue.length} high-priority pull request${priorityQueue.length > 1 ? 's' : ''} flagged for immediate review.`
            );
        } else {
            recommendations.push('No immediate high-risk PRs blocking the pipeline.');
        }

        if (health.pull_requests.stale_count > 5) {
            recommendations.push(
                `Address ${health.pull_requests.stale_count} stale PRs (>14 days) to reduce maintenance debt.`
            );
        } else {
            recommendations.push('Maintenance debt is within acceptable limits.');
        }

        if (health.pull_requests.ci_failure_rate.failure_rate_pct > 25) {
            recommendations.push(
                'High CI failure rate detected — audit test infrastructure for flaky tests.'
            );
        } else {
            recommendations.push('CI pipeline is currently stable.');
        }

        if (stabilityWarnings.some(w => w.metric === 'Merge Velocity')) {
            recommendations.push('Merge velocity declining — consider prioritizing review bandwidth.');
        }

        // ─── Justification Trace ───
        const justificationTrace: string[] = [
            `Analyzed ${prs.length} pull requests from repository ${repo}.`,
            `Deterministic risk scoring identified ${highRiskCount} high-risk PRs (score ≥60) out of ${totalPrs} total.`,
            `Repository health classification: ${health.classification} (composite score: ${health.compositeScore}/100).`,
            `${priorityQueue.length} PR${priorityQueue.length !== 1 ? 's' : ''} queued for immediate maintainer review.`,
            `CI stability: ${health.pull_requests.ci_failure_rate.failure_rate_pct}% failure rate across ${health.pull_requests.ci_failure_rate.total} tracked actions.`,
            `Stale PR debt: ${health.pull_requests.stale_count} open PRs exceed the 14-day threshold.`,
            `${stabilityWarnings.length} stability warning${stabilityWarnings.length !== 1 ? 's' : ''} detected from trend analysis.`,
            `ES|QL telemetry powered all analytics — zero external LLM dependencies.`,
        ];

        onStep?.('Maintainer Briefing synthesized.');

        return {
            urgency_score: urgencyScore,
            priority_queue: priorityQueue,
            stability_warnings: stabilityWarnings,
            proposed_labels: proposedLabels,
            reviewer_suggestions: risk.reviewer_suggestions,
            justification_trace: justificationTrace,
            impact_metrics: {
                estimated_time_saved_mins: estimatedSavesMinutes,
                high_risk_ratio: highRiskRatio,
                ci_stability: health.pull_requests.ci_failure_rate.failure_rate_pct < 20 ? 'STABLE' : 'UNSTABLE',
            },
            recommendations,
        };
    }
};

function getLabelReason(label: string): string {
    switch (label) {
        case 'needs-ci-fix': return 'CI checks failing — needs build/test fix before merge.';
        case 'needs-split': return 'Large diff detected — consider splitting into smaller PRs.';
        case 'stale': return 'PR has been open beyond the 14-day threshold.';
        case 'first-time-contributor': return 'External contribution from new developer — extra review advised.';
        case 'security-review': return 'Changes touch sensitive paths (auth/security/config).';
        default: return 'Auto-suggested based on risk analysis.';
    }
}
