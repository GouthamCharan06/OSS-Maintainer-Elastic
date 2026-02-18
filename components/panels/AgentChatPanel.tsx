'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDashboard } from '../DashboardProvider';
import type { AgentInsight } from '../DashboardProvider';
import type { AgentStep } from '@/lib/tools/AgentBuilderTool';
import {
    Send,
    Bot,
    User,
    Loader2,
    Wrench,
    Sparkles,
    MessageSquare,
    RefreshCw,
    AlertTriangle,
    Brain,
    Database,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Zap,
    BarChart3,
    Clock,
    Activity,
    X,
    Minimize2,
    Maximize2,
} from 'lucide-react';

interface ChatMessage {
    role: 'user' | 'agent';
    content: string;
    isError?: boolean;
    originalQuery?: string;
    steps?: AgentStep[];
    timestamp: string;
}

const QUICK_PROMPTS = [
    { label: '🔍 High Risk PRs', prompt: 'What pull requests need immediate review and why?' },
    { label: '💊 Repo Health', prompt: 'How healthy is this repository? Summarize the key metrics.' },
    { label: '👥 Best Reviewers', prompt: 'Who are the best reviewers for security-related pull requests?' },
    { label: '⏰ Stale PRs', prompt: 'Are there any stale pull requests that need attention?' },
    { label: '📊 CI Status', prompt: 'What is the current CI failure rate and which PRs have failing checks?' },
    { label: '🏷️ Label Suggestions', prompt: 'What labels should be assigned to the open PRs?' },
    { label: '📈 Merge Velocity', prompt: 'What is the merge velocity trend over the last few weeks?' },
    { label: '🔥 Priority Queue', prompt: 'Give me a prioritized list of what I should work on first as a maintainer.' },
];

// ─── Follow-Up Suggestion Engine ───

const FOLLOW_UP_MAP: Array<{ keywords: string[]; suggestions: string[] }> = [
    {
        keywords: ['risk', 'risky', 'risk_score', 'high-risk', 'dangerous'],
        suggestions: [
            'Explain the risk factors for the highest-risk PR in detail',
            'Show the reasoning traces for all critical PRs',
            'Which of these risky PRs are from first-time contributors?',
        ],
    },
    {
        keywords: ['stale', 'aging', 'old', 'inactive', 'days old'],
        suggestions: [
            'Who should review these stale PRs?',
            'What is the backlog growth trend over the last month?',
            'Should any of these stale PRs be closed?',
        ],
    },
    {
        keywords: ['ci', 'failure', 'failing', 'broken', 'checks'],
        suggestions: [
            'Is CI stability improving or getting worse over time?',
            'Which authors have the most CI failures?',
            'What percentage of open PRs have passing CI?',
        ],
    },
    {
        keywords: ['contributor', 'reviewer', 'author', 'developer'],
        suggestions: [
            'What is the merge velocity trend over the last 8 weeks?',
            'Show PRs from first-time contributors',
            'Which contributors have the highest risk PRs?',
        ],
    },
    {
        keywords: ['health', 'optimal', 'stable', 'critical', 'score'],
        suggestions: [
            'What factors are driving the current health classification?',
            'Compare the last 2 weeks to the prior 2 weeks',
            'Generate a full maintainer briefing for this repository',
        ],
    },
    {
        keywords: ['merge', 'velocity', 'trend', 'weekly'],
        suggestions: [
            'Is there a correlation between merge velocity and CI failures?',
            'How does backlog growth compare to merge velocity?',
            'What is the average time-to-merge for this repository?',
        ],
    },
];

function getFollowUpSuggestions(content: string, steps?: AgentStep[]): string[] {
    const text = content.toLowerCase();
    const suggestions: string[] = [];

    for (const mapping of FOLLOW_UP_MAP) {
        if (mapping.keywords.some(kw => text.includes(kw))) {
            suggestions.push(...mapping.suggestions);
        }
    }

    // Deduplicate and limit
    const unique = [...new Set(suggestions)];

    // If we have tool calls, add a meta suggestion
    if (steps && steps.some(s => s.type === 'tool_call')) {
        unique.push('Generate a full maintainer briefing for this repository');
    }

    return unique.slice(0, 3);
}

// ─── Streaming Text Component ───

