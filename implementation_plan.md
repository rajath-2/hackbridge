# HackBridge — Antigravity Implementation Plan
**Version:** 1.5 | **April 2026**
**Status:** Planning — Awaiting Approval

---

## Overview

HackBridge is a real-time hackathon intelligence platform. This plan covers building the full monorepo from scratch: a Next.js 14 frontend, FastAPI backend, Node.js CLI tool, and Supabase database — all connected through Groq AI and Supabase Realtime.

The context docs (`HackBridge_Blueprint_v1_4.md`, `prd.md`, `design.md`, and SQL files `01–06`) are the authoritative sources. **v1.5 supersedes all prior versions** on the following points:

| Area | v1.5 Change |
|---|---|
| Mentor Matching | Two-stage (track-based → code-based); organizer consent required for swaps |
| Track Selection | Immutable once event starts; AI detects drift and flags deviating teams |
| Plagiarism Engine | Progressive pre-round sweeps + velocity anomaly (3rd signal); organizer manual trigger |
| Idle Warning | Teams with 0 commits at sweep time receive a targeted `idle_warning` notification |
| Schema | New `match_suggestions` table; 4 new `teams` columns; `flags` redesigned with `flag_type` |

> [!IMPORTANT]
> `context/06_operational_queries.sql` is **reference-only** — helper queries for the backend and debugging. It is NOT part of the Supabase setup SQL sequence. Only files `01–05` are run in order.

---

## Open Questions

> [!IMPORTANT]
> Need answers before implementation begins:
> 1. **Do you have a Supabase project already set up?** (URL + anon key needed to test locally)
> 2. **Do you have a Groq API key?**
> 3. **Do you have a GitHub PAT?** (optional, but raises API rate limits significantly)

> [!NOTE]
> **Resolved decisions (no longer blocking):**
> - **Frontend deployment:** Vercel. CORS in FastAPI will be configured to allow `https://<your-app>.vercel.app` + `http://localhost:3000`.
> - **CLI publishing:** Will be published to npm so teams can run `npx hackbridge-cli init <TEAM_CODE>`.

---

## Monorepo Structure

```
hackbridge/
├── apps/
│   ├── web/              # Next.js 14 (App Router) + TypeScript + Tailwind CSS
│   └── api/              # FastAPI (Python 3.11+)
│       ├── routers/
│       │   ├── events.py, teams.py, mentor_match.py, plagiarism.py
│       │   ├── integrity.py     ← NEW v1.5 (track-drift + sweep orchestration)
│       │   ├── commits.py, scores.py, notifications.py, users.py
│       ├── services/
│       │   ├── groq_service.py, github_service.py, pdf_service.py
│       │   ├── plagiarism_service.py  ← updated v1.5 (3-signal engine)
│       │   ├── integrity_service.py   ← NEW v1.5 (track drift + sweep runner)
│       │   └── matching_service.py    ← NEW v1.5 (multi-stage matching)
├── packages/
│   └── cli/              # hackbridge-cli (Node.js + TypeScript)
├── sql/                  # Supabase SQL — copy from context/01–05
├── context/              # Source of truth docs (read-only)
└── README.md
```

---

## Proposed Changes

### Phase 0 — Repo & SQL Setup

#### [NEW] `sql/01_schema.sql` through `sql/05_realtime.sql`
Copy from `context/01_schema.sql` through `context/05_realtime.sql` verbatim. Run in order in Supabase SQL editor.

