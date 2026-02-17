'use client';

import React from 'react';
import { useDashboard } from '../components/DashboardProvider';
import IngestPanel from '../components/panels/IngestPanel';
import RiskPanel from '../components/panels/RiskPanel';
import HealthPanel from '../components/panels/HealthPanel';
import AnalyticsPanel from '../components/panels/AnalyticsPanel';
import AgentChatPanel from '../components/panels/AgentChatPanel';
import AgentMonitor from '../components/AgentMonitor';

export default function DashboardPage() {
  const { activePanel, currentRepo } = useDashboard();

  const panelTitle = {
    ingest: 'Repository Ingestion',
    risk: 'Risk Intelligence',
    health: 'Repository Health',
    decision: 'Decision Output',
    'agent-chat': 'Agent Chat',
  }[activePanel];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ 
        padding: '1.25rem 2rem', 
        borderBottom: '1px solid #334155', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        background: '#020617',
        flexShrink: 0,
      }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc' }}>
            {panelTitle}
          </h2>
          {currentRepo && (
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
              Active Repo: <span style={{ color: '#3b82f6', fontWeight: 500 }}>{currentRepo}</span>
            </p>
          )}
        </div>
        <div style={{ fontSize: '0.7rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
          Elasticsearch Connected
        </div>
      </header>

      {/* Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', background: '#020617', padding: '2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <AgentMonitor />
          {activePanel === 'ingest' && <IngestPanel />}
          {activePanel === 'risk' && <RiskPanel />}
          {activePanel === 'health' && <HealthPanel />}
          {activePanel === 'decision' && <AnalyticsPanel />}
          {activePanel === 'agent-chat' && <AgentChatPanel />}
        </div>
      </div>
    </div>
  );
}
