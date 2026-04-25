# HackBridge Platform: Comprehensive Context & Blueprint

This document provides an exhaustive overview of the HackBridge project, covering its architecture, design system, backend features, detailed user flows, and CLI tooling. 

## 1. High-Level Architecture
HackBridge is structured as a modern monorepo representing a real-time, AI-powered hackathon intelligence platform.
- **Frontend (`apps/web`)**: Built with Next.js 14 (App Router), TypeScript, and Tailwind CSS.
- **Backend (`apps/api`)**: Developed in FastAPI (Python 3.11+), acting as the central coordination layer.
- **CLI Tool (`packages/cli`)**: Node.js-based CLI for participant integration.
- **Database & Realtime**: Supabase (PostgreSQL) handles Auth, Database storage, and Realtime capabilities.
- **AI Integration**: Powered by Groq (`llama3-70b`) for tasks like repo fingerprinting, resume analysis, commit summarization, and mentor matching.

---

## 2. Frontend Design System & UI Components
HackBridge enforces a strict, premium visual identity focused on deep dark modes and high-contrast accents, implemented via Tailwind CSS (`globals.css`) and reusable React components (`apps/web/src/components/ui/`).

### 2.1 Theme & Colors (`globals.css`)
- **Backgrounds (Surface Hierarchy)**: 
  - `bg-hb-bg` (`#090B14`): The deepest dark for the global body background.
  - `bg-hb-surface` (`#0F1220`): Base level for standard `Card` components.
  - `bg-hb-surface2` (`#161928`): Elevated surfaces, input fields, and active rows.
  - `bg-hb-surface3` (`#1C2133`): Highest elevation, used for hovers, badges, and modals.
- **Primary Accents**:
  - **Indigo (`#2563EB` to `#3B82F6`)**: Used for primary brand elements, AI interactions (`var(--hb-indigo-dim)` backgrounds), and glowing states.
  - **Cyan (`#64748B`)**: Used for live data, secondary actions, and broadcast notifications.
  - **Amber (`#E8A020`)**: **Strict Rule** - Reserved *only* for Mentor interactions (e.g., mentor help requests, `mentor-ping` badges).
  - **Green (`#059669`)**: Indicates successful actions, "Clean" risk levels, and live `LiveDot` connections.
  - **Red (`#F04C4C`)**: High risk ("Plagiarism" flags) or destructive actions.
- **Typography**: Uses the `Inter` font (`--font-sans`). Text scales from `text-[9px]` (meta info) to `text-[24px]` (headers) to enforce a tight, dashboard-centric density. Primary text color is `#DCE0F0`.

### 2.2 Animations & Micro-interactions
- **`animate-hb-pulse`**: Modulates opacity (1.6s). Used on `LiveDot` and loading states to indicate active processing.
- **`animate-notif-in` & `animate-page-in`**: Slide-up (`translateY(-4px)` to `0`) and fade-in animations for smooth component rendering (e.g., `CommitFeedItem`).
- **`Cubes.tsx`**: An interactive, dynamic background component featuring floating 3D geometric cubes, used on the auth pages (`/login`, `/signup`) to provide a premium landing experience.
- **`TextType.tsx`**: A simulated terminal typing effect component, rendering strings character-by-character for CLI-style instructions.

### 2.3 Core UI Components (`src/components/ui/`)
- **Cards (`card.tsx`)**: Configurable via `variant`:
  - `base`: Standard container (`bg-hb-surface2`).
  - `elevated`: Adds a slightly brighter border (`var(--hb-border2)`).
  - `danger`: Features a heavy red left border (`border-l-[var(--hb-red)]`).
  - `ai`: Features an indigo-dim background, specialized border, and italicized `#A5ADEE` text.
- **Data Display**:
  - `StatCard`: Standardized widget for top-level metrics (e.g., "Active Pings", "Teams").
  - `CommitFeedItem`: Renders a single git commit with a monospaced hash, message, and AI-generated summary in italics.
  - `RiskFlagRow`: Displays a team's integrity flag alongside a Red/Amber/Green risk badge.
  - `ScoreBar`: A horizontal progress bar featuring the app's *only* gradient (indigo-to-cyan), used in judge panels for criteria scoring.