> [!IMPORTANT]
> **v1.5 schema additions:** `context/01_schema.sql` is already updated. When patching an existing DB, apply this migration:
> ```sql
> -- v1.4 columns (if not already applied)
> ALTER TABLE teams
>   ADD COLUMN IF NOT EXISTS submission_status TEXT NOT NULL DEFAULT 'unsubmitted'
>     CHECK (submission_status IN ('unsubmitted', 'submitted')),
>   ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
>   ADD COLUMN IF NOT EXISTS resubmission_count INTEGER NOT NULL DEFAULT 0;
>
> -- v1.5 smart matching + track integrity
> ALTER TABLE teams
>   ADD COLUMN IF NOT EXISTS selected_track TEXT,
>   ADD COLUMN IF NOT EXISTS track_locked BOOLEAN NOT NULL DEFAULT false,
>   ADD COLUMN IF NOT EXISTS match_status TEXT NOT NULL DEFAULT 'pending_activity'
>     CHECK (match_status IN ('pending_activity','track_matched','code_matched','manual_override')),
>   ADD COLUMN IF NOT EXISTS mentor_match_score NUMERIC(5,2);
>
> -- v1.5 flags redesign
> CREATE TYPE IF NOT EXISTS flag_type AS ENUM ('plagiarism', 'track_deviation');
> ALTER TABLE flags
>   ADD COLUMN IF NOT EXISTS flag_type flag_type NOT NULL DEFAULT 'plagiarism',
>   ADD COLUMN IF NOT EXISTS velocity_evidence JSONB DEFAULT '{}',  -- Gap fix: 3rd signal storage
>   ADD COLUMN IF NOT EXISTS alignment_score NUMERIC(5,2),
>   ADD COLUMN IF NOT EXISTS alignment_rationale TEXT,
>   ADD COLUMN IF NOT EXISTS sweep_trigger TEXT,
>   ADD COLUMN IF NOT EXISTS sweep_round INTEGER,             -- which judging round triggered this
>   ADD COLUMN IF NOT EXISTS silenced BOOLEAN NOT NULL DEFAULT false,
>   ADD COLUMN IF NOT EXISTS silenced_by UUID REFERENCES users(id),
>   ADD COLUMN IF NOT EXISTS silenced_at TIMESTAMPTZ;
>
> -- v1.5 new table
> CREATE TABLE IF NOT EXISTS match_suggestions (
>   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
>   event_id UUID REFERENCES events(id) ON DELETE CASCADE,
>   team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
>   current_mentor_id UUID REFERENCES users(id),
>   current_match_score NUMERIC(5,2),
>   suggested_mentor_id UUID REFERENCES users(id),
>   suggested_match_score NUMERIC(5,2),
>   ai_rationale TEXT NOT NULL,
>   trigger_stage TEXT NOT NULL,
>   status TEXT NOT NULL DEFAULT 'pending'
>     CHECK (status IN ('pending','approved','rejected')),
>   reviewed_by UUID REFERENCES users(id),
>   reviewed_at TIMESTAMPTZ,
>   created_at TIMESTAMPTZ DEFAULT now()
> );
> ```

> [!NOTE]
> `context/06_operational_queries.sql` is NOT copied to `sql/` — it's reference only.

---

### Phase 1 — FastAPI Backend (`apps/api/`)

