'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useDashboard } from '../DashboardProvider';
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

// ─── Animated Thinking Indicator ───

const THINKING_STAGES = [
    { icon: Brain, text: 'Interpreting your question...', color: '#a855f7' },
    { icon: Database, text: 'Deciding which ES|QL query to run...', color: '#3b82f6' },
    { icon: Wrench, text: 'Querying Elasticsearch...', color: '#f59e0b' },
    { icon: Loader2, text: 'Analyzing results...', color: '#10b981' },
];

const ThinkingIndicator = () => {
    const [stageIdx, setStageIdx] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setStageIdx(prev => (prev + 1) % THINKING_STAGES.length);
        }, 3000);
        return () => clearInterval(interval);
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
                minWidth: '280px',
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {THINKING_STAGES.map((stage, i) => {
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

// ─── Steps Breakdown (post-response) ───

const StepsBreakdown = ({ steps }: { steps: AgentStep[] }) => {
    const [expanded, setExpanded] = useState(false);

    if (!steps || steps.length === 0) return null;

    const toolSteps = steps.filter(s => s.type === 'tool_call');
    const reasoningSteps = steps.filter(s => s.type === 'reasoning');

    return (
        <div style={{ marginTop: '0.75rem', borderTop: '1px solid #1e293b', paddingTop: '0.75rem' }}>
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
                Thought Process ({steps.length} step{steps.length !== 1 ? 's' : ''})
            </button>

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
                        return (
                            <div key={`t-${i}`} style={{
                                padding: '0.5rem 0.625rem',
                                backgroundColor: 'rgba(59, 130, 246, 0.06)',
                                border: '1px solid rgba(59, 130, 246, 0.15)',
                                borderRadius: '6px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                                    <Database size={11} color="#3b82f6" />
                                    <span style={{ fontSize: '0.65rem', color: '#3b82f6', fontWeight: 700, textTransform: 'uppercase' }}>
                                        {step.tool_id?.replace('platform.core.', '') || 'Tool Call'}
                                    </span>
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
                                                    Result: <span style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>{preview && preview.length > 80 ? preview.slice(0, 80) + '...' : preview}</span>
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

// ─── Main Component ───

const AgentChatPanel = () => {
    const { currentRepo } = useDashboard();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [agentId, setAgentId] = useState<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [agentAvailable, setAgentAvailable] = useState<boolean | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', maxHeight: '800px' }}>
            {/* Header */}
            <div className="panel-card" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderColor: '#3b82f6' }}>
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
                    }} />
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {agentAvailable === false ? 'Fallback Mode' : agentAvailable === true ? 'Agent Builder Connected' : 'Ready'}
                    </span>
                </div>
            </div>

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
                        <div style={{ textAlign: 'center' }}>
                            <Sparkles size={40} color="#3b82f6" style={{ marginBottom: '1rem' }} />
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Ask the OSS Maintainer Agent</h3>
                            <p style={{ fontSize: '0.875rem', color: '#64748b', maxWidth: '400px' }}>
                                {currentRepo
                                    ? `Querying Elasticsearch data for ${currentRepo} using Agent Builder's ES|QL tools.`
                                    : 'Ingest a repository first, then ask questions about PR risk, health, and priorities.'}
                            </p>
                        </div>
                    </div>
                )}

                {messages.map((msg, i) => (
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
                            <div className="markdown-content" style={{ fontSize: '0.875rem', lineHeight: '1.6', color: msg.isError ? '#fca5a5' : '#e2e8f0' }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {msg.content}
                                </ReactMarkdown>
                            </div>

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
                ))}

                {/* Loading: Animated Thinking Steps */}
                {isLoading && <ThinkingIndicator />}

                <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts */}
            {currentRepo && !isLoading && (
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.4rem',
                    padding: '0.75rem 0',
                    borderTop: '1px solid #1e293b',
                }}>
                    {QUICK_PROMPTS.map((qp) => (
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
