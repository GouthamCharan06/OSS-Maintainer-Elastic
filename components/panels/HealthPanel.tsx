'use client';

import React, { useState } from 'react';
import { useDashboard } from '../DashboardProvider';
import { 
  GitPullRequest, 
  AlertCircle, 
  Clock, 
  ShieldCheck,
  TrendingDown,
  ExternalLink,
  Info,
} from 'lucide-react';

// ─── Reusable Info Tooltip ───

const InfoTooltip = ({ text }: { text: string }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', cursor: 'help' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <Info size={14} color="#475569" />
      {visible && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: '100%',
          marginTop: '0.5rem',
          width: '220px',
          padding: '0.625rem 0.75rem',
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '8px',
          fontSize: '0.7rem',
          lineHeight: '1.5',
          color: '#cbd5e1',
          zIndex: 50,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {text}
        </div>
      )}
    </div>
  );
};

// ─── Card Header Helper ───

const CardHeader = ({ title, icon, tooltip }: { title: string; icon: React.ReactNode; tooltip: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
    <p style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>{title}</p>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <InfoTooltip text={tooltip} />
      {icon}
    </div>
  </div>
);

// ─── Trend Header Helper ───

const TrendHeader = ({ title, tooltip }: { title: string; tooltip: string }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
    <p style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>{title}</p>
    <InfoTooltip text={tooltip} />
  </div>
);

const HealthPanel = () => {
  const { healthData, isLoading } = useDashboard();

  if (isLoading && !healthData) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="panel-card skeleton" style={{ height: '160px' }} />
        ))}
      </div>
    );
  }

  if (!healthData) return null;

  const { pull_requests: prs, issues, trends } = healthData;

  const healthColor = healthData.classification === 'CRITICAL' ? '#ef4444' :
                      healthData.classification === 'STABLE' ? '#f59e0b' : '#10b981';

  const openPrs = prs.distribution.find(d => d.state === 'open')?.count || 0;
  const mergedPrs = prs.distribution.find(d => d.state === 'merged')?.count || 0;
  const totalPrs = prs.distribution.reduce((a, b) => a + b.count, 0);

  const maxMergeVelocity = Math.max(...(trends.mergeVelocity.map(d => d.count)), 1);
  const maxBacklog = Math.max(
    ...(trends.backlogGrowth.flatMap(d => [d.opened, d.closed])),
    1
  );
  const maxCiFail = Math.max(...(trends.ciFailureTimeSeries.map(d => d.count)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Health Pulse */}
      <div className="panel-card" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderColor: healthColor + '33'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '0.875rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Project Vital Signs</h3>
            <InfoTooltip text="Overall health score computed from merge velocity, CI failure rate, and stale PR ratio. OPTIMAL means the repo is well-maintained, STABLE means minor attention needed, CRITICAL means urgent action required." />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <ShieldCheck size={32} color={healthColor} />
            <div>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f8fafc' }}>{healthData.classification}</p>
              <p style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                Composite Score: <span style={{ fontFamily: 'var(--font-mono)', color: healthColor, fontWeight: 700 }}>{healthData.compositeScore}/100</span>
              </p>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>REPOSITORY</p>
          <p style={{ fontSize: '1.125rem', fontWeight: 600, color: '#3b82f6' }}>{healthData.repo}</p>
        </div>
      </div>

      {/* Trend Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
        {/* Merge Velocity Trend */}
        <div className="panel-card">
          <TrendHeader
            title="Merge Velocity (8 weeks)"
            tooltip="How many PRs were merged each week over the last 8 weeks. A declining trend means PRs are piling up without being reviewed."
          />
          <div className="trend-bar-container">
            {trends.mergeVelocity.length > 0 ? trends.mergeVelocity.map((d, i) => (
              <div
                key={i}
                className="trend-bar"
                style={{
                  height: `${Math.max((d.count / maxMergeVelocity) * 100, 4)}%`,
                  backgroundColor: '#a855f7',
                  opacity: 0.5 + (i / trends.mergeVelocity.length) * 0.5,
                }}
                title={`${d.week}: ${d.count} merges`}
              />
            )) : (
              <p style={{ fontSize: '0.75rem', color: '#475569' }}>No merge data in this period</p>
            )}
          </div>
          <p style={{ fontSize: '0.65rem', color: '#475569', marginTop: '0.5rem' }}>Weekly merged PRs</p>
        </div>

        {/* Backlog Growth */}
        <div className="panel-card">
          <TrendHeader
            title="Backlog Growth (8 weeks)"
            tooltip="Compares new PRs opened (yellow) vs PRs closed (green) each week. If yellow bars consistently outpace green, the backlog is growing — a sign of maintainer capacity issues."
          />
          <div className="trend-bar-container">
            {trends.backlogGrowth.length > 0 ? trends.backlogGrowth.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '1px' }}>
                <div
                  className="trend-bar"
                  style={{
                    height: `${Math.max((d.opened / maxBacklog) * 50, 2)}%`,
                    backgroundColor: '#f59e0b',
                  }}
                  title={`${d.week}: +${d.opened} opened`}
                />
                <div
                  className="trend-bar"
                  style={{
                    height: `${Math.max((d.closed / maxBacklog) * 50, 2)}%`,
                    backgroundColor: '#10b981',
                  }}
                  title={`${d.week}: -${d.closed} closed`}
                />
              </div>
            )) : (
              <p style={{ fontSize: '0.75rem', color: '#475569' }}>No backlog data</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.65rem', color: '#475569' }}>
            <span style={{ color: '#f59e0b' }}>■ Opened</span>
            <span style={{ color: '#10b981' }}>■ Closed</span>
          </div>
        </div>

        {/* CI Failure Time Series */}
        <div className="panel-card">
          <TrendHeader
            title="CI Failures (8 weeks)"
            tooltip="Number of PRs with failing CI checks each week. Spikes indicate infrastructure issues, flaky tests, or a surge of low-quality contributions."
          />
          <div className="trend-bar-container">
            {trends.ciFailureTimeSeries.length > 0 ? trends.ciFailureTimeSeries.map((d, i) => (
              <div
                key={i}
                className="trend-bar"
                style={{
                  height: `${Math.max((d.count / maxCiFail) * 100, 4)}%`,
                  backgroundColor: '#ef4444',
                  opacity: 0.5 + (i / trends.ciFailureTimeSeries.length) * 0.5,
                }}
                title={`${d.week}: ${d.count} failures`}
              />
            )) : (
              <p style={{ fontSize: '0.75rem', color: '#475569' }}>No CI failure data</p>
            )}
          </div>
          <p style={{ fontSize: '0.65rem', color: '#475569', marginTop: '0.5rem' }}>Weekly CI failures</p>
        </div>
      </div>

      {/* Metric Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <div className="panel-card">
          <CardHeader
            title="PR Efficiency"
            icon={<GitPullRequest size={18} color="#94a3b8" />}
            tooltip="Ratio of merged PRs to total PRs fetched. A low merge rate means many PRs are stalling or being abandoned."
          />
          <div className="metric-value">{mergedPrs} <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 400 }}>/ {totalPrs} merged</span></div>
          <div className="progress-track" style={{ marginTop: '1.25rem' }}>
            <div className="progress-fill" style={{ width: `${totalPrs > 0 ? (mergedPrs/totalPrs) * 100 : 0}%`, background: '#a855f7' }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem' }}>
            Merge rate: <span style={{ color: '#a855f7' }}>{totalPrs > 0 ? Math.round((mergedPrs/totalPrs)*100) : 0}%</span>
          </p>
        </div>

        <div className="panel-card">
          <CardHeader
            title="Stale Pipeline"
            icon={<Clock size={18} color="#f59e0b" />}
            tooltip="PRs that have been open for more than 14 days without being merged or closed. These need attention to prevent contributor frustration."
          />
          <div className="metric-value" style={{ color: prs.stale_count > 0 ? '#f59e0b' : '#10b981' }}>{prs.stale_count} <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 400 }}>unresolved &gt;14d</span></div>
          {prs.stale_prs && prs.stale_prs.length > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {prs.stale_prs.slice(0, 3).map(sp => (
                <a key={sp.pr_number} href={sp.html_url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0.5rem', backgroundColor: '#020617', borderRadius: '6px' }}>
                  <span>#{sp.pr_number} {sp.title.slice(0, 30)}{sp.title.length > 30 ? '...' : ''}</span>
                  <span style={{ color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>{sp.age_days}d <ExternalLink size={10} /></span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="panel-card">
          <CardHeader
            title="CI Robustness"
            icon={<ShieldCheck size={18} color="#10b981" />}
            tooltip="Percentage of PRs with failing CI checks out of all PRs with known CI status. A high rate indicates flaky tests or build issues."
          />
          <div className="metric-value">{prs.ci_failure_rate.failure_rate_pct}% <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 400 }}>failure rate</span></div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '1.25rem', lineHeight: '1.5' }}>
            {prs.ci_failure_rate.failures} failures out of {prs.ci_failure_rate.total} tracked CI actions.
          </p>
        </div>

        <div className="panel-card">
          <CardHeader
            title="Merge Latency"
            icon={<TrendingDown size={18} color="#3b82f6" />}
            tooltip="Average number of days from PR creation to merge. Lower is better — it means the team reviews and merges quickly."
          />
          <div className="metric-value">{prs.avg_merge_time_days || '—'} <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 400 }}>avg days</span></div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '1.25rem' }}>Average cycle time from PR creation to merge.</p>
        </div>

        <div className="panel-card">
          <CardHeader
            title="Issue Backlog"
            icon={<AlertCircle size={18} color="#64748b" />}
            tooltip="Open vs total issues in the repository. A high open count relative to total suggests outstanding bugs or feature requests piling up."
          />
          <div className="metric-value">{issues.open} <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 400 }}>open / {issues.total} total</span></div>
          <div className="progress-track" style={{ marginTop: '1.25rem' }}>
            <div className="progress-fill" style={{ width: `${issues.total > 0 ? (issues.closed/issues.total) * 100 : 0}%`, background: '#10b981' }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem' }}>
            Resolution rate: <span style={{ color: '#10b981' }}>{issues.total > 0 ? Math.round((issues.closed/issues.total)*100) : 0}%</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default HealthPanel;