#### [NEW] `apps/api/requirements.txt`
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
supabase==2.4.6
groq==0.9.0
httpx==0.27.0
python-multipart==0.0.9
pydantic==2.7.1
pydantic-settings==2.2.1
opendataloader-pdf==0.2.0
python-dotenv==1.0.1
```

#### [NEW] `apps/api/core/config.py`
Pydantic `BaseSettings` loading from `.env`.

#### [NEW] `apps/api/core/supabase_client.py`
Singleton Supabase service-role client. **Never anon key on the backend.**

#### [NEW] `apps/api/core/dependencies.py`
`get_current_user()` — validates Supabase JWT, returns `{ id, role, name, email }`.

#### [NEW] `apps/api/services/groq_service.py`
All Groq AI calls:
- `fingerprint_repo()` → `{ languages, frameworks, domain, complexity, summary }`
- `summarise_commit()` → one-sentence string
- `score_mentor_match(repo_fingerprint, selected_track, expertise_tags, bio)` → `{ match_percentage, explanation }`
  - **Conditional prompt (Gap fix #5):** if `repo_fingerprint` is `None`/empty, uses **Stage 1 prompt** (track + bio only); otherwise uses **Stage 2 prompt** (full fingerprint).
- `suggest_scores(criteria, fingerprint, velocity)` → `{ rubric_scores, rationale }`
- `analyse_resume()` → `{ expertise_tags, domain, bio }`
- `check_track_alignment(repo_fingerprint, selected_track)` → `{ alignment_score: 0–100, rationale }` — **(NEW v1.5)**
- `_parse_json()` — strips markdown fences, parses JSON safely
- **Error handling (Gap fix #10):** All Groq calls implement 3 retries with exponential backoff on `5xx`/`429`. On final failure: matching retains Stage 1 result; integrity checks skip flag (team stays Clean); sweep summary logs the failure.

#### [NEW] `apps/api/services/github_service.py`
- `get_file_tree()`, `get_readme()`, `get_commits()` via GitHub REST API
- Respects optional `GITHUB_TOKEN` for rate limit headroom

#### [NEW] `apps/api/services/plagiarism_service.py`
Three-signal engine **(v1.5)**:
- **Git signal**: `pre_event_ratio > 0.5 → HIGH`, `> 0.2 → MEDIUM`, else `Clean`
- **Local scan signal**: `pre_scan_ratio > 0.4 → HIGH`, `> 0.15 → MEDIUM`, else `Clean`
- **Velocity anomaly signal** *(NEW v1.5)*: idle window ≥ 3 hrs followed by commit adding > 500 lines → `HIGH`
- Final `risk_level = max(git_signal, local_scan_signal, velocity_anomaly_signal)`
- Upserts `flags` with `flag_type='plagiarism'`, all three evidence objects, `sweep_trigger`, `sweep_round`

#### [NEW] `apps/api/services/integrity_service.py` **(NEW v1.5)**
Track drift detection + sweep orchestration:
- `check_track_drift(team_id, event_id, sweep_trigger)` — calls `groq_service.check_track_alignment()`; upserts `flags` row with `flag_type='track_deviation'` if `alignment_score < 60`
- `run_sweep(event_id, trigger, round=None)` — orchestrates per-team checks in parallel via `asyncio.gather()`. **Side effects by trigger (Gap fix #4):**
  - `auto_event_start` → also sets `track_locked=true` for all teams in the event
  - All triggers → identifies teams with 0 event-window commits; sends `idle_warning` notification
  - Returns `{ teams_checked, flags_raised, warnings_sent }`

#### Stage 2 Matching Trigger (Gap fix #7)
30 minutes before the `start_time` of `judging_rounds[0]`, the orchestrator (FastAPI background task or Supabase Edge Function) calls `POST /mentor-match/event/{event_id}/run-all` with `trigger_stage='pre_round_1'`. The Organizer Dashboard also exposes a manual "Run Matching Scan" button as a fallback.

#### [NEW] `apps/api/services/matching_service.py` **(NEW v1.5)**
Multi-stage matching logic:
- `match_team_track_based(team_id)` — Stage 1: uses `selected_track` + README; sets `match_status='track_matched'`
- `match_team_code_based(team_id)` — Stage 2: uses full `repo_fingerprint`; sets `match_status='code_matched'`
- `run_event_matching(event_id, trigger_stage)` — runs matching for every team; if `new_score >= current_score + 20`, creates a `match_suggestions` row instead of auto-assigning

#### [NEW] `apps/api/services/pdf_service.py`
Uses `opendataloader_pdf.convert()` with temp files (requires Java 11+). Returns extracted markdown text.

#### [NEW] `apps/api/models/schemas.py`
Pydantic models for all request/response bodies across all routers.

#### [NEW] `apps/api/routers/events.py`
- `POST /events/` — organizer creates event, auto-generates 6-char `event_code`
- `GET /events/{event_id}`
- `POST /events/join` — join by `event_code`
- `PUT /events/{event_id}/judging-rounds` — updates JSONB; each round must include `criteria` string[]
- `PUT /events/{event_id}/final-placement`
- `GET /events/{event_id}/mentor-request-stats`
- `GET /events/{event_id}/timeline` *(v1.4)* — returns `{ name, start_time, end_time, judging_rounds }`

#### [NEW] `apps/api/routers/teams.py`
**Auth split (Gap fix #8):** JWT-protected routes use `get_current_user()`. CLI-facing routes use `team_code` body validation only — no Bearer token.
- `POST /teams/` — participant creates team; accepts `selected_track` (required); backend rejects track changes with 403 after `events.start_time` **[JWT]**
- `POST /teams/join` — join by `team_code` **[JWT]**
- `GET /teams/{team_id}` — includes `match_status`, `selected_track`, `mentor_match_score` **[JWT]**
- `POST /teams/{team_id}/repo` — submit/update GitHub URL → async fingerprint → Stage 1 track-based match → sets `match_status='track_matched'` **[JWT]**
- `POST /teams/{team_id}/scan` — CLI scan; validates `team_code` body matches `team_id` FK **[team_code only — no JWT]**
- `POST /teams/{team_id}/mentor-ping` — rate-limited **10 min**; inserts `type='mentor_ping'`; uses `sender_id` (not `organizer_id`) **[JWT]**
- `GET /teams/{team_id}/mentor-ping-cooldown` — `{ can_ping, seconds_remaining }` **[JWT]**
- `GET /teams/{team_id}/status` — `{ repo_fingerprint, recent_commits, match_status, selected_track }` **[JWT]**
- `GET /teams/{team_id}/stats` *(v1.4)* — commit metrics for CLI `stats` + `activity` **[JWT]**
- `GET /teams/{team_id}/checklist` *(v1.4)* — readiness check; never returns flags/risk data **[JWT]**
- `POST /teams/{team_id}/submit` *(v1.4)* — sets `submission_status='submitted'`; 403 after `end_time` **[JWT]**

#### [NEW] `apps/api/routers/mentor_match.py`
- `POST /mentor-match/{team_id}` — uses `selected_track` if repo empty, `repo_fingerprint` otherwise; updates `mentor_id`, `mentor_match_score`, `match_status`
- `PUT /mentor-match/{team_id}/override` — organizer manually sets `mentor_id`; sets `match_status='manual_override'`
- `POST /mentor-match/event/{event_id}/run-all` *(NEW v1.5)* — full-event scan via `matching_service.run_event_matching()`; creates `match_suggestions` for improvements ≥ 20 pts
- `GET /mentor-match/event/{event_id}/suggestions` *(NEW v1.5)* — list pending suggestions (organizer only)
- `POST /mentor-match/suggestions/{suggestion_id}/approve` *(NEW v1.5)* — applies swap; notifies team + both mentors
- `POST /mentor-match/suggestions/{suggestion_id}/reject` *(NEW v1.5)* — sets `status='rejected'`; no mentor change

#### [NEW] `apps/api/routers/plagiarism.py`
- `POST /plagiarism/analyse/{team_id}` — three-signal engine; upserts `flags` with `flag_type='plagiarism'`
- `GET /plagiarism/{team_id}`
- `POST /plagiarism/sweep/event/{event_id}` *(NEW v1.5)* — full sweep via `integrity_service.run_sweep()`; body: `{ trigger, round? }`
- `GET /plagiarism/event/{event_id}/flags` *(NEW v1.5)* — all flags filterable by `flag_type` and `silenced`
- `POST /plagiarism/flags/{flag_id}/silence` *(NEW v1.5)* — sets `silenced=true`; records `silenced_by` + `silenced_at`

#### [NEW] `apps/api/routers/integrity.py` **(NEW v1.5)**
- `POST /integrity/track-drift/{team_id}` — single-team track drift check via `integrity_service.check_track_drift()`

#### [NEW] `apps/api/routers/commits.py`
- `POST /commits/` — CLI ingest; **auth via `team_code` + `event_code` body (no JWT)**; calls Groq summarise; inserts into `commit_logs`; uses `sender_id` for the notification row
- `GET /commits/team/{team_id}` **[JWT]**

#### [NEW] `apps/api/routers/scores.py`
- `POST /scores/` — judge submit/update; `ON CONFLICT (judge_id, team_id, round) DO UPDATE`
- `GET /scores/event/{event_id}` — aggregated (organizer/judge)
- `POST /scores/ai-suggest/{team_id}?round=N` — fetches `judging_rounds` JSONB, extracts `criteria`, calls Groq

#### [NEW] `apps/api/routers/notifications.py`
- `POST /notifications/broadcast` — organizer inserts `type='broadcast'`; `sender_id=organizer.id`
- `GET /notifications/event/{event_id}`

#### [NEW] `apps/api/routers/users.py`
- `POST /users/resume` — multipart PDF upload → extract → Groq → update `mentor_profiles`/`judge_profiles`

#### [NEW] `apps/api/main.py`
FastAPI app with CORS (`allow_origins` driven by `settings.frontend_url` from env — **not hardcoded**), all routers registered (including `integrity`), `/health` endpoint. Version `1.5.0`.

---

### Phase 2 — Next.js 14 Frontend (`apps/web/`)

#### [NEW] `apps/web/app/globals.css`
Full CSS variable palette, Inter font, animation keyframes (`hb-pulse`, `notif-in`, `page-in`), helper classes.

> [!IMPORTANT]
> **Dark-only. No light mode.** Page background is `#090B14`. No color mode toggle anywhere.

