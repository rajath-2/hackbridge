# HackBridge — Frontend Design System & Restructuring Blueprint (`design1.md`)

This document is the authoritative reference for restructuring the HackBridge frontend. It captures every design token, layout rule, component specification, and role-based page flow derived from the reference screenshot and the platform context file. All decisions are tied back to the FastAPI backend endpoints so no workflow is orphaned.

---

## 1. Design Philosophy

HackBridge is a **real-time hackathon intelligence terminal**, not a generic SaaS dashboard. The visual language must communicate:

- **Density without clutter** — information is packed but spatially logical.
- **Operational urgency** — live indicators, streaming feeds, and countdown timers create ambient tension.
- **Role clarity** — color-coded accents map to roles/states at a glance so organizers, mentors, judges, and participants never feel lost.
- **CLI affinity** — monospace elements, `$`-prefixed command blocks, and terminal-style text typing reinforce the developer audience.

---

## 2. Design Tokens (globals.css)

All tokens must be defined as CSS custom properties on `:root`. Tailwind's `theme.extend` should map to these variables.

### 2.1 Color Palette

```css
:root {
  /* Surface hierarchy */
  --hb-bg:        #090B14;  /* Global body background */
  --hb-surface:   #0F1220;  /* Base card background */
  --hb-surface2:  #161928;  /* Elevated inputs, active rows */
  --hb-surface3:  #1C2133;  /* Highest elevation — hovers, modals, badges */

  /* Borders */
  --hb-border:    rgba(255,255,255,0.06);
  --hb-border2:   rgba(255,255,255,0.10);

  /* Primary text */
  --hb-text:      #DCE0F0;
  --hb-text-dim:  #7B82A0;
  --hb-text-meta: #4E566E;

  /* Accent: Indigo — brand, AI, primary actions */
  --hb-indigo:    #3B82F6;
  --hb-indigo-mid:#2563EB;
  --hb-indigo-dim: rgba(37,99,235,0.12);

  /* Accent: Cyan — live data, secondary actions */
  --hb-cyan:      #22D3EE;
  --hb-cyan-dim:  rgba(34,211,238,0.10);

  /* Accent: Amber — MENTOR ONLY */
  --hb-amber:     #E8A020;
  --hb-amber-dim: rgba(232,160,32,0.12);

  /* Accent: Green — success, clean, live connection */
  --hb-green:     #059669;
  --hb-green-dim: rgba(5,150,105,0.12);

  /* Accent: Red — high risk, destructive */
  --hb-red:       #F04C4C;
  --hb-red-dim:   rgba(240,76,76,0.12);

  /* The one gradient — ScoreBar and progress only */
  --hb-gradient:  linear-gradient(90deg, #2563EB, #22D3EE);
}
```

### 2.2 Typography

```css
:root {
  --font-sans:  'Inter', sans-serif;
  --font-mono:  'JetBrains Mono', 'Fira Code', monospace;
}
```

**Scale (Tailwind class → px):**

| Role | Class | px |
|---|---|---|
| Page title | `text-[24px] font-bold tracking-tight uppercase` | 24 |
| Section header | `text-[13px] font-semibold tracking-widest uppercase` | 13 |
| Body / card body | `text-[12px]` | 12 |
| Meta / timestamp | `text-[10px]` | 10 |
| Micro / badge | `text-[9px] font-semibold tracking-wider uppercase` | 9 |
| Stat number | `text-[36px] font-bold tabular-nums` | 36 |
| Monospace code | `font-mono text-[11px]` | 11 |

### 2.3 Spacing & Border Radius

- Base unit: `4px` (Tailwind `p-1`).
- Cards: `rounded-md` (6px). Modals/dropdowns: `rounded-lg` (8px).
- Dividers: `border-[var(--hb-border)]`.
- Default card padding: `p-4` (16px).

### 2.4 Animations

```css
/* Pulse for LiveDot and loading states */
@keyframes hb-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
.animate-hb-pulse { animation: hb-pulse 1.6s ease-in-out infinite; }

/* Slide-up + fade-in for feed items, notifications */
@keyframes notif-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-notif-in { animation: notif-in 0.2s ease-out forwards; }

/* Page-level entrance */
@keyframes page-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-page-in { animation: page-in 0.3s ease-out forwards; }
```

---

## 3. Global Layout Shell

### 3.1 Top Navigation Bar (`NavBar.tsx`)

