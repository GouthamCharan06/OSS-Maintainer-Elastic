import type { PRData } from './GithubTool';
import type { RiskTrace, RiskAssessment } from '../types';

// ─── Core Path Keywords ───

const CORE_PATH_KEYWORDS = [
    'auth', 'security', 'config', 'migration', 'database',
    'credential', 'secret', 'password', 'token', 'permission',
    'rbac', 'acl',
];

// ─── Weight Constants ───

const WEIGHTS = {
    large_diff: 25,
    medium_diff: 10,
    core_files: 20,
    multi_core_bonus: 8,
    ci_failure: 25,
    ci_pending: 5,
    first_time_contributor: 15,
    stale_pr: 15,
    aging_pr: 5,
} as const;

// ─── Deterministic Risk Scoring ───

export function computeRiskScore(pr: PRData): RiskAssessment {
    const factors: RiskTrace[] = [];
    let score = 0;

    // Factor 1: Diff size
    const totalDiff = pr.lines_added + pr.lines_deleted;
    if (totalDiff > 500) {
        const contribution = WEIGHTS.large_diff;
        score += contribution;
        factors.push({
            factor: 'large_diff',
            weight: WEIGHTS.large_diff,
            contribution,
            explanation: `Large diff detected: ${totalDiff} lines changed (>${500} threshold). Increases review complexity and risk of regressions.`,
        });
    } else if (totalDiff > 200) {
        const contribution = WEIGHTS.medium_diff;
        score += contribution;
        factors.push({
            factor: 'medium_diff',
            weight: WEIGHTS.medium_diff,
            contribution,
            explanation: `Medium diff detected: ${totalDiff} lines changed. Moderate review burden.`,
        });
    }

    // Factor 2: Core file path keywords
    const searchText = `${pr.title} ${pr.body}`.toLowerCase();
    const matchedKeywords = CORE_PATH_KEYWORDS.filter((kw) =>
        searchText.includes(kw)
    );
    if (matchedKeywords.length > 0) {
        const contribution = WEIGHTS.core_files;
        score += contribution;
        factors.push({
            factor: 'core_files',
            weight: WEIGHTS.core_files,
            contribution,
            explanation: `Modification to sensitive core paths detected: ${matchedKeywords.join(', ')}. Requires security-aware review.`,
        });

        // Bonus: multiple core keywords
        if (matchedKeywords.length >= 2) {
            const bonusContribution = WEIGHTS.multi_core_bonus;
            score += bonusContribution;
            factors.push({
                factor: 'multi_core_files',
                weight: WEIGHTS.multi_core_bonus,
                contribution: bonusContribution,
                explanation: `Multiple core paths affected (${matchedKeywords.length} keywords: ${matchedKeywords.join(', ')}). Cross-cutting change amplifies risk.`,
            });
        }
    }

    // Factor 3: CI status
    if (pr.ci_status === 'failure') {
        const contribution = WEIGHTS.ci_failure;
        score += contribution;
        factors.push({
            factor: 'ci_failure',
            weight: WEIGHTS.ci_failure,
            contribution,
            explanation: `Automated CI checks failed. Requires manual stability verification before merge.`,
        });
    } else if (pr.ci_status === 'pending') {
        const contribution = WEIGHTS.ci_pending;
        score += contribution;
        factors.push({
            factor: 'ci_pending',
            weight: WEIGHTS.ci_pending,
            contribution,
            explanation: `CI checks still pending. Status unknown — monitor before merging.`,
        });
    }

    // Factor 4: First-time contributor
    if (pr.is_first_time_contributor) {
        const contribution = WEIGHTS.first_time_contributor;
        score += contribution;
        factors.push({
            factor: 'first_time_contributor',
            weight: WEIGHTS.first_time_contributor,
            contribution,
            explanation: `External contribution from new developer. Requires extra vetting for code quality and security.`,
        });
    }

    // Factor 5: Stale PR
    if (pr.pr_age_days > 14 && pr.state === 'open') {
        const contribution = WEIGHTS.stale_pr;
        score += contribution;
        factors.push({
            factor: 'stale_pr',
            weight: WEIGHTS.stale_pr,
            contribution,
            explanation: `PR has been open ${Math.round(pr.pr_age_days)} days (>14 day threshold). Prioritization required to prevent backlog growth.`,
        });
    } else if (pr.pr_age_days > 7 && pr.state === 'open') {
        const contribution = WEIGHTS.aging_pr;
        score += contribution;
        factors.push({
            factor: 'aging_pr',
            weight: WEIGHTS.aging_pr,
            contribution,
            explanation: `PR aging at ${Math.round(pr.pr_age_days)} days. Approaching stale threshold.`,
        });
    }

    return {
        risk_score: Math.min(score, 100),
        risk_factors: factors,
    };
}

// ─── Label Suggestion from Risk Factors ───

export function suggestLabels(factors: RiskTrace[]): string[] {
    const labels: string[] = [];
    const factorNames = new Set(factors.map((f) => f.factor));

    if (factorNames.has('ci_failure')) labels.push('needs-ci-fix');
    if (factorNames.has('large_diff')) labels.push('needs-split');
    if (factorNames.has('stale_pr') || factorNames.has('aging_pr')) labels.push('stale');
    if (factorNames.has('first_time_contributor')) labels.push('first-time-contributor');
    if (factorNames.has('core_files') || factorNames.has('multi_core_files')) labels.push('security-review');

    return labels;
}

export const RiskScoreTool = {
    computeRiskScore,
    suggestLabels,
};