#### UI Component Library — `apps/web/components/ui/`

| File | Description |
|---|---|
| `Button.tsx` | Variants: `primary`, `secondary`, `ghost`, `danger`, `mentor-request` (amber only) |
| `Badge.tsx` | Variants: `indigo`, `cyan`, `amber`, `green`, `red` |
| `LiveDot.tsx` | 6×6px green circle, `animate-hb-pulse` |
| `Card.tsx` | Variants: `base`, `elevated`, `danger` (red left border), `ai` (indigo-dim, italic) |
| `Input.tsx` + `Select.tsx` | surface3 bg, border2, focus border becomes hb-indigo |
| `NotificationCard.tsx` | Variants: `broadcast` (cyan border), `mentor-ping` (amber border), `ai` (indigo border) |
| `StatCard.tsx` | 10px label → 20px value → 10px sub-label |
| `ScoreBar.tsx` | indigo→cyan gradient fill — **the only gradient in the app** |
| `CLIBlock.tsx` | `#050710` bg, monospace, indigo `$` prefix |
| `CommitFeedItem.tsx` | Hash chip + message + AI summary |
| `MentorCard.tsx` | Avatar + name + match% + expertise tags + `MentorRequestButton` |
| `Timeline.tsx` | Done=green dot, active=cyan dot with glow, pending=transparent dot |
| `RiskFlagRow.tsx` | Team name + evidence + risk Badge (red/amber/green) |

