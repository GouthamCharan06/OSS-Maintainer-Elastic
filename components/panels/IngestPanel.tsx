'use client';

import React, { useState } from 'react';
import { useDashboard } from '../DashboardProvider';
import { Github, Key, ArrowRight, Loader2, CheckCircle2, AlertCircle, RefreshCw, XCircle } from 'lucide-react';

const IngestPanel = () => {
  const { ingestRepo, isLoading, intakeData, error, rateLimit, cancelOrchestration } = useDashboard();
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) ingestRepo(url, token);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <section className="panel-card" style={{ maxWidth: '640px' }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>Analyze Repository</h3>
        <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1.5rem' }}>
          Ingest PRs, Issues, CI status & Contributors via GitHub API with rate-limit-aware batching and incremental sync.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
              <Github size={18} />
            </div>
            <input
              type="text"
              placeholder="https://github.com/owner/repo"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.875rem 1rem 0.875rem 3rem',
                backgroundColor: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.875rem',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
              <Key size={18} />
            </div>
            <input
              type="password"
              placeholder="Personal Access Token (optional — avoids rate limits)"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.875rem 1rem 0.875rem 3rem',
                backgroundColor: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '0.875rem',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="submit"
              disabled={!url || isLoading}
              style={{
                flex: 1,
                padding: '0.875rem',
                backgroundColor: !url || isLoading ? '#1e293b' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: (!url || isLoading) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'background-color 0.2s ease'
              }}
            >
              {isLoading ? (
                <><Loader2 className="animate-spin" size={18} /> Orchestrating Agents...</>
              ) : (
                <>Run Full Analysis <ArrowRight size={18} /></>
              )}
            </button>

            {isLoading && (
              <button
                type="button"
                onClick={cancelOrchestration}
                style={{
                  padding: '0.875rem 1.25rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <XCircle size={18} /> Cancel
              </button>
            )}
          </div>
        </form>

        {error && (
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1rem', 
            backgroundColor: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'start',
            gap: '0.75rem',
            color: '#ef4444',
            fontSize: '0.875rem'
          }}>
            <AlertCircle size={18} style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                {error.includes('rate limit') || error.includes('403') ? 'GitHub Rate Limit Hit' : 'Orchestration Failed'}
              </p>
              <p>{error}</p>
              {error.includes('rate limit') || error.includes('403') ? (
                <p style={{ marginTop: '0.5rem', color: '#f59e0b', fontSize: '0.8rem' }}>
                  Provide a Personal Access Token to increase your rate limit from 60 to 5,000 requests/hour.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </section>

      {intakeData && (
        <section className="panel-card" style={{ maxWidth: '640px', borderColor: '#10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#10b981' }}>
              <CheckCircle2 size={24} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>Ingestion Complete</h3>
            </div>
            {intakeData.incrementalSync && (
              <span style={{ fontSize: '0.7rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(59, 130, 246, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                <RefreshCw size={11} /> Incremental Sync
              </span>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            {[
              { label: 'PRs', value: intakeData.counts.prs },
              { label: 'Issues', value: intakeData.counts.issues },
              { label: 'Contributors', value: intakeData.counts.contributors },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center', padding: '1rem', backgroundColor: '#020617', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.5rem' }}>{item.label}</p>
                <p className="metric-value" style={{ fontSize: '1.5rem' }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* Rate Limit Info */}
          {rateLimit && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.04)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>GitHub API Remaining</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600, color: rateLimit.remaining < 100 ? '#f59e0b' : '#10b981' }}>
                {rateLimit.remaining} / {rateLimit.limit}
              </span>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default IngestPanel;
