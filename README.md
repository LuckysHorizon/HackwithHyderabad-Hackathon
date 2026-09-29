# Antibody

An immune-memory layer for customer-facing AI agents.

Antibody sits in front of an AI agent as a gateway. Before the agent answers a
user, Antibody recalls how similar users and messages have behaved in the past,
grades the request, and returns a graded decision: allow, verify, sandbox, or
block. Every interaction is sanitized and retained, so an attack that succeeds
once is recognized and stopped the next time it appears — across sessions and,
optionally, across tenants.

It is built on [Hindsight](https://hindsight.vectorize.io) for agent memory,
[Groq](https://groq.com) for fast LLM inference, and a FastAPI backend that
streams decisions to a live React console over WebSocket.

## How it works

Every request flows through four stages:

1. **Recall** — before the agent replies, the gateway retrieves related past
   traffic and confirmed attack patterns (antigens) from memory, scoped to the
   tenant.
2. **Decide** — a risk engine combines recalled evidence, identity signals, and
   an LLM judgment into a graded decision (`allow`, `verify`, `sandbox`,
   `block`) with cited evidence.
3. **Retain** — the sanitized interaction is written to the traffic bank.
   Identifiers are stripped and hashed first, so raw personal data never lands
   in memory.
4. **Reflect** — a periodic Dream Cycle reviews stored traffic offline and
   synthesizes new attack patterns, promoting recurring tactics into the
   antigen bank so future recall is sharper.

## Architecture

```
                          +--------------------------+
   user message  ----->   |     Antibody Gateway     |   ----->  agent reply
                          |        (FastAPI)         |           + decision
                          +-----------+--------------+
                                      |
             recall / retain / reflect|                 fast LLM judgment
                                      v                        |
                          +--------------------------+         v
                          |   Hindsight memory banks |    +---------+
                          |  traffic / antigen /dream|    |  Groq   |
                          +--------------------------+    +---------+
                                      |
                       live events (WebSocket) + REST
                                      v
              +-----------------------+-----------------------+
              |  React console (web/)  |  Next.js landing page |
              |   served at :8000      |        at :3000        |
              +------------------------+-----------------------+
```

## Repository structure

```
.
├── api/                      FastAPI backend (the gateway)
│   ├── main.py               HTTP/WS surface + static console mount
│   ├── gateway.py            request handling, recall/retain, session state
│   ├── risk.py               risk engine and decision grading
│   ├── orchestrator.py       agent tool orchestration
│   ├── dream.py              Dream Cycle (offline reflection)
│   ├── analyst.py            analyst verdict loop
│   ├── identity.py           identity signals and hashing
│   ├── sanitize.py           identifier stripping before storage
│   ├── llm.py                Groq client wrapper
│   ├── events.py             in-memory event bus for the live feed
│   ├── config.py             settings loaded from environment
│   ├── models.py             request/response schemas
│   ├── agents/               demo target agent (bots)
│   └── memory/               Hindsight client wrapper
├── scripts/                  operational and evaluation scripts
│   ├── setup_banks.py        create and configure the Hindsight banks
│   ├── seed_antigens.py      seed confirmed attack patterns (vaccination)
│   ├── replay.py             replay traffic through the gateway
│   ├── eval.py               eval harness: memory ON vs OFF
│   └── probe_hindsight.py    connectivity probe for Hindsight
├── web/                      React console (UMD + Babel, no build step)
│   ├── index.html            dashboard entry
│   ├── app.js                dashboard application
│   ├── app.css / tokens.css  styling and design tokens
│   ├── scamme.html           "Scam Me" challenge page
│   └── scoreboard.html       big-screen scoreboard
├── landing-page/
│   └── saas-landing-template/  Next.js marketing landing page
├── requirements.txt
├── .env.example              configuration template (copy to .env)
└── README.md
```

## Prerequisites

- Python 3.11+
- Node.js 20+ and pnpm (for the landing page only)
- A Hindsight API key
- A Groq API key

## Configuration

All secrets and tunables are read from a `.env` file at the repository root.
Copy the template and fill in your own values:

```
cp .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `HINDSIGHT_BASE_URL` | Hindsight API base URL |
| `HINDSIGHT_API_KEY` | Hindsight API key (required) |
| `HINDSIGHT_TRAFFIC_BANK` | Bank id for retained traffic |
| `HINDSIGHT_ANTIGEN_BANK` | Bank id for confirmed attack patterns |
| `HINDSIGHT_DREAM_BANK` | Bank id for Dream Cycle insights |
| `GROQ_API_KEY` | Groq API key |
| `GROQ_API_KEY_BACKUP` | Optional second Groq key for failover |
| `GROQ_MODEL` | Primary Groq model id |
| `GROQ_MODEL_FALLBACK` | Fallback Groq model id |
| `IDENTITY_SALT` | Salt used when hashing identifiers |

The `.env` file is gitignored and must never be committed. `.env.example`
contains placeholders only and is safe to share.

## Running the backend

From the repository root, with a virtual environment active:

```
python -m venv .venv
./.venv/Scripts/python -m pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux

# one-time: create and configure the memory banks, then seed antigens
./.venv/Scripts/python scripts/setup_banks.py
./.venv/Scripts/python scripts/seed_antigens.py

# start the gateway + console
./.venv/Scripts/python -m uvicorn api.main:app --reload --port 8000
```

The console is then available at http://localhost:8000/.

## Running the console

The React console in `web/` needs no build step — it is served directly by the
backend at http://localhost:8000/ once the gateway is running. It talks to the
same origin over REST and a `/events` WebSocket.

## Running the landing page

The marketing landing page is a separate Next.js app.

```
cd "landing-page/saas-landing-template"
pnpm install
pnpm dev
```

It runs at http://localhost:3000/. Its "Try here" buttons link to the console
at http://localhost:8000/, so start the backend as well to follow them.

## Deployment

Antibody is two deployable units:

1. **Gateway + console** (`api/` + `web/`) — one stateful, long-lived web
   service. It holds in-memory state (event feed, analyst queue, scam log) and
   serves a `/events` WebSocket, so it must run as a single persistent instance.
   Serverless/function platforms are not suitable.
2. **Landing page** (`landing-page/saas-landing-template/`) — a static Next.js
   site that only links to the gateway. It deploys anywhere Next.js runs.

### Gateway + console → Render (quickest)

A `render.yaml` blueprint is included. On [Render](https://render.com), create
a new Blueprint from the repository; it provisions one free web service that
runs `uvicorn api.main:app --host 0.0.0.0 --port $PORT`, health-checks
`/health`, and prompts for the secret env vars.

Set these in the Render dashboard (the blueprint marks them `sync: false` so
they are never stored in git):

- `HINDSIGHT_API_KEY`
- `GROQ_API_KEY` (and `GROQ_API_KEY_BACKUP` if you have one)
- `IDENTITY_SALT` (any long random string)

The non-secret defaults (`HINDSIGHT_BASE_URL`, the three bank ids, and the Groq
model ids) are inlined in the blueprint and can be overridden in the dashboard.

Once the service is live, run the one-time bank setup from the service Shell so
the demo starts with confirmed attack patterns loaded:

```
python scripts/setup_banks.py
python scripts/seed_antigens.py
```

The console is then served at the service root (`https://<your-service>/`) and
the WebSocket upgrades to `wss://` automatically — the frontend derives its
origin from the browser, so no frontend URL needs editing.

### Gateway + console → Railway / Fly / any container host

A `Dockerfile` (python:3.12-slim) and a `Procfile` are included for
container-based platforms. Both bind to `0.0.0.0:$PORT`. Set the same env vars
listed above in the platform's settings, then run the two setup scripts once
from a shell on the instance.

### Landing page → Vercel

Import `landing-page/saas-landing-template/` on [Vercel](https://vercel.com)
(the repo root is the monorepo; point the project root at that subdirectory).
Set one environment variable so the "Try here" buttons target the deployed
gateway instead of localhost:

```
NEXT_PUBLIC_APP_URL=https://<your-gateway-host>/
```

See `landing-page/saas-landing-template/.env.example`. With it unset, the
buttons fall back to `http://localhost:8000/`.

### Before exposing it publicly

The gateway is unauthenticated and uses permissive CORS (`*`) by design, for a
local demo or kiosk. Put it behind authentication and tighten CORS before
exposing it on a public URL, and rotate any Hindsight and Groq keys used during
the hackathon.

## Scripts

| Script | What it does |
| --- | --- |
| `scripts/setup_banks.py` | Creates the three Hindsight banks and sets the tactic vocabulary. Idempotent. |
| `scripts/seed_antigens.py` | Seeds the antigen bank with confirmed attack patterns and a few legitimate ones. |
| `scripts/replay.py` | Replays recorded traffic through the gateway. |
| `scripts/eval.py` | Runs a labelled set of sessions with memory ON and OFF and writes `eval_report.json`. |
| `scripts/probe_hindsight.py` | Checks connectivity to Hindsight. |

## API reference

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Liveness check. |
| POST | `/chat` | Core hot path: grade a message and return a decision. |
| GET | `/feed` | Recent decision and system events. |
| GET | `/queue` | Sessions awaiting analyst review. |
| GET | `/session/{id}` | Full detail for one session. |
| GET | `/campaigns` | Confirmed antigens. |
| GET | `/graph` | Identity graph (attackers, sessions, tactics). |
| GET | `/dream` | Stored Dream Cycle insights. |
| POST | `/dream/run` | Run a Dream Cycle now. |
| GET | `/eval` | Latest eval report. |
| GET | `/metrics` | Decision counts, latency percentiles, memory on/off comparison. |
| POST | `/verdict` | Record an analyst verdict (confirm or dismiss). |
| GET | `/events` | WebSocket stream of live events. |

## The "Scam Me" challenge

`web/scamme.html` (served at `/scamme-app`) is an interactive demo where players
try to socially engineer the agent into moving money. Each attempt is graded by
the live gateway, and the outcome feeds a big-screen scoreboard at `/scoreboard`
(`web/scoreboard.html`). It is a hands-on way to show the memory layer learning
from attacks in real time.

## Security and privacy

- Secrets live only in `.env`, which is gitignored. Rotate any keys used during
  development before sharing the project.
- A sanitizer strips identifiers, and phone numbers and emails are hashed with a
  salt before anything is written to memory. The UI shows only the last two
  digits of an identifier.
- Every recall is filtered by tenant, so one tenant cannot see another's
  traffic.
- The demo API is unauthenticated and uses permissive CORS. This is intended for
  a local demo or kiosk only. Put it behind authentication and tighten CORS
  before exposing it publicly.

## Tech stack

- Backend: Python, FastAPI, Uvicorn, WebSockets
- Memory: Hindsight
- LLM: Groq
- Console: React 18 (UMD) with Chart.js and vis-network
- Landing page: Next.js, React 19, Tailwind CSS 4, Framer Motion

## Status

Built for a hackathon. It is a working demo rather than a hardened production
service; see the security notes above before deploying it anywhere public.