**Height:** 48px. **Background:** `bg-hb-bg`. **Border-bottom:** `border-[var(--hb-border)]`.

```
[ HACKBRIDGE (logo) ]   [ DASHBOARD | TEAMS | INTEGRITY | SCORES | MENTORS ]   [ ● LIVE ]  [ ORGANIZER btn ]
```

- **Logo:** "HACK" in `text-[var(--hb-text)]` + "BRIDGE" in `text-[var(--hb-indigo)]`, `font-bold text-[18px]`.
- **Nav links:** `text-[11px] tracking-wider uppercase`. Active link has `border-b-2 border-[var(--hb-indigo)]` and full-white text; inactive is `text-[var(--hb-text-dim)] hover:text-[var(--hb-text)]`.
- **LIVE indicator:** `text-[10px] uppercase tracking-widest text-[var(--hb-green)]` preceded by a `LiveDot` (green, `animate-hb-pulse`).
- **Role badge (Organizer / Judge / etc.):** Small `rounded border border-[var(--hb-border2)] bg-[var(--hb-surface3)] px-2 py-0.5 text-[10px] uppercase tracking-wider`.
- **Organizer-only:** Event Selector dropdown in the top bar. Rendered as a `select` styled with `bg-[var(--hb-surface2)] border-[var(--hb-border)] text-[var(--hb-indigo)] text-[11px] rounded px-2 py-1`.

**Backend tie:** Role comes from Supabase auth session. Event list from `GET /events/all`.

### 3.2 CLI Status Bar

**Height:** 36px. Full-width strip immediately below NavBar.

```
$ hackbridge status --event=HackMIT-2025    [ HackMIT-2025 ]   Stage 2 matching  ·  6h 42m remaining
```

- Background: `bg-[#0A0C16]`. Left section: `font-mono text-[11px] text-[var(--hb-indigo)]`.
- Event badge: `bg-[var(--hb-surface2)] border border-[var(--hb-border2)] rounded px-2 py-0.5 text-[var(--hb-indigo)] text-[10px]`.
- Status text: `text-[var(--hb-text-dim)] text-[11px]`. Countdown in white.
- This bar is universal across all roles. Backend source: `GET /events/{event_id}` for remaining time and stage.

### 3.3 Two-Column App Shell

```
┌──────────────────────────────────────────────────────────────────────┐
│ NavBar (48px)                                                        │
│ CLI Status Bar (36px)                                                │
├─────────────────────┬────────────────────────────────────────────────┤
│ Left Sidebar        │ Main Content Area                              │
│ 270px fixed         │ flex-1, overflow-y-auto, p-6                  │
│ bg-hb-bg            │ bg-hb-bg                                       │
│ border-r border-... │                                                │
└─────────────────────┴────────────────────────────────────────────────┘
│ Notification Ticker (32px, fixed bottom)                             │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.4 Left Sidebar

Role-specific navigation rendered in sections with uppercase `text-[9px] tracking-widest text-[var(--hb-text-meta)]` section labels.

**Organizer sidebar (as shown in screenshot):**

```
CONTROL
  ▣ Overview         (active — left border accent, bg-hb-surface2)
  👤 Teams           [24 badge]
  ★ Integrity        [3 badge — red]
  ↗ Scores

SUPPORT
  ☰ Mentor Pings    [7 badge — amber]
  ≡ Commits
  ⏱ Timeline