#### Dashboard-Level Components — `apps/web/components/dashboard/`

| File | Description |
|---|---|
| `NavBar.tsx` | 48px, `hb-surface`, wordmark + event code badge + role badge + LiveDot |
| `NotificationFeed.tsx` | Prepend with `animate-notif-in`, trim to 50, mobile slide-out drawer |
| `MentorRequestButton.tsx` | Amber idle → spinner loading → green toast → disabled cooldown countdown |

#### Auth Pages
- **`/login`** — centred card, email + password + sign-in primary button
- **`/signup`** — name + email + password + role select + `selected_track` select (required for participants) + create account button

#### Role Dashboards

**`/dashboard/organizer`** layout: `[Stat][Stat][Stat]` → Broadcast → Integrity Watchlist → Matching Optimization → `[Mentor stats | Submission tracking]` → Final placement → Leaderboard
- **Integrity Watchlist** *(NEW v1.5)*: Two sub-tabs — *Plagiarism* (`RiskFlagRow` list + Silence button per row) and *Track Drift* (table with `alignment_score` + `alignment_rationale` + Silence button). "Run Integrity Sweep" button on judging rounds panel calls `POST /plagiarism/sweep/event/{event_id}`
- **Matching Optimization panel** *(NEW v1.5)*: Pending `match_suggestions` as side-by-side cards (current vs suggested, AI rationale, score delta). "Approve Swap" primary + "Keep Current" ghost per suggestion. "Run Matching Scan" button calls `POST /mentor-match/event/{event_id}/run-all`

**`/dashboard/participant`** — Team info + Timeline + GitHub repo + Mentor card + CLI setup block

**`/dashboard/mentor`** — Stat row + Pings + Commit feed (centrepiece) + Teams list + Notification feed

**`/dashboard/judge`** — Round indicator + Team queue (each row shows plagiarism risk badge; judges do NOT see track-drift flags) + Scoring panel + Notification feed