const StreamingText = ({ content, onComplete }: { content: string; onComplete?: () => void }) => {
    const [displayed, setDisplayed] = useState('');
    const [isDone, setIsDone] = useState(false);

    useEffect(() => {
        if (!content) return;

        let idx = 0;
        const speed = Math.max(5, Math.min(15, 2000 / content.length)); // adaptive speed

        const timer = setInterval(() => {
            // Render in chunks for speed
            const chunkSize = Math.max(1, Math.floor(content.length / 150));
            idx = Math.min(idx + chunkSize, content.length);
            setDisplayed(content.slice(0, idx));

            if (idx >= content.length) {
                clearInterval(timer);
                setIsDone(true);
                onComplete?.();
            }
        }, speed);

        return () => clearInterval(timer);
    }, [content, onComplete]);

    if (isDone) {
        return (
            <div className="markdown-content" style={{ fontSize: '0.875rem', lineHeight: '1.6', color: '#e2e8f0' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
        );
    }

    return (
        <div className="markdown-content" style={{ fontSize: '0.875rem', lineHeight: '1.6', color: '#e2e8f0' }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayed}</ReactMarkdown>
            <span className="animate-pulse" style={{ display: 'inline-block', width: '8px', height: '16px', backgroundColor: '#3b82f6', borderRadius: '2px', marginLeft: '2px', verticalAlign: 'text-bottom' }} />
        </div>
    );
};

// ─── Animated Thinking Indicator ───

const THINKING_STAGES = [
    { icon: Brain, text: 'Interpreting your question...', color: '#a855f7' },
    { icon: Database, text: 'Selecting ES|QL query strategy...', color: '#3b82f6' },
    { icon: Wrench, text: 'Executing query against Elasticsearch...', color: '#f59e0b' },
    { icon: Loader2, text: 'Analyzing returned data...', color: '#10b981' },
    { icon: Sparkles, text: 'Composing maintainer response...', color: '#ec4899' },
];

const BRIEFING_STAGES = [
    { icon: Database, text: 'Aggregating PR & Issue telemetry...', color: '#3b82f6' },
    { icon: Activity, text: 'Analyzing risk & health metrics...', color: '#f59e0b' },
    { icon: Brain, text: 'Synthesizing executive summary...', color: '#a855f7' },
    { icon: Sparkles, text: 'Generating maintainer briefing...', color: '#10b981' },
];

const ThinkingIndicator = ({ stages = THINKING_STAGES }: { stages?: typeof THINKING_STAGES }) => {
    const [stageIdx, setStageIdx] = useState(0);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setStageIdx(prev => (prev + 1) % stages.length);
        }, 2200);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'start' }}>
            <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
                <Bot size={16} color="white" />
            </div>
            <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#0f172a',
                border: '1px solid rgba(59, 130, 246, 0.15)',
                borderRadius: '2px 12px 12px 12px',
                minWidth: '300px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Agent Reasoning
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#475569', fontFamily: 'var(--font-mono)' }}>
                        {elapsed}s
                    </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {stages.map((stage, i) => {
                        const Icon = stage.icon;
                        const isActive = i === stageIdx;
                        const isDone = i < stageIdx;
                        return (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                opacity: isDone ? 0.5 : isActive ? 1 : 0.25,
                                transition: 'opacity 0.4s ease',
                            }}>
                                {isDone ? (
                                    <CheckCircle2 size={13} color="#10b981" />
                                ) : isActive ? (
                                    <Icon className={i === 3 ? 'animate-spin' : ''} size={13} color={stage.color} />
                                ) : (
                                    <Icon size={13} color="#334155" />
                                )}
                                <span style={{
                                    fontSize: '0.75rem',
                                    color: isDone ? '#64748b' : isActive ? stage.color : '#334155',
                                    fontWeight: isActive ? 600 : 400,
                                    transition: 'color 0.4s ease',
                                }}>
                                    {stage.text}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ─── Steps Breakdown (auto-expanded with stats) ───

const StepsBreakdown = ({ steps }: { steps: AgentStep[] }) => {
    const [expanded, setExpanded] = useState(true); // Auto-expanded by default

    if (!steps || steps.length === 0) return null;

    const toolSteps = steps.filter(s => s.type === 'tool_call');
    const reasoningSteps = steps.filter(s => s.type === 'reasoning');

    // Count total rows returned across all tool calls
    const totalRows = toolSteps.reduce((acc, step) => {
        if (!step.results) return acc;
        for (const r of step.results) {
            const data = r.data as { values?: unknown[][] };
            if (data.values) acc += data.values.length;
        }
        return acc;
    }, 0);

    // Extract unique indices queried
    const indicesQueried = new Set<string>();
    toolSteps.forEach(step => {
        const query = (step.params as Record<string, string>)?.query || '';
        const match = query.match(/FROM\s+(\w+)/i);
        if (match) indicesQueried.add(match[1]);
    });

    return (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid #1e293b', paddingTop: '0.75rem' }}>
            {/* Stats Bar */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                marginBottom: '0.5rem', flexWrap: 'wrap',
            }}>
                <button
                    onClick={() => setExpanded(!expanded)}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        fontSize: '0.7rem', color: '#64748b', fontWeight: 600,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}
                >
                    {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    <Brain size={11} />
                    Agent Reasoning
                </button>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {toolSteps.length > 0 && (
                        <span style={{
                            fontSize: '0.6rem', padding: '0.15rem 0.45rem',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)',
                            borderRadius: '4px', color: '#93c5fd', fontWeight: 600, fontFamily: 'var(--font-mono)',
                            display: 'flex', alignItems: 'center', gap: '0.25rem',
                        }}>
                            <Database size={9} /> {toolSteps.length} tool call{toolSteps.length !== 1 ? 's' : ''}
                        </span>
                    )}
                    {reasoningSteps.length > 0 && (
                        <span style={{
                            fontSize: '0.6rem', padding: '0.15rem 0.45rem',
                            backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.2)',
                            borderRadius: '4px', color: '#c4b5fd', fontWeight: 600, fontFamily: 'var(--font-mono)',
                            display: 'flex', alignItems: 'center', gap: '0.25rem',
                        }}>
                            <Brain size={9} /> {reasoningSteps.length} reasoning step{reasoningSteps.length !== 1 ? 's' : ''}
                        </span>
                    )}
                    {totalRows > 0 && (
                        <span style={{
                            fontSize: '0.6rem', padding: '0.15rem 0.45rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
                            borderRadius: '4px', color: '#6ee7b7', fontWeight: 600, fontFamily: 'var(--font-mono)',
                            display: 'flex', alignItems: 'center', gap: '0.25rem',
                        }}>
                            <BarChart3 size={9} /> {totalRows} row{totalRows !== 1 ? 's' : ''} returned
                        </span>
                    )}
                    {indicesQueried.size > 0 && (
                        <span style={{
                            fontSize: '0.6rem', padding: '0.15rem 0.45rem',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)',
                            borderRadius: '4px', color: '#fcd34d', fontWeight: 600, fontFamily: 'var(--font-mono)',
                            display: 'flex', alignItems: 'center', gap: '0.25rem',
                        }}>
                            <Activity size={9} /> {[...indicesQueried].join(', ')}
                        </span>
                    )}
                </div>
            </div>

            {expanded && (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {/* Reasoning */}
                    {reasoningSteps.map((step, i) => (
                        <div key={`r-${i}`} style={{
                            padding: '0.5rem 0.625rem',
                            backgroundColor: 'rgba(168, 85, 247, 0.06)',
                            border: '1px solid rgba(168, 85, 247, 0.15)',
                            borderRadius: '6px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.25rem' }}>
                                <Brain size={11} color="#a855f7" />
                                <span style={{ fontSize: '0.65rem', color: '#a855f7', fontWeight: 700, textTransform: 'uppercase' }}>Reasoning</span>
                            </div>
                            <p style={{ fontSize: '0.72rem', color: '#cbd5e1', lineHeight: '1.5' }}>
                                {step.reasoning}
                            </p>
                        </div>
                    ))}

                    {/* Tool Calls */}
                    {toolSteps.map((step, i) => {
                        const query = (step.params as Record<string, string>)?.query || '';
                        const rowCount = step.results?.reduce((acc, r) => {
                            const data = r.data as { values?: unknown[][] };
                            return acc + (data.values?.length || 0);
                        }, 0) || 0;

                        return (
                            <div key={`t-${i}`} style={{
                                padding: '0.5rem 0.625rem',
                                backgroundColor: 'rgba(59, 130, 246, 0.06)',
                                border: '1px solid rgba(59, 130, 246, 0.15)',
                                borderRadius: '6px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <Database size={11} color="#3b82f6" />
                                        <span style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase' }}>
                                            {step.tool_id?.replace('platform.core.', '') || 'Tool Call'}
                                        </span>
                                    </div>
                                    {rowCount > 0 && (
                                        <span style={{
                                            fontSize: '0.6rem', color: '#10b981', fontFamily: 'var(--font-mono)',
                                            display: 'flex', alignItems: 'center', gap: '0.2rem',
                                        }}>
                                            <CheckCircle2 size={9} /> {rowCount} row{rowCount !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                                {query && (
                                    <code style={{
                                        display: 'block',
                                        fontSize: '0.7rem',
                                        fontFamily: 'var(--font-mono)',
                                        color: '#93c5fd',
                                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                        padding: '0.375rem 0.5rem',
                                        borderRadius: '4px',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-all',
                                    }}>
                                        {query}
                                    </code>
                                )}
                                {step.results && step.results.length > 0 && (
                                    <div style={{ marginTop: '0.35rem' }}>
                                        {step.results.filter(r => r.type === 'esql_results').map((r, ri) => {
                                            const data = r.data as { values?: unknown[][] };
                                            const preview = JSON.stringify(data.values?.slice(0, 3));
                                            return (
                                                <p key={ri} style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.15rem' }}>
                                                    <CheckCircle2 size={10} color="#10b981" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.25rem' }} />
                                                    Preview: <span style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>{preview && preview.length > 100 ? preview.slice(0, 100) + '...' : preview}</span>
                                                </p>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Session Stats Bar ───

const SessionStats = ({ messages }: { messages: ChatMessage[] }) => {
    const stats = useMemo(() => {
        let totalToolCalls = 0;
        let totalReasoningSteps = 0;
        let totalRows = 0;
        const indices = new Set<string>();
        let agentMessages = 0;

        for (const msg of messages) {
            if (msg.role === 'agent' && !msg.isError) agentMessages++;
            if (!msg.steps) continue;
            for (const step of msg.steps) {
                if (step.type === 'tool_call') {
                    totalToolCalls++;
                    const query = (step.params as Record<string, string>)?.query || '';
                    const match = query.match(/FROM\s+(\w+)/i);
                    if (match) indices.add(match[1]);
                    if (step.results) {
                        for (const r of step.results) {
                            const data = r.data as { values?: unknown[][] };
                            if (data.values) totalRows += data.values.length;
                        }
                    }
                } else if (step.type === 'reasoning') {
                    totalReasoningSteps++;
                }
            }
        }

        return { totalToolCalls, totalReasoningSteps, totalRows, indices: [...indices], agentMessages };
    }, [messages]);

    if (stats.agentMessages === 0) return null;

    return (
        <div style={{
            display: 'flex', gap: '0.75rem', padding: '0.5rem 1rem', flexWrap: 'wrap',
            backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px',
            border: '1px solid rgba(51, 65, 85, 0.5)', marginBottom: '0.5rem',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', color: '#64748b' }}>
                <MessageSquare size={10} color="#3b82f6" />
                <span style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8', fontWeight: 600 }}>{stats.agentMessages}</span> responses
            </div>
            {stats.totalToolCalls > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', color: '#64748b' }}>
                    <Wrench size={10} color="#f59e0b" />
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8', fontWeight: 600 }}>{stats.totalToolCalls}</span> ES|QL queries executed
                </div>
            )}
            {stats.totalRows > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', color: '#64748b' }}>
                    <BarChart3 size={10} color="#10b981" />
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8', fontWeight: 600 }}>{stats.totalRows}</span> rows analyzed
                </div>
            )}
            {stats.indices.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.65rem', color: '#64748b' }}>
                    <Database size={10} color="#a855f7" />
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8', fontWeight: 600 }}>{stats.indices.length}</span> {stats.indices.length === 1 ? 'index' : 'indices'} queried
                </div>
            )}
        </div>
    );
};

// ─── Agent Insight Banner (R4) — Starts Minimized ───

const AgentInsightBanner = ({ insight, loading, onDismiss }: { insight: AgentInsight | null; loading: boolean; onDismiss: () => void }) => {
    const [showSteps, setShowSteps] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const toolSteps = insight?.steps.filter(s => s.type === 'tool_call') || [];

    // Minimized bar (default state + loading state)
    if (!expanded) {
        return (
            <div
                onClick={() => { if (!loading && insight) setExpanded(true); }}
                style={{
                    padding: '0.5rem 1rem',
                    background: loading
                        ? 'rgba(59, 130, 246, 0.04)'
                        : 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(139, 92, 246, 0.06))',
                    border: `1px solid ${loading ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.2)'}`,
                    borderRadius: '8px', marginBottom: '0.5rem',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: loading ? 'default' : 'pointer',
                    transition: 'all 0.2s ease',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {loading ? (
                        <Loader2 size={12} color="#3b82f6" className="animate-spin" />
                    ) : (
                        <CheckCircle2 size={12} color="#10b981" />
                    )}
                    <Sparkles size={12} color="#3b82f6" />
                    <span style={{ fontSize: '0.7rem', color: loading ? '#64748b' : '#94a3b8', fontWeight: 600 }}>
                        {loading ? 'Generating Executive Briefing...' : 'Agent Executive Briefing Ready'}
                    </span>
                    {!loading && toolSteps.length > 0 && (
                        <span style={{ fontSize: '0.58rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                            ({toolSteps.length} queries)
                        </span>
                    )}
                    {!loading && (
                        <span style={{ fontSize: '0.58rem', color: '#3b82f6' }}>— Click to expand</span>
                    )}
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#475569' }}
                >
                    <X size={12} />
                </button>
            </div>
        );
    }

    // Expanded state (only when user clicks)
    if (!insight) return null;

    return (
        <div style={{
            padding: '0.75rem 1rem',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06), rgba(139, 92, 246, 0.06))',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '8px', marginBottom: '0.5rem',
            maxHeight: '200px', overflowY: 'auto',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={13} color="#3b82f6" />
                    <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Agent Executive Briefing
                    </span>
                    <span style={{ fontSize: '0.55rem', color: '#475569', fontFamily: 'var(--font-mono)' }}>Powered by Agent Builder</span>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button onClick={() => setExpanded(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#64748b' }} title="Minimize">
                        <Minimize2 size={12} />
                    </button>
                    <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#475569' }} title="Dismiss">
                        <X size={12} />
                    </button>
                </div>
            </div>
            <div className="markdown-content" style={{ fontSize: '0.78rem', lineHeight: '1.5', color: '#cbd5e1' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{insight.narrative}</ReactMarkdown>
            </div>
            {toolSteps.length > 0 && (
                <div style={{ marginTop: '0.4rem' }}>
                    <button
                        onClick={() => setShowSteps(!showSteps)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                            fontSize: '0.6rem', color: '#64748b', fontWeight: 600,
                        }}
                    >
                        {showSteps ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        <Wrench size={9} /> {toolSteps.length} ES|QL {toolSteps.length === 1 ? 'query' : 'queries'}
                    </button>
                    {showSteps && (
                        <div style={{ marginTop: '0.3rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {toolSteps.map((step, i) => {
                                const query = (step.params as Record<string, string>)?.query || '';
                                return query ? (
                                    <code key={i} style={{
                                        display: 'block', fontSize: '0.6rem', fontFamily: 'var(--font-mono)',
                                        color: '#93c5fd', backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                        padding: '0.25rem 0.4rem', borderRadius: '3px', whiteSpace: 'pre-wrap',
                                    }}>
                                        {query}
                                    </code>
                                ) : null;
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main Component ───

const AgentChatPanel = () => {
    const { currentRepo, agentInsight, agentInsightLoading, intakeData, riskData, healthData } = useDashboard();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [agentId, setAgentId] = useState<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [agentAvailable, setAgentAvailable] = useState<boolean | null>(null);
    const [latestIsStreaming, setLatestIsStreaming] = useState(false);
    const [insightInjected, setInsightInjected] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading, latestIsStreaming]);

    // Clear chat when a new ingestion starts (data resets to null)
    useEffect(() => {
        if (!intakeData && !riskData && !healthData) {
            setMessages([]);
            setInsightInjected(false);
        }
    }, [intakeData, riskData, healthData]);

    // Inject agent executive briefing as the first chat message
    useEffect(() => {
        if (agentInsight && !insightInjected) {
            const briefingMsg: ChatMessage = {
                role: 'agent',
                content: `✨ **Executive Briefing** — *Generated by Agent Builder*\n\n${agentInsight.narrative}`,
                steps: agentInsight.steps,
                timestamp: agentInsight.generatedAt,
            };
            setMessages(prev => [briefingMsg, ...prev]);
            setInsightInjected(true);
            setLatestIsStreaming(true);
        }
    }, [agentInsight, insightInjected]);

    const sendMessage = async (text: string, isResend = false) => {
        if (!text.trim() || isLoading) return;

        if (isResend) {
            setMessages(prev => {
                const cleaned = [...prev];
                if (cleaned.length > 0 && cleaned[cleaned.length - 1].isError) {
                    cleaned.pop();
                }
                return cleaned;
            });
        } else {
            const userMsg: ChatMessage = {
                role: 'user',
                content: text,
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, userMsg]);
        }

        setInput('');
        setIsLoading(true);
        setLatestIsStreaming(false);

        try {
            const res = await fetch('/api/agent-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    repo: currentRepo,
                    agentId,
                    conversationId,
                }),
            });

            const data = await res.json();

            if (data.agentId) setAgentId(data.agentId);
            if (data.conversationId) setConversationId(data.conversationId);
            if (data.agentBuilderAvailable !== undefined) setAgentAvailable(data.agentBuilderAvailable);

            const isErr = !!(data.error && !data.response?.message);
            const agentMsg: ChatMessage = {
                role: 'agent',
                content: data.response?.message || data.error || 'No response received.',
                steps: data.response?.steps,
                isError: isErr,
                originalQuery: isErr ? text : undefined,
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, agentMsg]);
            if (!isErr) setLatestIsStreaming(true);
        } catch (err) {
            const errMsg: ChatMessage = {
                role: 'agent',
                content: `Error: ${err instanceof Error ? err.message : String(err)}`,
                isError: true,
                originalQuery: text,
                timestamp: new Date().toISOString(),
            };
            setMessages(prev => [...prev, errMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        sendMessage(input);
    };

    // Get follow-up suggestions for the last agent message
    const lastAgentMsg = [...messages].reverse().find(m => m.role === 'agent' && !m.isError);
    const followUps = lastAgentMsg && !isLoading && !latestIsStreaming
        ? getFollowUpSuggestions(lastAgentMsg.content, lastAgentMsg.steps)
        : [];

    // Generate dynamic sample questions based on ingested data
    const dynamicPrompts = useMemo(() => {
        const prompts: Array<{ label: string; prompt: string }> = [];

        if (riskData && riskData.high_risk_prs && riskData.high_risk_prs.length > 0) {
            const topPR = riskData.high_risk_prs[0];
            prompts.push(
                { label: `🔴 Why is PR #${topPR.pr_number} risky?`, prompt: `Explain in detail why PR #${topPR.pr_number} has a high risk score. Show the reasoning traces and risk factors.` },
                { label: `🔍 Top ${Math.min(5, riskData.total_analyzed)} riskiest PRs`, prompt: `Show me the top ${Math.min(5, riskData.total_analyzed)} riskiest open PRs with their risk scores and key risk factors. Use a table format.` },
            );
        }

        if (healthData) {
            prompts.push(
                { label: `💊 Health: ${healthData.classification}`, prompt: `This repository is classified as ${healthData.classification} with a score of ${healthData.compositeScore}. What factors are driving this? What should I prioritize to improve it?` },
            );
        }

        if (intakeData) {
            prompts.push(
                { label: '⏰ Stale PRs needing action', prompt: 'Show me all open PRs older than 14 days. For each one, should I close it, ping the author, or assign a reviewer?' },
                { label: '👥 Best reviewers to assign', prompt: 'Based on contributor activity, who are the top 5 most active contributors? Which PRs should each be assigned to review?' },
            );
        }

        prompts.push(
            { label: '📊 CI failure analysis', prompt: 'What is the CI failure rate? Show me which PRs have failing checks and whether CI stability is improving or degrading.' },
            { label: '📈 Merge velocity trend', prompt: 'Show me the merge velocity trend over the last few weeks. Is the team shipping faster or slower?' },
            { label: '🔥 My priority queue', prompt: 'As a maintainer, give me a prioritized action list of what I should work on right now, ranked by urgency.' },
        );

        return prompts.slice(0, 8);
    }, [intakeData, riskData, healthData]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', maxHeight: '800px' }}>
            {/* Header */}
            <div className="panel-card" style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderColor: '#3b82f6' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Bot size={20} color="white" />
                    </div>
                    <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>OSS Maintainer Agent</h3>
                        <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            Powered by Elastic Agent Builder • ES|QL Tools • {currentRepo || 'No repo selected'}
                        </p>
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        backgroundColor: agentAvailable === false ? '#f59e0b' : '#10b981',
                        boxShadow: agentAvailable === true ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none',
                    }} />
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {agentAvailable === false ? 'Fallback Mode' : agentAvailable === true ? 'Agent Builder Connected' : 'Ready'}
                    </span>
                </div>
            </div>

            {/* Session Stats */}
            <SessionStats messages={messages} />

            {/* Messages Area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                padding: '0.5rem 0',
            }}>
                {messages.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
                        <div style={{ textAlign: 'center', maxWidth: '500px' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '12px',
                                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 1rem auto',
                                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                            }}>
                                <Bot size={24} color="white" />
                            </div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', color: '#f8fafc' }}>
                                Elastic OSS Intelligence Agent
                            </h3>
                            <p style={{ fontSize: '0.875rem', lineHeight: '1.6', color: '#94a3b8', marginBottom: '1.5rem' }}>
                                I am your proactive decision engine, powered by <strong>Elastic Agent Builder</strong>. I don't guess—I <strong>execute precise ES|QL tool calls</strong> directly against your indexed data:
                            </p>
                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem',
                                marginBottom: '1.5rem', textAlign: 'left'
                            }}>
                                <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '8px', border: '1px solid #334155' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                        <Database size={14} color="#3b82f6" />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>Target Indices</span>
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: '#64748b' }}><code>repo_prs</code>, <code>repo_issues</code>, <code>repo_contributors</code>, <code>reasoning_traces</code></p>
                                </div>
                                <div style={{ background: '#1e293b', padding: '0.75rem', borderRadius: '8px', border: '1px solid #334155' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                        <Wrench size={14} color="#f59e0b" />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>Tool Execution</span>
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: '#64748b' }}>Dynamic ES|QL generation & multi-step reasoning</p>
                                </div>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                                {currentRepo
                                    ? `Ready to analyze ${currentRepo}. Ask for a risk assesssment, health check, or priority briefing.`
                                    : 'Ingest a repository to initialize my decision context.'}
                            </p>
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => {
                    const isLastAgent = msg.role === 'agent' && i === messages.length - 1;
                    const shouldStream = isLastAgent && latestIsStreaming && !msg.isError;

                    return (
                        <div key={i} style={{
                            display: 'flex',
                            gap: '0.75rem',
                            alignItems: 'start',
                            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                        }}>
                            {/* Avatar */}
                            <div style={{
                                width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                                background: msg.role === 'user'
                                    ? '#1e293b'
                                    : msg.isError
                                        ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                                        : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {msg.role === 'user'
                                    ? <User size={16} color="#94a3b8" />
                                    : msg.isError
                                        ? <AlertTriangle size={16} color="white" />
                                        : <Bot size={16} color="white" />}
                            </div>

                            {/* Bubble */}
                            <div style={{
                                maxWidth: '75%',
                                padding: '0.875rem 1rem',
                                borderRadius: msg.role === 'user' ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                                backgroundColor: msg.isError ? 'rgba(239, 68, 68, 0.08)' : msg.role === 'user' ? '#1e293b' : '#0f172a',
                                border: `1px solid ${msg.isError ? 'rgba(239, 68, 68, 0.25)' : msg.role === 'user' ? '#334155' : 'rgba(59, 130, 246, 0.15)'}`,
                            }}>
                                {shouldStream ? (
                                    <StreamingText
                                        content={msg.content}
                                        onComplete={() => setLatestIsStreaming(false)}
                                    />
                                ) : (
                                    <div className="markdown-content" style={{ fontSize: '0.875rem', lineHeight: '1.6', color: msg.isError ? '#fca5a5' : '#e2e8f0' }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.content}
                                        </ReactMarkdown>
                                    </div>
                                )}

                                {/* Resend button on error */}
                                {msg.isError && msg.originalQuery && (
                                    <button
                                        onClick={() => sendMessage(msg.originalQuery!, true)}
                                        disabled={isLoading}
                                        style={{
                                            marginTop: '0.75rem',
                                            padding: '0.4rem 0.75rem',
                                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            borderRadius: '6px',
                                            color: '#f87171',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: isLoading ? 'not-allowed' : 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <RefreshCw size={12} /> Retry this query
                                    </button>
                                )}

                                {/* Agent Thinking Steps */}
                                {msg.steps && msg.steps.length > 0 && (
                                    <StepsBreakdown steps={msg.steps} />
                                )}

                                <p style={{ fontSize: '0.6rem', color: '#475569', marginTop: '0.5rem' }}>
                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    );
                })}

                {/* Loading: Animated Thinking Steps (User Query) */}
                {isLoading && <ThinkingIndicator />}

                {/* Loading: Executive Briefing Generation */}
                {agentInsightLoading && !insightInjected && (
                    <ThinkingIndicator stages={BRIEFING_STAGES} />
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Follow-Up Suggestions */}
            {followUps.length > 0 && !isLoading && (
                <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: '0.4rem',
                    padding: '0.5rem 0', borderTop: '1px solid #1e293b',
                }}>
                    <span style={{ fontSize: '0.65rem', color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', marginRight: '0.25rem' }}>
                        <Zap size={10} color="#f59e0b" /> Follow up:
                    </span>
                    {followUps.map((fu, i) => (
                        <button
                            key={i}
                            onClick={() => sendMessage(fu)}
                            style={{
                                padding: '0.3rem 0.6rem',
                                backgroundColor: 'rgba(245, 158, 11, 0.06)',
                                border: '1px solid rgba(245, 158, 11, 0.2)',
                                borderRadius: '6px',
                                color: '#fbbf24',
                                fontSize: '0.68rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {fu}
                        </button>
                    ))}
                </div>
            )}

            {/* Quick Prompts — Dynamic based on ingested data */}
            {currentRepo && !isLoading && (
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.4rem',
                    padding: '0.75rem 0',
                    borderTop: '1px solid #1e293b',
                }}>
                    {(messages.length === 0 ? dynamicPrompts : QUICK_PROMPTS).map((qp) => (
                        <button
                            key={qp.label}
                            onClick={() => sendMessage(qp.prompt)}
                            disabled={isLoading}
                            style={{
                                padding: '0.375rem 0.65rem',
                                backgroundColor: '#0f172a',
                                border: '1px solid #334155',
                                borderRadius: '6px',
                                color: '#94a3b8',
                                fontSize: '0.7rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            {qp.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit} style={{
                display: 'flex', gap: '0.75rem', padding: '0.75rem 0',
            }}>
                <div style={{ position: 'relative', flex: 1 }}>
                    <div style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#475569' }}>
                        <MessageSquare size={16} />
                    </div>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={currentRepo ? 'Ask about this repository...' : 'Ingest a repo first...'}
                        disabled={isLoading || !currentRepo}
                        style={{
                            width: '100%',
                            padding: '0.75rem 1rem 0.75rem 2.75rem',
                            backgroundColor: '#0f172a',
                            border: '1px solid #334155',
                            borderRadius: '10px',
                            color: '#f8fafc',
                            fontSize: '0.875rem',
                            outline: 'none',
                        }}
                    />
                </div>
                <button
                    type="submit"
                    disabled={!input.trim() || isLoading || !currentRepo}
                    style={{
                        padding: '0.75rem 1.25rem',
                        backgroundColor: !input.trim() || isLoading ? '#1e293b' : '#3b82f6',
                        border: 'none',
                        borderRadius: '10px',
                        color: 'white',
                        cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                    }}
                >
                    <Send size={16} />
                </button>
            </form>
        </div>
    );
};

export default AgentChatPanel;
