import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'OSS Maintainer Helper',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/ingest     — Ingest a GitHub repo (body: { repo_url, token? })',
      'GET  /api/risk       — Get risk-ranked PRs (?repo=owner/repo)',
      'GET  /api/summary    — Get repo health summary (?repo=owner/repo)',
      'GET  /api/analytics  — Get ES|QL analytics (?repo=owner/repo)',
    ],
  });
}