#### `apps/web/lib/api.ts` **(Gap fix #13)**
Typed fetch wrapper — built before any dashboard page:
- Auto-injects `Authorization: Bearer <session_token>` on every request
- Reads `baseUrl` from `NEXT_PUBLIC_API_URL`
- Centralizes error parsing for all FastAPI responses

#### Realtime Hooks
- `useNotifications.ts` — `postgres_changes` on `notifications`; filters broadcast + mentor pings for current user
- `useCommitFeed.ts` — `postgres_changes` on `commit_logs` for mentor's assigned teams

---

### CLI Publishing Process

1. `npm login` at npmjs.com
2. `cd packages/cli && npm run build`
3. `npm pack --dry-run` — verify no secrets leaked
4. `npm publish --access public`
5. Teams install with `npx hackbridge-cli init <TEAM_CODE>`

---

### Phase 3 — CLI Tool (`packages/cli/`)

Commands registered in `src/index.ts`: `init`, `status`, `analyse`, `changes`, `stats`, `activity`, `ping`, `timeline`, `checklist`, `submit` (10 total — unchanged from v1.4).

All command logic unchanged from v1.4. The `status` command now also displays `match_status` and `selected_track` from the updated `/teams/{team_id}/status` response.

**`init` command `.gitignore` automation (Gap fix #12):** After writing `.hackbridge/state.json`, the CLI automatically appends `.hackbridge/state.json` to the project's `.gitignore` if not already present. This keeps local dev state out of git without requiring manual steps.

---

## Design System Summary

| Color | Role | Never use for |
|---|---|---|
| Indigo `#4F62D8` | Primary brand, AI content, active states | Warnings, mentor, status |
| Cyan `#38BDF8` | Live data, active round | Primary actions |
| Amber `#E8A020` | **Mentor interactions ONLY** | Anything non-mentor |
| Green `#22C55E` | Clean risk, success, live dot | Primary actions |
| Red `#F04C4C` | High risk, destructive actions | General warnings |

**The amber rule is absolute.** All colors via `var(--hb-*)` — never hardcode hex values.

---

## Verification Plan

### Backend
- `uvicorn main:app --reload` → hit `GET /health` → `{ "status": "ok" }`
- Test all endpoints via Swagger `/docs` with different role JWTs

### Frontend
- Sign up as each role → verify redirect to correct dashboard
- Submit GitHub repo URL → verify fingerprint + Stage 1 match appears within 15s
- Send broadcast → verify appears on all dashboards in real time
- Test mentor ping: cooldown, rate limit, mentor notification card

### CLI
- `init <TEAM_CODE>` → verify `.hackbridge/config.json` + `state.json` + hook written
- Commit → verify appears in mentor dashboard within ~2 seconds
- Test all 10 commands for correct output

### Plagiarism & Integrity Engine (v1.5)
- Repo with pre-event commits → `POST /plagiarism/analyse/{team_id}` → verify `flag_type='plagiarism'`, correct `risk_level`, all three evidence objects
- Simulate velocity anomaly (large commit after idle) → verify `HIGH` from anomaly signal
- `POST /plagiarism/sweep/event/{event_id}` → verify all teams processed + idle warnings sent
- Repo mismatching `selected_track` → `POST /integrity/track-drift/{team_id}` → verify `flag_type='track_deviation'`, `alignment_score < 60`
- Verify track-drift flags visible to organizer only (not judge, not participant) via RLS

### Smart Matching (v1.5)
- Empty repo + `selected_track` → Stage 1 match → verify `match_status='track_matched'`
- Push code → `run-all` → improvement ≥ 20 pts → verify `match_suggestions` row created (not auto-assigned)
- Approve suggestion → verify `mentor_id` updated + both mentors notified
- Reject suggestion → verify `mentor_id` unchanged
- Change `selected_track` after `events.start_time` → verify 403

---

## Build Order

### Backend + DB (Phase 1)
```
1.  SQL 01–05 in Supabase SQL editor (in order)
2.  FastAPI: core/config.py + supabase_client.py + dependencies.py
3.  FastAPI: services/groq_service.py          ← add check_track_alignment() (v1.5)
4.  FastAPI: services/github_service.py
5.  FastAPI: services/plagiarism_service.py    ← add velocity anomaly signal (v1.5)
6.  FastAPI: services/integrity_service.py     ← NEW v1.5
7.  FastAPI: services/matching_service.py      ← NEW v1.5
8.  FastAPI: services/pdf_service.py
9.  FastAPI: models/schemas.py
10. FastAPI routers: events → teams → mentor_match → plagiarism → integrity → commits → scores → notifications → users
11. FastAPI: main.py (wire all routers + CORS)
```

### Frontend — Foundation First (Phase 2)
```
12. globals.css + tailwind.config.ts
13. lib/supabase/client.ts + lib/supabase/server.ts + lib/api.ts   ← api.ts FIRST
14. All ui/ components (Button → Badge → LiveDot → Card → Input → Select →
    NotificationCard → StatCard → ScoreBar → CLIBlock → CommitFeedItem →
    MentorCard → Timeline → RiskFlagRow)
15. dashboard/NavBar.tsx + NotificationFeed.tsx + MentorRequestButton.tsx
16. (auth)/login/page.tsx + signup/page.tsx
17. dashboard/organizer/page.tsx  ← Integrity Watchlist + Matching Optimization (v1.5)
18. dashboard/participant/page.tsx
19. dashboard/mentor/page.tsx
20. dashboard/judge/page.tsx      ← plagiarism risk badge in team queue (v1.5)
```

### CLI (Phase 3)
```
21. package.json + tsconfig.json
22. src/index.ts (all 10 commands registered)
23. src/commands/init.ts + scanner/filesystem.ts + hooks/post-commit.ts
     ↳ init.ts: auto-append .hackbridge/state.json to .gitignore
24. src/commands/status.ts (display match_status + selected_track)
25. src/commands/analyse.ts, changes.ts, stats.ts, activity.ts
26. src/commands/ping.ts, timeline.ts, checklist.ts, submit.ts
27. Build + npm publish
```

---

## Confirmed Decisions (v1.5)

| Question | Decision |
|---|---|
| Mentor ping rate limit | **10 minutes.** Enforced server-side. Implementation plan is authoritative — Blueprint's "5 min" is superseded. |
| `notifications.sender_id` | Column renamed from `organizer_id` to `sender_id` to support pings (participant), warnings (system), and broadcasts (organizer). |
| When does initial matching run? | At repo submission (Stage 1: track-based). Re-runs 30 min before Round 1 (Stage 2: code-based). Organizer can trigger on-demand at any time. |
| Stage 2 trigger mechanism | FastAPI background task or Supabase Edge Function monitors `judging_rounds[0].start_time` and calls `run-all` 30 min prior. Manual button is fallback. |
| Can teams change their track? | **No.** `events.start_time` triggers `track_locked=true` (set by `auto_event_start` sweep). Backend rejects any further changes with 403. |
| Match swap threshold | Only when `suggested_match_score >= current_match_score + 20`. Organizer must explicitly approve all swaps. |
| Track drift flag threshold | Groq `alignment_score < 60/100`. Score ≥ 60 = aligned, no flag. |
| Who sees track-drift flags? | **Organizer only.** Judges see plagiarism risk badges only. Participants see neither flag type. |
| Plagiarism sweep timing | Auto at event start, auto 5 min before each judging round, manual organizer trigger at any time. |
| Idle warning threshold | Teams with 0 commits during the event window at sweep time receive `idle_warning` notification. Informational only — no automatic penalty. |
| Scan + commits endpoint auth | `team_code` + `team_id` path match (no Bearer token). All other endpoints require JWT. |
| Groq failure policy | 3 retries with exponential backoff. Stage 1 match preserved if Stage 2 fails. Failed integrity checks do not raise flags — recorded in sweep summary only. |
| CORS config | Driven by `settings.frontend_url` env var — never hardcoded in `main.py`. |
| `lib/api.ts` | Must be created before any dashboard page. Centralizes JWT injection + base URL config. |
| CLI `.gitignore` automation | `init` command auto-appends `.hackbridge/state.json` to `.gitignore`. |

*End of Antigravity Implementation Plan — HackBridge v1.5*
