# HackBridge Project Blueprint & Context

This document serves as the comprehensive blueprint for the HackBridge platform (Version 1.5), detailing the architecture, design elements, backend services, and all role-based user flows.

## 1. High-Level Architecture
HackBridge is a real-time, AI-powered hackathon intelligence platform structured as a monorepo:
- **Frontend (`apps/web/`)**: Next.js 14 App Router, TypeScript, Tailwind CSS.
- **Backend (`apps/api/`)**: FastAPI (Python 3.11+), integrating Supabase and Groq API.
- **CLI Tool (`packages/cli/`)**: Node.js command-line interface for participants.
- **Database**: Supabase PostgreSQL with Auth and Realtime capabilities.

## 2. Design System & Aesthetics
The application enforces a strict, premium visual identity to prioritize clarity and focus.

- **Theme**: Dark-only design. No light mode or color mode toggles exist. The primary background color is `#090B14`.
- **Typography**: Uses the `Inter` font exclusively.
- **Color Palette & Rules**:
  - **Indigo (`#4F62D8`)**: Primary brand color, used for AI content and active states.
  - **Cyan (`#38BDF8`)**: Used for live data and active judging rounds.
  - **Amber (`#E8A020`)**: **Absolute Rule** - Reserved *strictly* for mentor interactions (e.g., mentor request buttons, mentor pings).
  - **Green (`#22C55E`)**: Indicates a clean risk level, successful actions, or live status dots.
  - **Red (`#F04C4C`)**: Indicates high risk (plagiarism) or destructive actions.
- **Animations**: Incorporates subtle micro-animations like `hb-pulse` (for live indicators), `notif-in` (slide-in notifications), and `page-in`.
- **UI Components**:
  - **Buttons**: Variants include `primary`, `secondary`, `ghost`, `danger`, and `mentor-request` (amber).
  - **Badges**: Contextual indicators in `indigo`, `cyan`, `amber`, `green`, and `red`.
  - **LiveDot**: A 6x6px pulsing green circle to signify real-time data connections.
  - **Cards**: Variants include `base`, `elevated`, `danger` (red left border), and `ai` (indigo-dim background, italicized text).
  - **ScoreBar**: Features an indigo-to-cyan gradient fill (the *only* gradient used in the app).
  - **NotificationCards**: Color-coded borders based on type (`broadcast` = cyan, `mentor-ping` = amber, `ai` = indigo).
  - **CLIBlock**: Dark background (`#050710`), monospace font, with an indigo `$` prefix for terminal instructions.

## 3. Backend Features & Core Services

### 3.1 Integrity & Plagiarism Engine
A progressive, triple-signal engine that evaluates team codebases:
1. **Git Signal**: Analyzes pre-event commit ratios.
2. **Local Scan Signal**: Evaluates filesystem metadata (e.g., ctime/mtime anomalies) via CLI uploads.
3. **Velocity Anomaly Signal**: Detects suspicious bursts of code (e.g., >500 lines committed) following an idle period of 3+ hours.
- *Flags* are raised with `risk_level` (Clean, Medium, High).

### 3.2 Track Drift Detection
Ensures teams are building what they registered for:
- Uses Groq AI to compare a team's repository fingerprint against their `selected_track`.
- If the AI-calculated `alignment_score` drops below 60/100, a `track_deviation` flag is silently raised for organizers.

### 3.3 Smart Multi-Stage Mentor Matching
- **Stage 1 (Track-Based)**: Runs immediately upon repository submission. Uses the selected track and the README to make an initial match (`track_matched`).
- **Stage 2 (Code-Based)**: Triggered 30 minutes before Round 1 or manually by an organizer. Analyzes the full repository fingerprint against mentor resumes (parsed via PDF extraction). 
- **Match Optimization**: If the AI finds a new mentor that improves the match score by >= 20 points, it creates a `match_suggestion` pending organizer approval.

