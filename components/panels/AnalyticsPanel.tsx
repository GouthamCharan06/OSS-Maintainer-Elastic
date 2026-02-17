'use client';

import React, { useState } from 'react';
import { useDashboard } from '../DashboardProvider';
import { 
  Zap,
  AlertTriangle,
  Tag,
  Users,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Clock,
} from 'lucide-react';

const AnalyticsPanel = () => {
  const { actionData, riskData, isLoading } = useDashboard();
  const [showTrace, setShowTrace] = useState(false);

  if (isLoading && !actionData) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="panel-card skeleton" style={{ height: '300px' }} />
        <div className="panel-card skeleton" style={{ height: '300px' }} />
      </div>
    );
  }

  if (!actionData) return null;

  const urgencyColor = actionData.urgency_score >= 70 ? '#ef4444' :
                       actionData.urgency_score >= 40 ? '#f59e0b' : '#10b981';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top: Urgency Score + Impact Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>
        {/* Urgency Gauge */}
        <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderColor: urgencyColor + '33' }}>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '1rem' }}>Urgency Score</p>
          <div className="urgency-gauge" style={{
            background: `conic-gradient(${urgencyColor} ${actionData.urgency_score * 3.6}deg, #1e293b ${actionData.urgency_score * 3.6}deg)`
          }}>
            <div className="urgency-gauge-inner">
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 800, color: urgencyColor }}>
                {actionData.urgency_score}
              </span>
              <span style={{ fontSize: '0.65rem', color: '#64748b' }}>/100</span>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '1rem' }}>
            {actionData.urgency_score >= 70 ? 'Immediate Action Required' : actionData.urgency_score >= 40 ? 'Attention Needed' : 'Repository Healthy'}
          </p>
        </div>

        {/* Impact Metrics + Recommendations */}
        <div className="panel-card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap size={18} color="#3b82f6" /> Maintainer Briefing
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '1rem' }}>Impact Metrics</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Review Time Saved</span>
                  <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: 700 }}>{actionData.impact_metrics.estimated_time_saved_mins} mins</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>High Risk Ratio</span>
                  <span style={{ fontSize: '0.875rem', color: '#ef4444', fontWeight: 700 }}>{actionData.impact_metrics.high_risk_ratio}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>CI Stability</span>
                  <span style={{ fontSize: '0.875rem', color: actionData.impact_metrics.ci_stability === 'STABLE' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                    {actionData.impact_metrics.ci_stability}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <p style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '1rem' }}>Recommendations</p>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {actionData.recommendations.map((rec, i) => (
                  <li key={i} style={{ fontSize: '0.8125rem', color: '#cbd5e1', display: 'flex', gap: '0.625rem', alignItems: 'start' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, color: '#3b82f6', flexShrink: 0, marginTop: '1px' }}>{i+1}</div>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Priority Queue */}
      {actionData.priority_queue.length > 0 && (
        <section className="panel-card" style={{ borderLeft: '4px solid #ef4444' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color="#ef4444" /> Priority Queue — Immediate Review
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {actionData.priority_queue.map((pr, index) => (
              <div key={pr.pr_number} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0.875rem 1rem',
                backgroundColor: '#020617',
                borderRadius: '8px',
                border: '1px solid #1e293b',
                gap: '1rem',
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', width: '20px' }}>{index + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc' }}>#{pr.pr_number}</span>
                    <span style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>{pr.title}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>by {pr.author}</span>
                    <span className={`severity-${pr.urgency === 'CRITICAL' ? 'critical' : 'warning'}`}>{pr.urgency}</span>
                    {pr.suggested_labels.map(l => (
                      <span key={l} className="label-pill" style={{ fontSize: '0.65rem' }}>{l}</span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: pr.risk_score >= 60 ? '#ef4444' : '#f59e0b',
                  }}>
                    {Math.round(pr.risk_score)}
                  </span>
                  <a href={pr.html_url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Stability Warnings */}
      {actionData.stability_warnings.length > 0 && (
        <section className="panel-card">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} color="#f59e0b" /> Stability Alerts
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {actionData.stability_warnings.map((warning, idx) => (
              <div key={idx} style={{
                padding: '0.875rem 1rem',
                backgroundColor: warning.severity === 'critical' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(245, 158, 11, 0.05)',
                border: `1px solid ${warning.severity === 'critical' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'start',
                gap: '0.75rem',
              }}>
                <span className={`severity-${warning.severity}`}>{warning.severity}</span>
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f8fafc' }}>{warning.metric}</span>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>{warning.message}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Proposed Labels + Reviewer Suggestions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Proposed Labels */}
        {actionData.proposed_labels.length > 0 && (
          <section className="panel-card">
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Tag size={16} color="#93c5fd" /> Proposed Labels
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {actionData.proposed_labels.map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: '#020617', borderRadius: '6px' }}>
                  <div>
                    <span className="label-pill">{item.label}</span>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginLeft: '0.5rem' }}>{item.reason}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#94a3b8' }}>×{item.count}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Reviewer Suggestions */}
        {actionData.reviewer_suggestions.length > 0 && (
          <section className="panel-card">
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={16} color="#3b82f6" /> Suggested Reviewers
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {actionData.reviewer_suggestions.map(reviewer => (
                <div key={reviewer.login} style={{ display: 'flex', alignItems: 'center', padding: '0.625rem 0.75rem', backgroundColor: '#020617', borderRadius: '6px', border: '1px solid #1e293b', gap: '0.75rem' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={14} color="#94a3b8" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f8fafc' }}>{reviewer.login}</p>
                    <p style={{ fontSize: '0.7rem', color: '#64748b' }}>{reviewer.reason}</p>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 700, color: '#a855f7' }}>
                    {reviewer.merged_count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Justification Trace */}
      <section className="panel-card" style={{ background: 'rgba(59, 130, 246, 0.03)', borderColor: 'rgba(59, 130, 246, 0.15)' }}>
        <div
          onClick={() => setShowTrace(!showTrace)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={14} /> Decision Justification Trace
          </h3>
          {showTrace ? <ChevronUp size={16} color="#3b82f6" /> : <ChevronDown size={16} color="#3b82f6" />}
        </div>
        {showTrace && (
          <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {actionData.justification_trace.map((line, i) => (
              <p key={i} style={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: '1.5', display: 'flex', gap: '0.5rem' }}>
                <span style={{ color: '#3b82f6', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', flexShrink: 0 }}>[{i + 1}]</span>
                {line}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* ES|QL Attribution */}
      <section className="panel-card" style={{ background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', marginBottom: '0.75rem' }}>ES|QL Intelligence Attribution</h3>
        <p style={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: '1.6' }}>
          This briefing was synthesized by a deterministic 4-agent pipeline using Elasticsearch as the sole reasoning substrate. 
          Risk scores are computed from weighted factor analysis, health metrics from ES|QL aggregations, and trend detection from date histogram analysis. 
          <strong style={{ color: '#3b82f6' }}> Zero external LLM calls were made.</strong> All decisions are auditable via the persisted reasoning traces in the <code style={{ color: '#a855f7' }}>reasoning_traces</code> index.
        </p>
      </section>
    </div>
  );
};

export default AnalyticsPanel;
