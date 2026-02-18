'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type {
    OrchestratorEvent,
    IntakeResult,
    RiskResult,
    HealthTelemetry,
    MaintainerBriefing,
    StepTiming,
    GitHubRateLimitInfo,
} from '@/lib/types';
import type { AgentStep } from '@/lib/tools/AgentBuilderTool';

export interface AgentInsight {
    narrative: string;
    steps: AgentStep[];
    generatedAt: string;
}

interface DashboardState {
    currentRepo: string | null;
    isLoading: boolean;
    overallPercent: number;
    activeAgent: string | null;
    activeStep: string | null;
    intakeData: IntakeResult | null;
    riskData: RiskResult | null;
    healthData: HealthTelemetry | null;
    actionData: MaintainerBriefing | null;
    stepTimings: StepTiming[];
    totalDurationMs: number;
    rateLimit: GitHubRateLimitInfo | null;
    error: string | null;
    activePanel: 'ingest' | 'risk' | 'health' | 'decision' | 'agent-chat';
    agentStates: StepState[];
    agentInsight: AgentInsight | null;
    agentInsightLoading: boolean;
}

export interface StepState {
    name: string;
    status: 'pending' | 'active' | 'complete';
    currentStep: string;
    durationMs: number;
}

const STEPS_INIT: StepState[] = [
    { name: 'Fetching Repo Data', status: 'pending', currentStep: '', durationMs: 0 },
    { name: 'Analyzing Risk', status: 'pending', currentStep: '', durationMs: 0 },
    { name: 'Analyzing Health', status: 'pending', currentStep: '', durationMs: 0 },
    { name: 'Generating Briefing', status: 'pending', currentStep: '', durationMs: 0 },
];

interface DashboardContextType extends DashboardState {
    setActivePanel: (panel: DashboardState['activePanel']) => void;
    ingestRepo: (url: string, token?: string) => Promise<void>;
    cancelOrchestration: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<DashboardState>({
        currentRepo: null,
        isLoading: false,
        overallPercent: 0,
        activeAgent: null,
        activeStep: null,
        intakeData: null,
        riskData: null,
        healthData: null,
        actionData: null,
        stepTimings: [],
        totalDurationMs: 0,
        rateLimit: null,
        error: null,
        activePanel: 'ingest',
        agentStates: [...STEPS_INIT],
        agentInsight: null,
        agentInsightLoading: false,
    });

    const abortControllerRef = useRef<AbortController | null>(null);

    const cancelOrchestration = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setState(prev => ({
            ...prev,
            isLoading: false,
            activeAgent: null,
            activeStep: null,
            error: 'Orchestration cancelled by user.',
        }));
    }, []);

    const ingestRepo = useCallback(async (url: string, token?: string) => {
        // Cancel any existing run
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setState(prev => ({
            ...prev,
            isLoading: true,
            error: null,
            overallPercent: 0,
            activeAgent: null,
            activeStep: null,
            intakeData: null,
            riskData: null,
            healthData: null,
            agentInsight: null,
            agentInsightLoading: false,
            actionData: null,
            stepTimings: [],
            totalDurationMs: 0,
            agentStates: STEPS_INIT.map(a => ({ ...a })),
        }));

        try {
            const res = await fetch('/api/orchestrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo_url: url, token }),
                signal: controller.signal,
            });

            if (!res.body) throw new Error('No response body');
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const event: OrchestratorEvent = JSON.parse(line.slice(6));
                        handleEvent(event);
                    } catch {
                        // skip malformed events
                    }
                }
            }
        } catch (err: unknown) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                // User cancelled — already handled in cancelOrchestration
                return;
            }
            const message = err instanceof Error ? err.message : String(err);
            setState(prev => ({ ...prev, isLoading: false, error: message }));
        } finally {
            abortControllerRef.current = null;
        }
    }, []);

    const handleEvent = (event: OrchestratorEvent) => {
        switch (event.type) {
            case 'agent_start':
                setState(prev => {
                    const agents = [...prev.agentStates];
                    const idx = agents.findIndex(a => a.name === event.agent);
                    if (idx >= 0) {
                        agents[idx] = { ...agents[idx], status: 'active', currentStep: 'Starting...' };
                    }
                    return {
                        ...prev,
                        activeAgent: event.agent,
                        activeStep: 'Starting...',
                        overallPercent: event.percent,
                        agentStates: agents,
                    };
                });
                break;

            case 'progress':
                setState(prev => {
                    const agents = [...prev.agentStates];
                    const idx = agents.findIndex(a => a.name === event.agent);
                    if (idx >= 0) {
                        agents[idx] = { ...agents[idx], currentStep: event.step };
                    }
                    return {
                        ...prev,
                        activeStep: event.step,
                        overallPercent: event.percent,
                        agentStates: agents,
                    };
                });
                break;

            case 'agent_complete':
                setState(prev => {
                    const agents = [...prev.agentStates];
                    const idx = agents.findIndex(a => a.name === event.agent);
                    if (idx >= 0) {
                        agents[idx] = { ...agents[idx], status: 'complete', durationMs: event.durationMs, currentStep: 'Complete' };
                    }
                    return {
                        ...prev,
                        overallPercent: event.percent,
                        agentStates: agents,
                    };
                });
                break;

            case 'result':
                setState(prev => ({
                    ...prev,
                    currentRepo: event.repo,
                    intakeData: event.intake,
                    riskData: event.risk,
                    healthData: event.health,
                    actionData: event.action,
                    stepTimings: event.stepTimings,
                    totalDurationMs: event.totalDurationMs,
                    rateLimit: event.intake.rateLimit,
                    isLoading: false,
                    overallPercent: 100,
                    activeAgent: null,
                    activeStep: null,
                    activePanel: 'agent-chat',
                }));
                // Trigger agent-generated executive briefing
                generateAgentInsight(event.repo);
                break;

            case 'error':
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    error: event.message,
                }));
                break;
        }
    };

    const generateAgentInsight = async (repo: string) => {
        setState(prev => ({ ...prev, agentInsightLoading: true }));
        try {
            const res = await fetch('/api/agent-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `For repository ${repo}, run the following analysis using ES|QL queries:\n1. Query repo_prs for the top 5 highest risk_score open PRs\n2. Check the CI failure rate across all PRs\n3. Count stale PRs (open > 14 days)\n4. Query repo_contributors for top contributors\nProduce a concise 4-sentence executive summary of what the maintainer should focus on today. Be specific with PR numbers and metrics.`,
                    repo,
                }),
            });
            const data = await res.json();
            if (data.response?.message) {
                setState(prev => ({
                    ...prev,
                    agentInsight: {
                        narrative: data.response.message,
                        steps: data.response.steps || [],
                        generatedAt: new Date().toISOString(),
                    },
                    agentInsightLoading: false,
                }));
            } else {
                setState(prev => ({ ...prev, agentInsightLoading: false }));
            }
        } catch {
            setState(prev => ({ ...prev, agentInsightLoading: false }));
        }
    };

    const setActivePanel = (panel: DashboardState['activePanel']) => {
        setState(prev => ({ ...prev, activePanel: panel }));
    };

    return (
        <DashboardContext.Provider
            value={{
                ...state,
                setActivePanel,
                ingestRepo,
                cancelOrchestration,
            }}
        >
            {children}
        </DashboardContext.Provider>
    );
}

export function useDashboard() {
    const context = useContext(DashboardContext);
    if (context === undefined) {
        throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
}