### 3.4 Automated Sweeps & Idle Detection
- Sweeps run automatically at the event start and 5 minutes before each judging round.
- **Track Locking**: The event start sweep permanently locks team tracks (`track_locked=true`), preventing late pivots.
- **Idle Warnings**: Teams with 0 commits during the event window at the time of a sweep receive an automated `idle_warning` notification.

### 3.5 AI & Integrations
- **Groq (`llama3-70b`)**: Powers repository fingerprinting, one-sentence commit summarization, track alignment checks, match scoring, AI-suggested judging scores, and resume extraction.
- **GitHub**: Fetches repository trees, READMEs, and commit history.
- **Supabase Realtime**: Streams `commit_logs` and `notifications` instantly to the frontend.

## 4. User Roles & Onboarding Flows

### 4.1 Onboarding (All Users)
- **Signup (`/signup`)**: Users provide credentials and select their role (Participant, Mentor, Judge, Organizer). Participants *must* select a `selected_track`.
- **Login (`/login`)**: Authenticates users and redirects them to their respective role-based dashboard.

### 4.2 Participant Flow
- **Dashboard (`/dashboard/participant`)**: Displays team info, event timeline, GitHub repo status, mentor assignment, and CLI instructions.
- **Setup Journey**:
  1. Create or join a team (using a 6-character `team_code`).
  2. Submit the GitHub repository URL (triggers async Stage 1 mentor matching).
  3. Run `npx hackbridge-cli init <TEAM_CODE>` in their local environment to set up git hooks and `.gitignore`.
- **Mentor Ping**: Teams can click the Amber "Request Help" button. This sends a `mentor_ping` notification to their assigned mentor. It is strictly rate-limited to once per 10 minutes (server-enforced), displaying a disabled countdown in the UI.

### 4.3 Mentor Flow
- **Dashboard (`/dashboard/mentor`)**: Features a live commit feed (centerpiece), incoming ping queue, assigned teams list, and general notifications.
- **Profile Setup**: Mentors upload a PDF resume, which the backend AI parses to extract `expertise_tags` and a `bio`.
- **Interaction**: Mentors watch the live, AI-summarized commit feed of their assigned teams and respond to incoming help requests (pings).

### 4.4 Organizer Flow
- **Dashboard (`/dashboard/organizer`)**: The command center. Contains stats, broadcast tools, Integrity Watchlist, Matching Optimization, and Leaderboards.
- **Integrity Watchlist**: 
  - *Plagiarism Tab*: Lists teams flagged by the triple-signal engine. Organizers can review evidence and "Silence" false positives.
  - *Track Drift Tab*: Lists teams deviating from their track. (Participants and Judges *cannot* see these flags).
- **Matching Optimization**: Organizers review AI-proposed `match_suggestions`. They see the current vs. suggested mentor, AI rationale, and score delta, allowing them to explicitly "Approve Swap" or "Keep Current".
- **Communication**: Organizers can send `broadcast` notifications that appear globally across all user dashboards.

### 4.5 Judge Flow
- **Dashboard (`/dashboard/judge`)**: Displays the active round, the team scoring queue, the scoring panel, and notifications.
- **Evaluation**: 
  - Judges select a team from the queue. The queue visibly displays Plagiarism Risk badges (Red/Amber/Green) to inform the judge.
  - **AI Scoring**: Judges can click "Suggest Scores" to have Groq analyze the repo against the current round's criteria, providing suggested rubric scores and rationales.
  - Judges submit their final scores and personal notes.

## 5. CLI Tool (`hackbridge-cli`)
A vital Node.js package installed locally by participants to bridge their IDE with the platform.
- **Commands**: `init`, `status`, `analyse`, `changes`, `stats`, `activity`, `ping`, `timeline`, `checklist`, `submit`.
- **Authentication**: Uses `team_code` and `event_code` in request bodies rather than JWTs, simplifying CLI usage.
- **Automation**: The `init` command automatically sets up `.hackbridge/state.json` and appends it to `.gitignore`, preventing accidental commits of local state. It also installs git `post-commit` hooks that send commit data to the platform to power the real-time mentor feeds.
