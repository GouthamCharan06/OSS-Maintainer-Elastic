'use client';

import React, { useState } from 'react';
import { useDashboard } from '../DashboardProvider';
import { 
  ChevronDown, 
  ChevronUp, 
  ExternalLink, 
  AlertTriangle,
  User,
  Tag,
} from 'lucide-react';
import type { ClassifiedPR, RiskTrace } from '@/lib/types';

const RiskPanel = () => {
  const { riskData, isLoading } = useDashboard();
  const [expandedPr, setExpandedPr] = useState<number | null>(null);

  if (isLoading && !riskData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="panel-card skeleton" style={{ height: '80px' }} />
        ))}
      </div>
    );
  }

  if (!riskData) return null;

  const prs = riskData.high_risk_prs;

  const getRiskClass = (score: number) => {
    if (score >= 60) return 'badge-risk-high';
    if (score >= 30) return 'badge-risk-medium';
    return 'badge-risk-low';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          Sorted by <span style={{ color: '#3b82f6', fontWeight: 600 }}>Deterministic Risk Score</span> (Highest first)
        </p>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
          {prs.length} PRs analyzed
        </p>
      </div>

      <div style={{ border: '1px solid #334155', borderRadius: '12px', overflow: 'hidden', background: '#0f172a' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: '#1e293b', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700 }}>
            <tr>
              <th style={{ padding: '1rem' }}>PR #</th>
              <th style={{ padding: '1rem' }}>Maintainer Data</th>
              <th style={{ padding: '1rem' }}>Author</th>
              <th style={{ padding: '1rem' }}>Status</th>
              <th style={{ padding: '1rem', textAlign: 'right' }}>Risk Score</th>
              <th style={{ padding: '1rem', width: '40px' }}></th>
            </tr>
          </thead>
          <tbody style={{ fontSize: '0.875rem' }}>
            {prs.map((pr: ClassifiedPR) => (
              <React.Fragment key={pr.pr_number}>
                <tr 
                  onClick={() => setExpandedPr(expandedPr === pr.pr_number ? null : pr.pr_number)}
                  style={{ 
                    borderBottom: '1px solid #334155', 
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease',
                    backgroundColor: expandedPr === pr.pr_number ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
                  }}
                >
                  <td style={{ padding: '1.25rem 1rem', color: '#64748b', fontWeight: 500 }}>#{pr.pr_number}</td>
                  <td style={{ padding: '1.25rem 1rem' }}>
                    <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '0.25rem' }}>{pr.title}</div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {pr.labels.slice(0, 3).map((l: string) => (
                        <span key={l} style={{ fontSize: '0.7rem', color: '#94a3b8', background: '#1e293b', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>{l}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8' }}>
                      <User size={14} />
                      {pr.author}
                      {pr.is_first_time_contributor && (
                        <span style={{ fontSize: '0.6rem', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>NEW</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px', 
                      fontSize: '0.75rem', 
                      backgroundColor: pr.state === 'merged' ? 'rgba(168, 85, 247, 0.1)' : pr.state === 'open' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                      color: pr.state === 'merged' ? '#a855f7' : pr.state === 'open' ? '#10b981' : '#94a3b8',
                      fontWeight: 600,
                      textTransform: 'capitalize'
                    }}>
                      {pr.state}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1rem', textAlign: 'right' }}>
                    <span className={`badge ${getRiskClass(pr.risk_score)}`}>
                      {Math.round(pr.risk_score)}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1rem' }}>
                    {expandedPr === pr.pr_number ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </td>
                </tr>
                {expandedPr === pr.pr_number && (
                  <tr>
                    <td colSpan={6} style={{ backgroundColor: 'rgba(59, 130, 246, 0.02)', padding: '0' }}>
                      <div style={{ padding: '1.5rem', borderBottom: '1px solid #334155', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                        {/* Reasoning Trace */}
                        <div>
                          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertTriangle size={14} color="#f59e0b" /> Deterministic Reasoning Trace
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ padding: '0.75rem', backgroundColor: '#020617', borderRadius: '8px', border: '1px solid #1e293b', marginBottom: '0.5rem' }}>
                              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: pr.classification === 'Immediate Review' ? '#ef4444' : pr.classification === 'Schedule Review' ? '#f59e0b' : '#10b981', textTransform: 'uppercase' }}>
                                Decision: {pr.classification}
                              </p>
                            </div>
                            {pr.reasoning_trace.map((trace: RiskTrace, idx: number) => (
                              <div key={idx} style={{ padding: '0.5rem 0.75rem', backgroundColor: '#020617', borderRadius: '6px', border: '1px solid #1e293b' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>{trace.factor}</span>
                                  <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: trace.contribution >= 20 ? '#ef4444' : '#f59e0b' }}>
                                    +{trace.contribution} (w:{trace.weight})
                                  </span>
                                </div>
                                <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>{trace.explanation}</p>
                              </div>
                            ))}
                          </div>

                          {/* Suggested Labels */}
                          {pr.suggested_labels.length > 0 && (
                            <div style={{ marginTop: '1rem' }}>
                              <p style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <Tag size={12} /> Suggested Labels
                              </p>
                              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                {pr.suggested_labels.map((label: string) => (
                                  <span key={label} className="label-pill">{label}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Metadata */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                          <div>
                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem' }}>Diff Metadata</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>Files Changed</span>
                                <span style={{ color: '#f8fafc', fontWeight: 600 }}>{pr.files_changed}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>Additions</span>
                                <span style={{ color: '#10b981', fontWeight: 600 }}>+{pr.lines_added}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>Deletions</span>
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>-{pr.lines_deleted}</span>
                              </div>
                            </div>
                          </div>
                          <div>
                            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem' }}>Lifecycle</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>Age</span>
                                <span style={{ color: '#f8fafc', fontWeight: 600 }}>{pr.pr_age_days} days</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: '#94a3b8' }}>CI Status</span>
                                <span style={{ 
                                  color: pr.ci_status === 'success' ? '#10b981' : pr.ci_status === 'failure' ? '#ef4444' : '#f59e0b',
                                  fontWeight: 600,
                                  textTransform: 'capitalize'
                                }}>{pr.ci_status}</span>
                              </div>
                              <div style={{ marginTop: '0.5rem' }}>
                                <a 
                                  href={pr.html_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', fontWeight: 600 }}
                                >
                                  View on GitHub <ExternalLink size={12} />
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RiskPanel;
