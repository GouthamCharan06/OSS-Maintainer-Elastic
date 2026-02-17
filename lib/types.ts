// ─── Orchestration Events (SSE) ───

export interface AgentStartEvent {
    type: 'agent_start';
    agent: string;
    agentIndex: number;
    totalAgents: number;
    percent: number;
    timestamp: string;
}

export interface ProgressEvent {
    type: 'progress';
    agent: string;
    step: string;
    percent: number;
    timestamp: string;
}

export interface AgentCompleteEvent {
    type: 'agent_complete';
    agent: string;
    agentIndex: number;
    durationMs: number;
    percent: number;
    timestamp: string;
}

export interface ResultEvent {
    type: 'result';
    repo: string;
    intake: IntakeResult;
    risk: RiskResult;
    health: HealthTelemetry;
    action: MaintainerBriefing;
    stepTimings: StepTiming[];
    totalDurationMs: number;
}

export interface ErrorEvent {
    type: 'error';
    message: string;
    agent?: string;
    timestamp: string;
}

export type OrchestratorEvent =
    | AgentStartEvent
    | ProgressEvent
    | AgentCompleteEvent
    | ResultEvent
    | ErrorEvent;

// ─── Step Timing ───

export interface StepTiming {
    step: string;
    startedAt: string;
    completedAt: string;
    durationMs: number;
}

// ─── Risk Scoring ───

export interface RiskTrace {
    factor: string;
    weight: number;
    contribution: number;
    explanation: string;
}

export interface RiskAssessment {
    risk_score: number;
    risk_factors: RiskTrace[];
}

// ─── GitHub Rate Limit ───

export interface GitHubRateLimitInfo {
    remaining: number;
    limit: number;
    reset: number;
    used: number;
}

// ─── Intake Result ───

export interface IntakeResult {
    repo: string;
    counts: {
        prs: number;
        issues: number;
        contributors: number;
    };
    skippedPrs: number;
    rateLimit: GitHubRateLimitInfo | null;
    incrementalSync: boolean;
}

// ─── Risk Result ───

export interface ClassifiedPR {
    pr_number: number;
    title: string;
    state: string;
    author: string;
    risk_score: number;
    classification: string;
    reasoning_trace: RiskTrace[];
    suggested_labels: string[];
    ci_status: string;
    pr_age_days: number;
    files_changed: number;
    lines_added: number;
    lines_deleted: number;
    labels: string[];
    html_url: string;
    is_first_time_contributor: boolean;
}

export interface RiskResult {
    high_risk_prs: ClassifiedPR[];
    total_analyzed: number;
    reviewer_suggestions: ReviewerSuggestion[];
}

export interface ReviewerSuggestion {
    login: string;
    merged_count: number;
    reason: string;
}

// ─── Health Telemetry ───

export interface WeeklyDataPoint {
    week: string;
    count: number;
}

export interface BacklogDataPoint {
    week: string;
    opened: number;
    closed: number;
}

export interface StalePRDetail {
    pr_number: number;
    title: string;
    author: string;
    age_days: number;
    html_url: string;
}

export interface HealthTelemetry {
    repo: string;
    classification: 'OPTIMAL' | 'STABLE' | 'CRITICAL';
    compositeScore: number;
    pull_requests: {
        distribution: Array<{ state: string; count: number }>;
        avg_merge_time_days: number | null;
        stale_count: number;
        stale_prs: StalePRDetail[];
        ci_failure_rate: { total: number; failures: number; failure_rate_pct: number };
    };
    trends: {
        mergeVelocity: WeeklyDataPoint[];
        backlogGrowth: BacklogDataPoint[];
        ciFailureTimeSeries: WeeklyDataPoint[];
    };
    issues: {
        total: number;
        open: number;
        closed: number;
    };
    top_contributors: Array<{ author: string; merged_count: number }>;
}

// ─── Maintainer Briefing (Action Step Output) ───

export interface PriorityPR {
    pr_number: number;
    title: string;
    author: string;
    risk_score: number;
    ci_status: string;
    urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    suggested_labels: string[];
    html_url: string;
}

export interface StabilityWarning {
    metric: string;
    message: string;
    severity: 'critical' | 'warning' | 'info';
}

export interface MaintainerBriefing {
    urgency_score: number;
    priority_queue: PriorityPR[];
    stability_warnings: StabilityWarning[];
    proposed_labels: Array<{ label: string; count: number; reason: string }>;
    reviewer_suggestions: ReviewerSuggestion[];
    justification_trace: string[];
    impact_metrics: {
        estimated_time_saved_mins: number;
        high_risk_ratio: number;
        ci_stability: string;
    };
    recommendations: string[];
}

// ─── Orchestration Run (persisted to ES) ───

export interface OrchestrationRun {
    repo: string;
    run_id: string;
    started_at: string;
    completed_at: string;
    status: 'completed' | 'failed' | 'partial';
    step_timings: StepTiming[];
    total_duration_ms: number;
    briefing_summary: {
        urgency_score: number;
        priority_1_count: number;
        total_prs_analyzed: number;
    };
}