[ + Broadcast ]      (indigo filled button, full width, rounded)
```

- Active item: `bg-[var(--hb-surface2)] text-[var(--hb-text)] border-l-2 border-[var(--hb-indigo)]`.
- Inactive: `text-[var(--hb-text-dim)] hover:bg-[var(--hb-surface)] hover:text-[var(--hb-text)]`.
- Badges: `rounded-full text-[9px] px-1.5 py-0.5 font-semibold`. Red for integrity, Amber for mentor pings, `bg-[var(--hb-surface3)]` default.

**+ Broadcast button:** `bg-[var(--hb-indigo)] hover:bg-[var(--hb-indigo-mid)] text-white text-[11px] font-semibold rounded py-2 w-full`. Calls `POST /notifications/broadcast`.

### 3.5 Bottom Notification Ticker

Fixed, full-width, 32px. `bg-[#07090F] border-t border-[var(--hb-border)]`.  
Three cycling items separated by `·`, each prefixed with colored dot:

- Cyan dot: Broadcast messages
- Amber dot: Mentor pings  
- Indigo dot: AI Match updates

Source: Supabase realtime subscription on `notifications` table.

---

## 4. Reusable Component Library (`src/components/ui/`)

### 4.1 `Card` (card.tsx)

Props: `variant: 'base' | 'elevated' | 'danger' | 'ai'`

| Variant | Background | Border | Special |
|---|---|---|---|
| `base` | `var(--hb-surface2)` | `var(--hb-border)` | — |
| `elevated` | `var(--hb-surface2)` | `var(--hb-border2)` | Slightly brighter border |
| `danger` | `var(--hb-surface2)` | `var(--hb-border)` | `border-l-[3px] border-l-[var(--hb-red)]` |
| `ai` | `var(--hb-indigo-dim)` | `rgba(59,130,246,0.2)` | Text `#A5ADEE`, italicized AI output |

### 4.2 `StatCard` (stat-card.tsx)

Displays a single top-level metric. Used in the 4-up grid on the Organizer overview.

```
┌────────────────────────┐
│ LABEL (9px, meta)      │
│ VALUE (36px, bold)     │
│ delta / annotation     │  ← 10px, colored per context
└────────────────────────┘
```

- Integrity Flags value uses `text-[var(--hb-red)]`.
- Mentor Pings unacknowledged annotation: `text-[var(--hb-amber)]`.
- Commits delta: `text-[var(--hb-green)]`.

### 4.3 `LiveDot` (live-dot.tsx)

```tsx
<span className="inline-block w-2 h-2 rounded-full bg-[var(--hb-green)] animate-hb-pulse" />
```

Used next to "STREAMING" label in commit feed header and in the NavBar "LIVE" indicator.

### 4.4 `CommitFeedItem` (commit-feed-item.tsx)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [a3f7d1]  feat: implement real-time WebSo...                        │
│           AI: Major architectural change — a...     (italic, dim)   │
│           Team Qubit · 1m ago                       (meta)          │
└─────────────────────────────────────────────────────────────────────┘
```

- Hash badge: `font-mono text-[10px] bg-[var(--hb-indigo-dim)] text-[var(--hb-indigo)] rounded px-1.5 py-0.5` — color changes by team (use deterministic color from hash).
- Commit message: `text-[12px] text-[var(--hb-text)] truncate`.
- AI summary line: `text-[11px] italic text-[var(--hb-text-dim)]`.
- Meta: `text-[10px] text-[var(--hb-text-meta)]`.
- Entrance: `animate-notif-in`.
- Data source: Supabase realtime on `commit_logs` table → pre-populated via `POST /commits` from CLI git hook.

### 4.5 `RiskFlagRow` (risk-flag-row.tsx)

```
● Team Name    reason text — detail                    [ HIGH RISK | REVIEW | CLEAN ]
```

- Dot: Red for HIGH RISK, Amber for REVIEW, Green for CLEAN.
- Badge:
  - HIGH RISK: `bg-[var(--hb-red)] text-white`
  - REVIEW: `bg-[var(--hb-amber)] text-black`
  - CLEAN: `bg-[var(--hb-surface3)] text-[var(--hb-green)] border border-[var(--hb-green)]`
- On hover: "Silence" button appears (for Organizer false-positive dismissal). `text-[10px] text-[var(--hb-text-meta)] underline`.
- Data: `GET /integrity/event/{event_id}`.

### 4.6 `ScoreBar` (score-bar.tsx)

```
Criterion label          [████████████░░░░░]  score / max
```

- Track fill: `background: var(--hb-gradient)` (indigo→cyan). This is the **only** gradient in the app.
- `h-1.5 rounded-full`.
- Used exclusively in Judge scoring panel.

### 4.7 `CLIBlock` (cli-block.tsx)

```
$ hackbridge init <token>
```

- Wrapper: `bg-[#050710] rounded font-mono text-[11px] p-3`.
- `$` prefix: `text-[var(--hb-indigo)]`.
- Command text: `text-[var(--hb-text)]`.
- Optional copy-to-clipboard icon (top-right, `text-[var(--hb-text-meta)] hover:text-[var(--hb-text)]`).

### 4.8 `TextType` (text-type.tsx)

Terminal typing animation component. Renders string character-by-character with configurable delay.

```tsx
// Usage
<TextType text="hackbridge status --event=HackMIT-2025" speed={40} />
```

Used in CLI Status Bar and onboarding flows.

### 4.9 `NotificationCard` (notification-card.tsx)

```
● Team Qubit                      2m ago
  Stuck on WebSocket integration,
  need help ASAP
```

- Amber left border + dot for Mentor Pings.
- Cyan for Broadcast.
- Indigo for AI alerts.
- Data source: `GET /notifications/event/{event_id}` + Supabase realtime.

### 4.10 `ResumeUpload` (resume-upload.tsx)

Drag-and-drop zone for PDF. Used in Mentor and Judge onboarding.

- Border: `border-dashed border-2 border-[var(--hb-border2)] hover:border-[var(--hb-indigo)]`.
- On file select: calls `POST /users/resume`.
- Shows extracted expertise tags (for Mentor) or domain tags (for Judge) after upload.

### 4.11 `JudgingRoundForm` (judging-round-form.tsx)

Dynamic form for Organizers. Add/remove criteria rows, each with name + weight inputs. Validates weights sum to 100. Backend: part of `POST /events/` payload.

---

## 5. Auth Pages (`/(auth)`)

### Routes: `/login`, `/signup`

**Background:** `Cubes.tsx` — full-screen animated 3D floating geometric cubes rendered on a canvas. Cubes use `var(--hb-indigo-dim)` and `var(--hb-surface3)` fills with slight rotation animation.

**Auth Card:** `bg-[var(--hb-surface)] border border-[var(--hb-border2)] rounded-lg p-8 w-[400px]` centered on screen.

**Signup-specific:** Role selector — four pill toggles: `Participant | Mentor | Judge | Organizer`. Selected pill: `bg-[var(--hb-indigo)] text-white`. Unselected: `bg-[var(--hb-surface2)] text-[var(--hb-text-dim)]`.

**Backend:** Supabase Auth (`signUp`, `signInWithPassword`). Role stored in user metadata.

---

## 6. Role-Based Dashboard Pages

### 6.1 Organizer Dashboard (`/dashboard/organizer`)

**This is the reference design from the screenshot.**

#### Page Header
```
// ORGANIZER · OVERVIEW
COMMAND CENTER
HackMIT-2025 · 24 teams · Stage 2 AI matching running
```
- Breadcrumb: `text-[10px] tracking-widest text-[var(--hb-indigo)] uppercase`.
- Title: `text-[24px] font-bold uppercase tracking-tight`.
- Subtitle: `text-[12px] text-[var(--hb-text-dim)]`.

#### Stats Row (4 StatCards)
`grid grid-cols-4 gap-3`

| Card | Value color | Annotation |
|---|---|---|
| ACTIVE TEAMS | default | `^ 2 joined recently` (green) |
| MENTOR PINGS | default | `! 3 unacknowledged` (amber) |
| COMMITS TODAY | default | `^ +42 last hour` (green) |
| INTEGRITY FLAGS | red | `1 review required` (red) |

Backend: `GET /teams/?event_id=X` count, `GET /notifications/event/X` ping count, `GET /commits/event/X` count, `GET /integrity/event/X` flag count.

#### Main Content Grid
`grid grid-cols-[1fr_1.6fr] gap-4 mt-4`

**Left — Mentor Pings Card:**
- Header: `MENTOR PINGS` + `View all →` link (indigo).
- List of `NotificationCard` (amber) ordered by recency.
- Backend: `GET /notifications/event/{event_id}` filtered `type=mentor_ping`. Realtime via Supabase.

**Right — Live Commit Feed Card:**
- Header: `LIVE COMMIT FEED` + `● STREAMING` indicator (green `LiveDot` + `text-[10px] text-[var(--hb-green)] uppercase tracking-widest`).
- Scrollable list of `CommitFeedItem` across all teams.
- Backend: Supabase realtime on `commit_logs`, supplemented by `GET /commits/event/{event_id}` on mount.

#### Integrity Watchlist Section
Full-width card below the grid.

- Header: `INTEGRITY WATCHLIST` + `Run Sweep` button (`border border-[var(--hb-border2)] hover:bg-[var(--hb-surface3)] text-[var(--hb-text)] text-[11px] rounded px-3 py-1.5`).
- `Run Sweep` → `POST /integrity/sweep/event/{event_id}`.
- Tabbed: **Plagiarism** | **Track Drift** — Plagiarism visible to Judges and Organizers; Track Drift to Organizers only.
- List of `RiskFlagRow`.

#### Mentor Optimization Section (below Watchlist)
Cards (`variant="elevated"`) showing Current vs Suggested mentor with score delta (`+20 pts`).
- "Approve Swap" → `POST /mentor-match/suggestions/{suggestion_id}` with `action=approve`.
- "Keep Current" → same endpoint with `action=reject`.

#### Final Placement Section
Three `select` inputs: 1st / 2nd / 3rd. Teams list from `GET /teams/?event_id=X`.

---

### 6.2 Mentor Dashboard (`/dashboard/mentor`)

**Sidebar sections:** ASSIGNED TEAMS, PINGS, COMMITS.

#### Page Header
```
// MENTOR · LIVE VIEW
MENTOR CONSOLE
{N} teams assigned · {M} pings pending
```

#### Stats Row (3 StatCards)
Assigned Teams | Pending Pings (amber) | Commits Today

Backend: `GET /commits/mentor`, `GET /notifications/event/{event_id}` (mentor-filtered).

#### Main Grid: `grid-cols-[35%_65%]`

**Left — Incoming Pings:**
- List of `NotificationCard` (amber left border).
- Each card has a "Respond" action (future feature placeholder).
- Source: Supabase realtime + `GET /notifications/event/{event_id}`.

**Right — Live Commit Feed:**
- Same `CommitFeedItem` component as organizer, but filtered to assigned teams only.
- Source: `GET /commits/mentor` + Supabase realtime.

#### Bottom Grid
`grid grid-cols-3 gap-3` — one `Card variant="base"` per assigned team showing: Track tag, Tech Stack tags, Commit Count.

---

### 6.3 Judge Dashboard (`/dashboard/judge`)

**Sidebar sections:** QUEUE, SCORING, RESULTS.

#### Round Banner (full-width, top)
```
Round 2: Technical Execution                     [ 01:23:45 countdown ]
```
- `bg-[var(--hb-indigo-dim)] border border-[rgba(59,130,246,0.2)] rounded`
- Source: active round from `GET /events/{event_id}`.

#### Main Grid: `grid-cols-[30%_70%]`

**Left — Team Queue:**
- List items, each `rounded p-2`.
- Active/being-scored: `bg-[rgba(79,98,216,0.1)] border-l-2 border-[var(--hb-indigo)]`.
- Flagged teams: amber or red badge overlaid.
- Source: `GET /teams/?event_id=X`.

**Right — Scoring Panel:**

```
[ Team Name ] — [ Track ]

JUDGING CRITERIA
  Criterion 1    [ScoreBar]  score/10
  Criterion 2    [ScoreBar]  score/10
  ...

┌─────────────────────────────────────┐  ← Card variant="ai"
│ AI EVALUATION                       │
│ Groq-generated insights from repo   │
│ fingerprint...                      │
└─────────────────────────────────────┘

[ AI Suggest Score ]   [ Submit Scores ]
```

- "AI Suggest Score" → `POST /scores/ai-suggest/{team_id}`. Fills `ScoreBar` values.
- "Submit Scores" → `POST /scores/`.
- Notes textarea: `bg-[var(--hb-surface2)] border border-[var(--hb-border)] rounded p-2 text-[12px] w-full`.

---

### 6.4 Participant Dashboard (`/dashboard/participant`)

**State 1 — No Team:**

Two-pane card centered on page:

```
┌───────────────────────┬───────────────────────┐
│   JOIN A TEAM         │   CREATE A TEAM        │
│   Enter join code     │   Select Event + Track │
│   [ code input ]      │   [ Team Name ]        │
│   [ Join → ]          │   [ Create → ]         │
└───────────────────────┴───────────────────────┘
```

- Join: `POST /teams/join` with `team_code`.
- Create: `POST /teams/` with `event_id`, `track`, `name`.

**State 2 — Active Team:**

`grid grid-cols-[40%_60%] gap-4`

**Left Column:**
1. **Team Info Card** — members list, track badge, `team_code` in `CLIBlock`.
2. **Event Timeline** — vertical timeline with milestone dots.

**Right Column:**
1. **Mentor Card** — assigned mentor name + AI-extracted expertise tags (indigo pills). If unmatched: "Waiting for activity" placeholder in `text-[var(--hb-text-meta)]`.
2. **GitHub Setup Card** — URL input + "Analyse" button → `POST /teams/{team_id}/repo`. Shows repo fingerprint tags after analysis.
3. **CLI Integration Card** — `CLIBlock` with personal `cli_token`:
   ```
   $ hackbridge init <cli_token>
   ```
   Token fetched from `GET /users/me/cli-token`. Copy button included.
   Below: `TextType` animating through CLI command examples.
4. **Mentor Ping Button** — `bg-[var(--hb-amber-dim)] border border-[var(--hb-amber)] text-[var(--hb-amber)] rounded px-4 py-2 text-[12px]`. Calls `POST /teams/{team_id}/mentor-ping`.

---

## 7. Backend ↔ Frontend Endpoint Map

| Frontend Action | HTTP Call | Real-time? |
|---|---|---|
| Load event list (NavBar dropdown) | `GET /events/all` | No |
| Load active event details | `GET /events/{event_id}` | No |
| Create team | `POST /teams/` | No |
| Join team | `POST /teams/join` | No |
| Submit repo URL | `POST /teams/{team_id}/repo` | No |
| CLI scan ingest | `POST /teams/{team_id}/scan` | No |
| Mentor ping (web) | `POST /teams/{team_id}/mentor-ping` | Triggers notification |
| Commit feed | `GET /commits/team/{team_id}` | + Supabase realtime |
| Mentor commit feed | `GET /commits/mentor` | + Supabase realtime |
| CLI token | `GET /users/me/cli-token` | No |
| Resume upload | `POST /users/resume` | No |
| Run integrity sweep | `POST /integrity/sweep/event/{event_id}` | No |
| Integrity flags | Supabase realtime `integrity_flags` | Yes |
| Mentor match suggestions | `GET /mentor-match/suggestions` | No |
| Approve/reject mentor swap | `POST /mentor-match/suggestions/{id}` | No |
| AI score suggest | `POST /scores/ai-suggest/{team_id}` | No |
| Submit scores | `POST /scores/` | No |
| Broadcast message | `POST /notifications/broadcast` | Triggers realtime |
| Fetch notifications | `GET /notifications/event/{event_id}` | + Supabase realtime |

---

## 8. Real-time Architecture (Supabase)

Subscribe at the dashboard layout level. Each subscription drives component state via React context or Zustand.

```ts
// Channels to subscribe per role
const channels = {
  organizer: ['commit_logs', 'notifications', 'integrity_flags', 'mentor_match_suggestions'],
  mentor:    ['commit_logs', 'notifications'],
  judge:     ['notifications'],
  participant: ['notifications', 'mentor_assignments'],
}
```

All feed items rendered with `animate-notif-in` on insertion.

---

## 9. Page Routes Summary

```
/                         → redirect to /login
/(auth)/login             → Login page (Cubes.tsx bg)
/(auth)/signup            → Signup page (Cubes.tsx bg, role selector)
/dashboard/organizer      → Organizer Command Center
/dashboard/organizer/teams        → Full team list
/dashboard/organizer/integrity    → Full integrity watchlist (tabbed)
/dashboard/organizer/scores       → Score aggregation view
/dashboard/organizer/mentors      → Mentor match management
/dashboard/mentor         → Mentor Console
/dashboard/judge          → Judge Scoring Panel
/dashboard/participant    → Participant Dashboard
```

Route protection via Supabase session check in Next.js middleware. Role mismatch → redirect to correct role dashboard.

---

## 10. Implementation Checklist

- [ ] Set all CSS variables in `globals.css` per Section 2.1
- [ ] Configure Tailwind `theme.extend.colors` to map to CSS variables
- [ ] Import `JetBrains Mono` and `Inter` via `next/font`
- [ ] Build `Cubes.tsx` as a `<canvas>` component with Three.js or plain WebGL
- [ ] Build `TextType.tsx` with `useEffect` char-by-char interval
- [ ] Implement all components in Section 4 with prop types
- [ ] Add Supabase realtime subscriptions in dashboard layout (`layout.tsx` per role)
- [ ] Wire `useNotifications` hook to bottom ticker and `NotificationFeed`
- [ ] Protect routes in `middleware.ts` — redirect by role
- [ ] Map every button/form to the correct FastAPI endpoint per Section 7
- [ ] ScoreBar: use `var(--hb-gradient)` **only** — no other gradients elsewhere
- [ ] Amber color: used **exclusively** for mentor-related UI elements
- [ ] Integrity tab "Track Drift": hide from Judge role entirely