- **Interactive Elements**:
  - `CLIBlock`: A specialized dark (`#050710`) monospace code block that visually prefixes commands with an indigo `$`.
  - `JudgingRoundForm`: A complex dynamic form for organizers to add/remove judging criteria and weights.
  - `ResumeUpload`: A drag-and-drop zone specifically for Mentors and Judges to upload their PDF profiles.

---

## 3. Backend Features & API Endpoints
The backend is split into multiple highly-specialized routers (`apps/api/routers`).

### 3.1 Teams (`teams.py`)
- **Creation & Joining**: Endpoints to create (`POST /`) generating a hex `team_code`, and join (`POST /join`).
- **Repo Management**: `POST /{team_id}/repo` accepts a GitHub repo, triggers Groq for fingerprinting, and immediately initiates Stage 1 Mentor Match.
- **CLI Integrations**: 
  - `POST /{team_id}/scan`: Ingests a local filesystem scan via CLI (validates via `cli_token`).
  - `GET /{team_id}/cli/status`: Provides team status specifically for the CLI.
- **Mentor Ping**: `POST /{team_id}/mentor-ping` (and its CLI equivalent) allowing teams to request help, which logs a `mentor_ping` notification.

### 3.2 Commits (`commits.py`)
- **Ingestion**: `POST /` accepts commit data from the CLI's git post-commit hook. Validates via personal `cli_token`. Summarizes the commit via Groq AI, and logs it to `commit_logs`.
- **Retrieval**: Organizers/Mentors can fetch commits via `GET /team/{team_id}` or `GET /mentor`.

### 3.3 Users (`users.py`)
- **Resume Upload (`POST /resume`)**: Accepts a PDF, extracts text via `opendataloader-pdf`, analyzes it via Groq, and upserts to `mentor_profiles` (extracting expertise/bio) or `judge_profiles` (extracting domain).
- **CLI Token**: Endpoints to get (`GET /me/cli-token`) and validate (`POST /validate-cli-token/{token}`) a user's personal CLI token.

### 3.4 Events (`events.py`)
- **Management**: Organizers can create events (`POST /`), defining tracks and judging rounds. Users can query events (`GET /all`, `GET /{event_id}`).

### 3.5 Integrity & Plagiarism (`integrity.py`)
- **Sweeps**: `POST /sweep/event/{event_id}` triggers a manual or automated sweep (runs plagiarism and track drift checks). 
- **Flags**: Flags are generated dynamically based on:
  - **Git Signal**: Pre-event commit ratio.
  - **Local Scan**: Anomalies in filesystem.
  - **Velocity**: Bursts of commits.
  - **Track Drift**: AI comparing repo against registered track.
  - Plagiarism flags are visible to Judges; Track Drift is strictly for Organizers.

### 3.6 Mentor Match (`mentor_match.py`)
- **Matching Automation**: `POST /event/{event_id}/run-all` initiates batch matching.
- **AI Matching**: 
  - Stage 1: Track and Repo README based.
  - Stage 2: Deep code fingerprint vs. Mentor Resume matching.
- **Suggestions Review**: If AI finds a better mentor (score improvement >= 20), it creates a pending suggestion. Organizers review via `POST /suggestions/{suggestion_id}`.

### 3.7 Scores (`scores.py`)
- **Submission**: Judges submit scores and notes via `POST /`.
- **AI Suggestions**: `POST /ai-suggest/{team_id}` allows Judges to request Groq AI to propose a score based on repo fingerprint against judging criteria.

### 3.8 Notifications (`notifications.py`)
- **Broadcast**: Organizers can broadcast messages (`POST /broadcast`) globally.
- **Retrieval**: Users fetch notifications (`GET /event/{event_id}`). Feed auto-filters based on role (Mentors see broadcasts + pings).

---

## 4. Frontend User Roles & Dashboard Flows (`src/app/dashboard/`)

The application routing strictly separates users into four distinct dashboard experiences, governed by Next.js layouts and real-time Supabase hooks (`useNotifications`).

### 4.1 Onboarding & Universal Features
- **Auth Routing (`/(auth)`)**: `/login` and `/signup` routes capture credentials and mandatory role selection (`Participant`, `Mentor`, `Judge`, `Organizer`).
- **Universal Components**: Every dashboard utilizes:
  - `NavBar.tsx`: Role-specific navigation. For organizers, it includes a global Event Selector dropdown.
  - `NotificationFeed.tsx`: A fixed-position (bottom-right) or inline feed that streams real-time Supabase events. Items are color-coded: Broadcasts (Cyan), Mentor Pings (Amber), AI Alerts (Indigo).

