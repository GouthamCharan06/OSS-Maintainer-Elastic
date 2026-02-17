'use client';

import React from 'react';
import { useDashboard } from './DashboardProvider';
import { 
  Database, 
  ShieldAlert, 
  Activity, 
  Zap,
  Github,
  Info,
  Wifi,
  Bot
} from 'lucide-react';

const Sidebar = () => {
  const { activePanel, setActivePanel, currentRepo, rateLimit } = useDashboard();

  const navItems = [
    { id: 'ingest' as const, label: 'Ingest Repo', icon: Database },
    { id: 'risk' as const, label: 'Risk Intelligence', icon: ShieldAlert, disabled: !currentRepo },
    { id: 'health' as const, label: 'Repo Health', icon: Activity, disabled: !currentRepo },
    { id: 'decision' as const, label: 'Decision Output', icon: Zap, disabled: !currentRepo },
    { id: 'agent-chat' as const, label: 'Agent Chat', icon: Bot, disabled: !currentRepo },
  ];

  return (
    <aside style={{
      width: '280px',
      height: '100%',
      backgroundColor: '#0f172a',
      borderRight: '1px solid #334155',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem 1rem',
      zIndex: 50
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem', paddingLeft: '0.5rem' }}>
        <div style={{ backgroundColor: '#3b82f6', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Github size={20} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.025em', color: '#f8fafc' }}>OSS Maintainer</h1>
          <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>v2.0 Elastic Agent</p>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => !item.disabled && setActivePanel(item.id)}
            disabled={item.disabled}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activePanel === item.id ? '#1e293b' : 'transparent',
              color: item.disabled ? '#334155' : activePanel === item.id ? '#3b82f6' : '#94a3b8',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'left',
              width: '100%',
              fontSize: '0.875rem',
              fontWeight: activePanel === item.id ? 600 : 500
            }}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* GitHub API Status */}
      {rateLimit && (
        <div style={{ 
          padding: '0.875rem', 
          backgroundColor: 'rgba(16, 185, 129, 0.05)', 
          borderRadius: '10px', 
          border: '1px solid rgba(16, 185, 129, 0.1)',
          marginBottom: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: rateLimit.remaining < 100 ? '#f59e0b' : '#10b981' }}>
            <Wifi size={13} />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>GitHub API</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8' }}>
            <span>Remaining</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: rateLimit.remaining < 100 ? '#f59e0b' : '#10b981' }}>
              {rateLimit.remaining}/{rateLimit.limit}
            </span>
          </div>
        </div>
      )}

      <div style={{ 
        padding: '1rem', 
        backgroundColor: 'rgba(59, 130, 246, 0.05)', 
        borderRadius: '12px', 
        border: '1px solid rgba(59, 130, 246, 0.1)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: '#3b82f6' }}>
          <Info size={14} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>System Status</span>
        </div>
        <p style={{ fontSize: '0.7rem', color: '#64748b', lineHeight: '1.4' }}>
          Deterministic engine online. ES|QL-powered analytics. Zero LLM dependency.
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
