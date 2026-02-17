'use client';

import React from 'react';
import { useDashboard } from './DashboardProvider';
import { Loader2, CheckCircle2, Circle, Clock, ArrowRight } from 'lucide-react';

const AGENT_ICONS = ['📥', '⚠️', '💊', '🎯'];

const AgentMonitor = () => {
    const { agentStates, isLoading, overallPercent, totalDurationMs, activeStep } = useDashboard();

    if (!isLoading && agentStates.every(a => a.status === 'pending')) return null;

    const hasStarted = agentStates.some(a => a.status !== 'pending');
    if (!hasStarted && !isLoading) return null;

    return (
        <div className="panel-card" style={{ marginBottom: '2rem', background: 'rgba(59, 130, 246, 0.03)', borderColor: isLoading ? '#3b82f6' : '#10b981' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {isLoading ? (
                        <Loader2 className="animate-spin" size={20} color="#3b82f6" />
                    ) : (
                        <CheckCircle2 size={20} color="#10b981" />
                    )}
                    <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
                        {isLoading ? 'Pipeline in Progress' : 'Pipeline Complete'}
                    </h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {totalDurationMs > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#64748b', fontSize: '0.8rem' }}>
                            <Clock size={13} />
                            <span>{(totalDurationMs / 1000).toFixed(1)}s</span>
                        </div>
                    )}
                    <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        color: overallPercent >= 100 ? '#10b981' : '#3b82f6',
                    }}>
                        {overallPercent}%
                    </span>
                </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="progress-track" style={{ marginBottom: '1.5rem' }}>
                <div
                    className={isLoading ? 'progress-fill progress-fill-animated' : 'progress-fill'}
                    style={{ width: `${overallPercent}%`, backgroundColor: overallPercent >= 100 ? '#10b981' : '#3b82f6' }}
                />
            </div>

            {/* 4-Step Pipeline */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {agentStates.map((agent, index) => (
                    <div key={agent.name} style={{ position: 'relative' }}>
                        <div style={{
                            padding: '0.875rem 0.75rem',
                            borderRadius: '10px',
                            border: `1px solid ${agent.status === 'active' ? '#3b82f6' : agent.status === 'complete' ? 'rgba(16, 185, 129, 0.3)' : '#1e293b'}`,
                            backgroundColor: agent.status === 'active' ? 'rgba(59, 130, 246, 0.08)' : agent.status === 'complete' ? 'rgba(16, 185, 129, 0.04)' : '#0f172a',
                            transition: 'all 0.3s ease',
                        }}>
                            {/* Step Header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '1rem' }}>{AGENT_ICONS[index]}</span>
                                <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    color: agent.status === 'active' ? '#3b82f6' : agent.status === 'complete' ? '#10b981' : '#475569',
                                }}>
                                    {agent.name}
                                </span>
                            </div>

                            {/* Status */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                {agent.status === 'active' && <Circle size={8} fill="#3b82f6" color="#3b82f6" />}
                                {agent.status === 'complete' && <CheckCircle2 size={12} color="#10b981" />}
                                {agent.status === 'pending' && <Circle size={8} color="#334155" />}
                                <span style={{
                                    fontSize: '0.7rem',
                                    color: agent.status === 'active' ? '#94a3b8' : agent.status === 'complete' ? '#64748b' : '#334155',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    maxWidth: '150px',
                                }}>
                                    {agent.status === 'active' ? (activeStep || 'Processing...') : agent.status === 'complete' ? 'Done' : 'Waiting'}
                                </span>
                            </div>

                            {/* Duration badge */}
                            {agent.status === 'complete' && agent.durationMs > 0 && (
                                <div style={{
                                    marginTop: '0.5rem',
                                    fontSize: '0.65rem',
                                    color: '#475569',
                                    fontFamily: 'var(--font-mono)',
                                }}>
                                    {(agent.durationMs / 1000).toFixed(1)}s
                                </div>
                            )}
                        </div>

                        {/* Arrow connector */}
                        {index < 3 && (
                            <div style={{
                                position: 'absolute',
                                right: '-0.55rem',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                zIndex: 10,
                                color: agent.status === 'complete' ? '#10b981' : '#334155',
                            }}>
                                <ArrowRight size={14} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AgentMonitor;
