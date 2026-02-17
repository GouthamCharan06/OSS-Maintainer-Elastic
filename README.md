# 🛡️ OSS Maintainer Agent

> **An intelligent multi-agent system for open source maintainers** — powered by [Elastic Agent Builder](https://www.elastic.co/agent-builder), ES|QL, and Elasticsearch.

Built for the **Elasticsearch Agent Builder Hackathon 2026**.

---

## The Problem

Open source maintainers are drowning. A popular repository can accumulate hundreds of PRs, each requiring manual triage: Is this risky? Who should review it? Is CI failing? Is this contributor new? Maintainers spend **hours per week** on repetitive triage instead of building.

## The Solution

OSS Maintainer Agent is a **4-agent orchestration pipeline** that automates repository intelligence using Elasticsearch as the sole reasoning substrate:

```
GitHub API → Intake Agent → Elasticsearch (5 indices)
                                  ↓
                    Agent Builder (4 ES|QL Tools)
                                  ↓
              Risk Agent → Health Agent → Action Agent
                                  ↓
                    Maintainer Briefing Dashboard
                              + Agent Chat
```

### What It Does

1. **Intake Agent** — Fetches PRs, issues, and contributor data from GitHub with rate-limit-aware batching, ETag caching, and incremental sync (upsert, not delete-all)
2. **Risk Agent** — Computes deterministic risk scores using weighted factor analysis (diff size, core file changes, CI failures, contributor history) with full reasoning traces persisted to Elasticsearch
3. **Health Agent** — Generates comprehensive health telemetry using ES|QL aggregations: merge velocity trends, backlog growth, CI failure time-series, and stale PR detection
4. **Action Agent** — Synthesizes a Maintainer Briefing: urgency score, priority queue, stability warnings, proposed labels, reviewer suggestions, and a justification trace
5. **Agent Chat** — Conversational interface powered by **Elastic Agent Builder's Converse API** with 4 custom ES|QL tools for natural language queries over your repository data

## Elastic Products Used

| Product | Usage |
|---------|-------|
| **Agent Builder** | 4 custom ES|QL tools + OSS Maintainer Agent via Kibana API (`/api/agent_builder/tools`, `/agents`, `/converse`) |
| **ES\|QL** | All analytics queries: PR risk analysis, contributor ranking, health metrics, stale detection |
| **Elasticsearch** | 5 indices (`repo_prs`, `repo_issues`, `repo_contributors`, `orchestration_runs`, `reasoning_traces`), bulk upsert, date histogram aggregations |
| **Elasticsearch Aggregations** | Merge velocity trends (8 weeks), backlog growth, CI failure time-series |

## Features

- ⚡ **Real-time SSE pipeline** — Watch 4 agents execute sequentially with live progress and timing
- 🧠 **Deterministic risk scoring** — No LLM guesswork; weighted factors with transparent reasoning traces
- 📊 **Trend visualization** — Merge velocity, backlog growth, and CI failure bar charts
- 🎯 **Urgency gauge** — Composite urgency score (0-100) with actionable priority queue
- 💬 **Agent Chat** — Ask questions in natural language; Agent Builder queries ES via ES|QL tools
- 🏷️ **Label suggestions** — Auto-generated GitHub label recommendations per PR
- 👥 **Reviewer suggestions** — Based on contributor merge history from ES analytics
- 🔄 **Incremental sync** — Upsert-based indexing with 5-minute debounce
- 🛑 **Cancel button** — Abort any running orchestration instantly

## Setup

### Prerequisites
- Node.js 18+
- [Elastic Cloud Serverless](https://cloud.elastic.co) project (free trial works)

### Installation

```bash
git clone https://github.com/GouthamCharan06/OSS-Maintainer-Elastic.git
cd OSS-Maintainer-Elastic
npm install
```

### 1. Agent Builder Configuration
The agent instructions and custom ES\|QL queries used for the tools are documented in the [elastic/](file:///c:/OSS-Maintainer/OSS-Maintainer-Elastic/elastic) directory as per hackathon requirements:
- [Agent Instructions](file:///c:/OSS-Maintainer/OSS-Maintainer-Elastic/elastic/agent-instructions.md)
- [Custom ES\|QL Queries](file:///c:/OSS-Maintainer/OSS-Maintainer-Elastic/elastic/tool-queries.esql)

### 2. Set up Environment Variables
Create a `.env` file based on [.env.example](file:///c:/OSS-Maintainer/OSS-Maintainer-Elastic/.env.example):
```bash
# Elasticsearch connection
ELASTICSEARCH_URL='https://...'
ELASTICSEARCH_API_KEY='...'

# Kibana connection (for Agent Builder)
KIBANA_URL='https://...'
# Add ELASTIC_AGENT_ID after creating the agent in Kibana
ELASTIC_AGENT_ID='...'

# Option 1: Basic auth (most reliable for Kibana APIs)
KIBANA_USERNAME='elastic'
KIBANA_PASSWORD='...'

# Option 2: API key (works on serverless Elastic Cloud)
# KIBANA_API_KEY='...'

# GitHub Personal Access Token
GITHUB_PAT='ghp_...'
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and enter a GitHub repository URL.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Dashboard                         │
│  ┌──────────┬────────────┬───────────┬──────────┬─────────┐ │
│  │  Ingest  │   Risk     │  Health   │ Decision │  Agent  │ │
│  │  Panel   │   Panel    │  Panel    │  Output  │  Chat   │ │
│  └────┬─────┴─────┬──────┴────┬──────┴────┬─────┴────┬────┘ │
│       │           │           │           │          │       │
│  ┌────▼───────────▼───────────▼───────────▼──────────▼────┐ │
│  │              SSE Stream (Typed Events)                  │ │
│  └────────────────────────┬───────────────────────────────┘ │
└───────────────────────────┼─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   Agent Orchestrator                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Intake  ├─►│   Risk   ├─►│  Health  ├─►│  Action  │   │
│  │  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼──────────────┼────────────┼──────────────┼──────────┘
        │              │            │              │
┌───────▼──────────────▼────────────▼──────────────▼──────────┐
│                     Elasticsearch                            │
│  ┌───────────┐ ┌──────────┐ ┌────────────┐ ┌─────────────┐ │
│  │ repo_prs  │ │  issues  │ │ reasoning  │ │orchestration│ │
│  │           │ │          │ │  _traces   │ │   _runs     │ │
│  └───────────┘ └──────────┘ └────────────┘ └─────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │        Agent Builder (4 ES|QL Tools)                  │   │
│  │  pr_risk_analysis │ repo_health │ contributors │ stale│   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React, TypeScript
- **Backend**: Next.js API Routes, Server-Sent Events
- **Search & Analytics**: Elasticsearch, ES|QL
- **AI Agent**: Elastic Agent Builder (Kibana API)
- **Data Source**: GitHub REST API

## License

MIT — see [LICENSE](LICENSE).
