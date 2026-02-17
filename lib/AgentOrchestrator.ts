import { IntakeStep } from './agents/IntakeAgent';
import { RiskStep } from './agents/RiskAgent';
import { HealthStep } from './agents/HealthAgent';
import { ActionStep } from './agents/ActionAgent';
import { ElasticTool } from './tools/ElasticTool';
import type {
    OrchestratorEvent,
    StepTiming,
    IntakeResult,
    RiskResult,
    HealthTelemetry,
    MaintainerBriefing,
} from './types';

// Step weight map for progress tracking (sums to 100)
const STEP_WEIGHTS = {
    intake: { start: 0, end: 40 },
    risk: { start: 40, end: 60 },
    health: { start: 60, end: 80 },
    action: { start: 80, end: 100 },
};

const STEPS = [
    { key: 'intake', name: IntakeStep.name },
    { key: 'risk', name: RiskStep.name },
    { key: 'health', name: HealthStep.name },
    { key: 'action', name: ActionStep.name },
] as const;

export interface OrchestrationResult {
    repo: string;
    intake: IntakeResult;
    risk: RiskResult;
    health: HealthTelemetry;
    action: MaintainerBriefing;
    stepTimings: StepTiming[];
    totalDurationMs: number;
}

export const PipelineOrchestrator = {
    run: async (
        repoUrl: string,
        token?: string,
        onUpdate?: (event: OrchestratorEvent) => void
    ): Promise<OrchestrationResult> => {
        const stepTimings: StepTiming[] = [];
        const orchestrationStart = Date.now();
        const runId = `run-${orchestrationStart}`;

        const emitProgress = (stepName: string, detail: string, stepKey: string, localPercent: number) => {
            const weights = STEP_WEIGHTS[stepKey as keyof typeof STEP_WEIGHTS];
            const globalPercent = Math.round(weights.start + (localPercent / 100) * (weights.end - weights.start));
            onUpdate?.({
                type: 'progress',
                agent: stepName,
                step: detail,
                percent: globalPercent,
                timestamp: new Date().toISOString(),
            });
        };

        const runStep = async <T>(
            stepKey: string,
            stepName: string,
            stepIndex: number,
            executor: () => Promise<T>
        ): Promise<T> => {
            const weights = STEP_WEIGHTS[stepKey as keyof typeof STEP_WEIGHTS];

            onUpdate?.({
                type: 'agent_start',
                agent: stepName,
                agentIndex: stepIndex,
                totalAgents: STEPS.length,
                percent: weights.start,
                timestamp: new Date().toISOString(),
            });

            const startTime = Date.now();
            const result = await executor();
            const durationMs = Date.now() - startTime;

            stepTimings.push({
                step: stepName,
                startedAt: new Date(startTime).toISOString(),
                completedAt: new Date().toISOString(),
                durationMs,
            });

            onUpdate?.({
                type: 'agent_complete',
                agent: stepName,
                agentIndex: stepIndex,
                durationMs,
                percent: weights.end,
                timestamp: new Date().toISOString(),
            });

            return result;
        };

        // 1. Fetch Repo Data
        const intakeResult = await runStep('intake', IntakeStep.name, 0, () =>
            IntakeStep.run(repoUrl, token, (step: string) =>
                emitProgress(IntakeStep.name, step, 'intake', 50)
            )
        );
        const repo = intakeResult.repo;

        // 2. Analyze Risk
        const riskResult = await runStep('risk', RiskStep.name, 1, () =>
            RiskStep.run(repo, (step: string) =>
                emitProgress(RiskStep.name, step, 'risk', 50)
            )
        );

        // 3. Analyze Health
        const healthResult = await runStep('health', HealthStep.name, 2, () =>
            HealthStep.run(repo, (step: string) =>
                emitProgress(HealthStep.name, step, 'health', 50)
            )
        );

        // 4. Generate Briefing
        const actionResult = await runStep('action', ActionStep.name, 3, () =>
            ActionStep.run(repo, { risk: riskResult, health: healthResult }, (step: string) =>
                emitProgress(ActionStep.name, step, 'action', 50)
            )
        );

        const totalDurationMs = Date.now() - orchestrationStart;

        // Persist orchestration run to ES
        try {
            await ElasticTool.indexOrchestrationRun({
                repo,
                run_id: runId,
                started_at: new Date(orchestrationStart).toISOString(),
                completed_at: new Date().toISOString(),
                status: 'completed',
                step_timings: stepTimings,
                total_duration_ms: totalDurationMs,
                briefing_summary: {
                    urgency_score: actionResult.urgency_score,
                    priority_1_count: actionResult.priority_queue.length,
                    total_prs_analyzed: riskResult.total_analyzed,
                },
            });
        } catch (err) {
            console.error('[Pipeline] Failed to persist run:', err);
        }

        const orchestrationResult: OrchestrationResult = {
            repo,
            intake: intakeResult,
            risk: riskResult,
            health: healthResult,
            action: actionResult,
            stepTimings,
            totalDurationMs,
        };

        onUpdate?.({
            type: 'result',
            ...orchestrationResult,
        });

        return orchestrationResult;
    }
};
