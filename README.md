# 🛡️ OSS Maintainer Helper

> **An intelligent pipeline for open source repository maintenance** — powered by [Elastic Agent Builder](https://www.elastic.co/agent-builder), ES|QL, and Elasticsearch.

Built for the **Elasticsearch Agent Builder Hackathon 2026**.

---

## The Problem

Open source maintainers are drowning. Popular repositories accumulate hundreds of pull requests, each requiring manual triage: Is this risky? Who should review it? Is CI failing? Is this from a first-time contributor? Maintainers spend **hours per week** on repetitive triage instead of building.

## The Solution

OSS Maintainer Helper is a **4-step analysis pipeline** paired with an **Elastic Agent Builder conversational agent** that automates repository intelligence using Elasticsearch:

```
GitHub API → Fetch Repo Data → Elasticsearch (5 indices)
                                      ↓
                       Analyze Risk → Analyze Health → Generate Briefing
                                      ↓
                        Maintainer Dashboard + Agent Chat
```

### How It Works

The system runs a **sequential pipeline** of 4 deterministic steps:

1. **Fetching Repo Data** — Fetches PRs, issues, and contributor data from GitHub with rate-limit-aware batching, ETag caching, and incremental sync
2. **Analyzing Risk** — Computes deterministic risk scores using weighted factor analysis (diff size, core file changes, CI failures, contributor history) with full reasoning traces persisted to Elasticsearch
3. **Analyzing Health** — Generates health telemetry using ES|QL aggregations: merge velocity trends, backlog growth, CI failure time-series, and stale PR detection
4. **Generating Briefing** — Synthesizes a Maintainer Briefing: urgency score, priority queue, stability warnings, proposed labels, reviewer suggestions, and justification trace

On top of the pipeline, an **Elastic Agent Builder** conversational agent lets you ask natural language questions about your repository data. It autonomously decides which ES|QL queries to execute and interprets the results.

## Elastic Products Used

| Product | Usage |
|---------|-------|
| **Agent Builder** | Custom AI agent with ES|QL tools for conversational queries via Kibana Converse API |
| **ES\|QL** | All analytics queries: PR distribution, contributor ranking, health metrics, stale detection |
| **Elasticsearch** | 5 indices (`repo_prs`, `repo_issues`, `repo_contributors`, `orchestration_runs`, `reasoning_traces`), bulk upsert |
| **Elasticsearch Aggregations** | Merge velocity trends (date histogram), backlog growth, CI failure time-series |

## Features

-  **Real-time SSE pipeline** : Watch 4 steps execute sequentially with live progress and timing
-  **Deterministic risk scoring** : No LLM guesswork; weighted factors with transparent reasoning traces
-  **Agent Chat** : Ask questions in natural language; the Elastic Agent Builder agent autonomously queries ES via ES|QL tools, with a visible thought process breakdown
-  **Trend visualization** : Merge velocity, backlog growth, and CI failure bar charts (8-week windows)
-  **Urgency gauge** : Composite urgency score (0-100) with actionable priority queue
-  **Label suggestions** : Auto-generated GitHub label recommendations per PR
-  **Reviewer suggestions** : Based on contributor merge history from ES analytics
-  **Info tooltips** : Hover over any metric card to see a plain-language explanation
-  **Incremental sync** : Upsert-based indexing with 5-minute debounce
-  **Cancel button** : Abort any running pipeline instantly

## Setup

### Prerequisites
- Node.js 18+
- [Elastic Cloud](https://cloud.elastic.co) project (free trial works)

### Installation

```bash
git clone https://github.com/GouthamCharan06/OSS-Maintainer-Elastic.git
cd OSS-Maintainer-Elastic
npm install
```

### 1. Elastic Agent Builder Setup

Create an agent and assign ES|QL tools in the Kibana Agent Builder UI. The agent instructions and sample queries are in the `elastic/` directory:
- `elastic/agent-instructions.md` — System prompt for the agent
- `elastic/tool-queries.esql` — ES|QL queries used by the agent's tools

### 2. Environment Variables

Create a `.env` file based on `.env.example`:
```bash
# Elasticsearch connection
ELASTICSEARCH_URL='https://...'
ELASTICSEARCH_API_KEY='...'

# Kibana connection (for Agent Builder)
KIBANA_URL='https://...'
ELASTIC_AGENT_ID='...'  # From Kibana Agent Builder UI

# Authentication (choose one)
KIBANA_USERNAME='elastic'
KIBANA_PASSWORD='...'
# OR
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
│                    Next.js Dashboard                        │
│  ┌──────────┬────────────┬───────────┬──────────┬─────────┐│
│  │  Ingest  │   Risk     │  Health   │ Decision │  Agent  ││
│  │  Panel   │   Panel    │  Panel    │  Output  │  Chat   ││
│  └────┬─────┴─────┬──────┴────┬──────┴────┬─────┴────┬────┘│
│       │           │           │           │          │      │
│  ┌────▼───────────▼───────────▼───────────▼──────────▼────┐│
│  │              SSE Stream (Typed Events)                  ││
│  └────────────────────────┬───────────────────────────────┘│
└───────────────────────────┼────────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────────┐
│                  Pipeline Orchestrator                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Fetch   ├─►│ Analyze  ├─►│ Analyze  ├─►│ Generate │  │
│  │  Data    │  │  Risk    │  │  Health  │  │ Briefing │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└───────┼──────────────┼────────────┼──────────────┼─────────┘
        │              │            │              │
┌───────▼──────────────▼────────────▼──────────────▼─────────┐
│                     Elasticsearch                           │
│  ┌───────────┐ ┌──────────┐ ┌────────────┐ ┌────────────┐ │
│  │ repo_prs  │ │  issues  │ │ reasoning  │ │orchestration│ │
│  │           │ │          │ │  _traces   │ │   _runs    │ │
│  └───────────┘ └──────────┘ └────────────┘ └────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │      Agent Builder (ES|QL Tools + Converse API)       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React, TypeScript
- **Backend**: Next.js API Routes, Server-Sent Events
- **Search & Analytics**: Elasticsearch, ES|QL
- **AI Agent**: Elastic Agent Builder (Converse API)
- **Data Source**: GitHub REST API

## License

MIT — see [LICENSE](LICENSE).