### 4.2 Participant Dashboard (`/participant`)
- **State 1: No Team**: The user is presented with a two-pane layout to either "Join an Existing Team" (via `joinCode`) or "Create a New Team" (selecting Event and Track).
- **State 2: Active Team**:
  - **Left Column (40%)**: Displays Team Info (members, track, `team_code`), and an `Event Timeline` component.
  - **Right Column (60%)**: 
    - **Mentor Card**: Displays the assigned mentor's name and AI-extracted expertise tags. Shows a "Waiting for activity" placeholder if unmatched.
    - **GitHub Setup**: Input for the repo URL. Clicking "Analyse" triggers the `repo_fingerprint` generation.
    - **CLI Integration**: Prominently displays a `CLIBlock` with the user's *personal* `cli_token` (e.g., `hackbridge init <token>`).

### 4.3 Mentor Dashboard (`/mentor`)
- **Focus**: Real-time code observation and support.
- **Layout Grid**:
  - **Top Row**: Metrics via `StatCard` (Assigned Teams, Pending Pings, Commits Today).
  - **Left Column (35%)**: "Incoming Pings" feed rendering `NotificationCard` components (Amber) where teams have requested help.
  - **Right Column (65%)**: The centerpiece **Live Commit Feed**. A scrolling `Card` rendering `CommitFeedItem`s across all assigned teams, heavily relying on Groq AI summaries to quickly context-switch.
  - **Bottom Row**: Grid of `Card`s summarizing status (Track, Tech Stack, Commit Count) for each assigned team.

### 4.4 Organizer Dashboard (`/organizer`)
- **Focus**: Event creation, integrity sweeps, and global control.
- **Top Bar Actions**: Global Event dropdown allowing organizers to switch context or trigger "+ Create New Event" (which replaces the dashboard with a multi-step `JudgingRoundForm` wizard).
- **Integrity Watchlist**: A tabbed interface ("Plagiarism" vs "Track Drift"). Renders `RiskFlagRow` components. Organizers can hover to reveal a "Silence" button to dismiss false positives.
- **Mentor Optimization**: Renders `Card variant="elevated"` suggestions. Visually contrasts the Current Mentor vs. Suggested Mentor with score deltas (e.g., `+20 pts`), offering "Approve Swap" or "Keep Current" actions.
- **Final Placement Control**: Dedicated Select inputs to define 1st, 2nd, and 3rd place winners.

### 4.5 Judge Dashboard (`/judge`)
- **Focus**: Focused evaluation of codebases.
- **Top Indicator**: A full-width banner showing the current active judging round (e.g., "Round 2: Technical Execution") and a countdown timer.
- **Left Column (30%)**: The Team Queue. Teams currently being scored are highlighted (`bg-[rgba(79,98,216,0.1)]`); flagged teams display an Amber/Red badge to warn the judge.
- **Right Column (70%)**: The Scoring Panel. Features `ScoreBar` components for each rubric criterion. Crucially, it includes an "AI Evaluation" `Card variant="ai"` that provides Groq-generated insights based on the repo fingerprint before the judge submits their final scores.

---

## 5. CLI Tool (`hackbridge-cli`)
Located in `packages/cli`, this tool bridges the developer's local environment with the cloud.

### 5.1 Commands
- `init <cli_token>`: Validates user, performs a pre-event file scan, installs `post-commit` hooks, creates `.hackbridge/state.json`, and appends `.hackbridge` to `.gitignore`.
- `status`: Displays current matching status and team info.
- `ping`: Sends a mentor help request directly from the terminal.
- Other commands (`analyse`, `changes`, `stats`, `activity`, `timeline`, `checklist`, `submit`) handle terminal-based platform interactions.

### 5.2 Git Hook Integration
The CLI automatically installs a `.git/hooks/post-commit` hook. On every commit, this hook intercepts the `git diff` and commit message, and silently posts them to the backend (`POST /commits`), driving the real-time mentor feed and velocity analytics.
