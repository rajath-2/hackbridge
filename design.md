# HackBridge — Command Center Redesign
### Design Specification for Antigravity Editor

---

## 1. Design Direction

**Aesthetic**: Brutalist Mission Control — raw industrial grid meets high-stakes ops room. Think NASA flight director console crossed with a cold-war signals terminal. Every pixel earns its place. No decorative fluff; only purposeful density.

**Mood**: Serious urgency. The kind of dashboard that makes you feel the hackathon is a real operation with real stakes. Not gamified. Not friendly. Operationally precise.

**The One Unforgettable Thing**: A horizontally scrolling ticker at the very top (above the nav) that pulses live events in real time — commits, pings, flags — like a Bloomberg terminal. The dashboard should feel *alive* before the user reads a single word.

---

## 2. Color System

```css
/* Base */
--color-void:       #080A0C;   /* primary background */
--color-surface-1:  #0D1117;   /* sidebar, cards */
--color-surface-2:  #131920;   /* nested elements, input bg */
--color-border:     #1E2A35;   /* all borders */
--color-border-hot: #2A3F50;   /* hover/active borders */

/* Typography */
--color-text-primary:   #E8EDF2;
--color-text-secondary: #5A7A8A;
--color-text-muted:     #2E4A5A;
--color-text-code:      #7FBFCF;

/* Accent System — one color per signal type */
--color-signal-live:    #00FFC2;   /* teal-green — active, streaming, live */
--color-signal-warn:    #FF6B35;   /* burnt orange — integrity flags, review */
--color-signal-alert:   #FF2D55;   /* red — HIGH RISK, critical */
--color-signal-ping:    #FFB800;   /* amber — mentor pings, unacknowledged */
--color-signal-clean:   #2ECC71;   /* green — clean status */
--color-signal-info:    #3A9EBF;   /* steel blue — neutral commits, metadata */

/* Interactive */
--color-cta-bg:      #00FFC2;
--color-cta-text:    #080A0C;
--color-cta-hover:   #00E0AA;
```

---

## 3. Typography

```css
/* Display / Headers */
--font-display: 'IBM Plex Mono', monospace;
  /* Used for: COMMAND CENTER heading, stat numbers, section labels */
  /* Weight: 700 (Bold), 400 (Regular) */

/* UI Labels / Nav */
--font-ui: 'DM Mono', monospace;
  /* Used for: nav items, sidebar labels, badges, timestamps */
  /* Weight: 400, 500 */

/* Body / Descriptions */
--font-body: 'Space Mono', monospace;
  /* Used for: mentor ping text, commit messages, integrity descriptions */
  /* Weight: 400 */
```

> **Rationale**: Full monospace stack. This is a terminal-native product — variable-width fonts would undermine the operational aesthetic. All three fonts are distinct in weight and letterform despite sharing the monospace class.

### Type Scale

| Token          | Size     | Font          | Weight | Color              | Usage                         |
|----------------|----------|---------------|---------|--------------------|-------------------------------|
| `--t-display`  | 48px     | IBM Plex Mono | 700     | text-primary       | COMMAND CENTER title          |
| `--t-stat`     | 56px     | IBM Plex Mono | 700     | signal-live / alert| Stat numbers (24, 07, 183, 03)|
| `--t-section`  | 10px     | DM Mono       | 500     | text-secondary     | Section labels (letterspaced) |
| `--t-label`    | 12px     | DM Mono       | 400     | text-secondary     | Nav items, card titles        |
| `--t-body`     | 13px     | Space Mono    | 400     | text-primary       | Ping descriptions, commits    |
| `--t-micro`    | 10px     | DM Mono       | 400     | text-muted         | Timestamps, sub-labels        |
| `--t-code`     | 12px     | IBM Plex Mono | 400     | text-code          | Commit hashes, CLI bar        |

Section labels use `letter-spacing: 0.18em; text-transform: uppercase;` universally.

---

## 4. Layout Architecture

```
┌─────────────────────────────────────────────────────────┐
│  LIVE TICKER (full width, 32px, scrolling marquee)      │
├──────────┬──────────────────────────────────────────────┤
│          │  TOP NAV (64px)                              │
│          ├──────────────────────────────────────────────┤
│ SIDEBAR  │  STATUS BAR (CLI strip, 40px)                │
│ (240px)  ├──────────────────────────────────────────────┤
│          │  MAIN CONTENT AREA                           │
│          │  ┌──────────────────────────────────────┐    │
│          │  │  PAGE HEADER (breadcrumb + title)    │    │
│          │  ├──────────────────────────────────────┤    │
│          │  │  STAT ROW (4 cards, equal width)     │    │
│          │  ├────────────────┬─────────────────────┤    │
│          │  │ MENTOR PINGS   │ LIVE COMMIT FEED    │    │
│          │  │ (45% width)    │ (55% width)         │    │
│          │  ├────────────────┴─────────────────────┤    │
│          │  │  INTEGRITY WATCHLIST (full width)    │    │
│          │  └──────────────────────────────────────┘    │
│          │                                              │
│          │  BOTTOM STATUS BAR (32px, 3 tickers)         │
└──────────┴──────────────────────────────────────────────┘
```

### Grid

- Sidebar: fixed `240px`, no collapse
- Main content: fluid, `min-width: 720px`
- Main padding: `32px 40px`
- Card gap: `16px`
- Section gap: `24px`

---

## 5. Component Specifications

### 5.1 Live Ticker Bar (NEW — top of page, full width)

- Height: `32px`
- Background: `#00FFC2` (signal-live) at 8% opacity with `1px` bottom border in `signal-live` at 20% opacity
- Scrolling marquee: continuous horizontal scroll, `40s` linear loop, no pause
- Content format: `● COMMIT a3f7d1 · Team Qubit · feat: implement real-time WebSo...   ⚑ INTEGRITY FLAG · Team Qubit · HIGH RISK   ◎ PING · Team Cipher · Auth flow broken`
- Font: `DM Mono 10px`, `letter-spacing: 0.1em`, color: `signal-live`
- Items separated by `·····` (5 dot spacer)

---

### 5.2 Top Navigation

- Height: `64px`
- Background: `surface-1` with `1px` bottom border `border`
- **Logo**: `HACK` in `text-primary` + `BRIDGE` in `signal-live`, `IBM Plex Mono 18px 700`
- **Nav items**: `DM Mono 11px`, `letter-spacing: 0.12em`, uppercase
  - Default: `text-secondary`
  - Active: `text-primary` with a `2px` bottom border in `signal-live` that spans the full text width
  - Hover: `text-primary`, no border
- **LIVE badge**: `8px` pulsing dot in `signal-live` with a radial glow animation (`box-shadow` pulse, 2s infinite). Text: `LIVE` in `DM Mono 10px signal-live`
- **ORGANIZER button**: `1px` solid border in `border-hot`, `DM Mono 11px`, `text-primary`, `4px` border-radius. Hover: border becomes `signal-live`, text becomes `signal-live`

---

### 5.3 CLI Status Bar

- Height: `40px`
- Background: `surface-2`
- Top and bottom `1px` borders in `border`
- Left: `$ hackbridge status --event=HackMIT-2025` — `IBM Plex Mono 12px`, `text-code`
- Center: `HackMIT-2025` pill — `1px` solid `signal-live`, `DM Mono 11px signal-live`, `px:10 py:3`, `3px` border-radius
- Right: `Stage 2 matching · 6h 42m remaining` — `DM Mono 11px text-secondary`
- A blinking cursor `▋` appended to the command text, `signal-live`, 1s blink

---

### 5.4 Sidebar

- Width: `240px`
- Background: `surface-1`
- Right border: `1px solid border`
- Section labels (`CONTROL`, `SUPPORT`): `DM Mono 9px text-muted letter-spacing:0.2em`, `padding: 20px 24px 8px`

**Sidebar Items**:
- Height: `40px`, `padding: 0 24px`
- Default: `text-secondary`, no background
- Active: `text-primary`, left `3px` border in `signal-live`, background `rgba(0,255,194,0.04)`
- Hover: `text-primary`, background `rgba(255,255,255,0.03)`

**Badges** (numbers on Teams, Integrity, Mentor Pings):
- `DM Mono 10px`, `px:6 py:2`, `3px` border-radius
- Teams badge: `surface-2` bg, `text-secondary` text
- Integrity badge (3): `signal-alert` bg at 15%, `signal-alert` text, `1px` border `signal-alert` at 40%
- Mentor Pings badge (7): `signal-ping` bg at 15%, `signal-ping` text

**Broadcast Button**:
- Full width minus `24px` margin each side
- `signal-live` background, `void` text
- `IBM Plex Mono 12px 700`, `letter-spacing: 0.08em`, uppercase
- `4px` border-radius, `height: 36px`
- Hover: slight brightness increase + `1px` box-shadow glow `rgba(0,255,194,0.4)`

---

### 5.5 Page Header

```
// ORGANIZER · OVERVIEW          ← DM Mono 10px, text-muted, letter-spacing 0.18em
COMMAND CENTER                   ← IBM Plex Mono 48px 700, text-primary
HackMIT-2025 · 24 teams · Stage 2 AI matching running  ← Space Mono 13px, text-secondary
```

A very subtle `1px` horizontal rule below the subtitle, `border` color, `margin-bottom: 32px`.

---

### 5.6 Stat Cards (Row of 4)

**Container**: `display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;`

**Each Card**:
- Background: `surface-1`
- Border: `1px solid border`
- Border-radius: `4px`
- Padding: `20px 24px`
- On hover: border becomes `border-hot`, transition `0.15s`

**Card Anatomy**:
```
ACTIVE TEAMS          ← DM Mono 9px text-muted letter-spacing:0.18em
24                    ← IBM Plex Mono 56px 700, signal-live (or alert for flags)
^ 2 joined recently   ← Space Mono 11px, text-secondary
```

**Color rules for the big number**:
- Active Teams: `signal-live`
- Mentor Pings: `signal-ping`
- Commits Today: `text-primary`
- Integrity Flags: `signal-alert` — this card also gets a `1px` top border in `signal-alert`

---

### 5.7 Mentor Pings Panel

**Header**:
- `MENTOR PINGS` — `DM Mono 10px text-secondary letter-spacing:0.18em`
- `View all →` — `DM Mono 10px signal-live`, hover underline

**Each ping item**:
- Background: `surface-1`, `1px` bottom border `border`
- Padding: `16px 20px`
- Left accent: `3px` left border
  - Urgent (2m): `signal-alert`
  - Mid (11m): `signal-ping`
  - Older (25m+): `border-hot`
- **Status dot**: `8px` circle, matching left border color
- **Team name**: `DM Mono 12px 500 text-primary`
- **Timestamp**: `DM Mono 10px text-muted`, float right
- **Message**: `Space Mono 12px text-secondary`, `margin-top: 4px`

Hover state: background becomes `surface-2`.

---

### 5.8 Live Commit Feed Panel

**Header**:
- `LIVE COMMIT FEED` — `DM Mono 10px text-secondary letter-spacing:0.18em`
- `● STREAMING` — `8px` pulsing dot `signal-live` + `DM Mono 10px signal-live`

**Each commit row**:
- Layout: `[hash pill]  [message]  [team · time]`
- Hash pill: `IBM Plex Mono 11px`, `px:8 py:3`, `3px` border-radius
  - Unique color per team (cycle through `signal-info`, `signal-clean`, `signal-ping`, `signal-warn`)
  - Background: `15%` opacity of the pill color; border `1px` solid `40%` opacity
- Message: `Space Mono 12px text-primary`, truncated with ellipsis
- AI annotation: `Space Mono 11px text-muted`, italic-style using `letter-spacing: -0.01em`
- Team + time: `DM Mono 10px text-muted`
- `1px` bottom border `border`
- Hover: background `surface-2`, cursor `default`

New commit animation: when a new row is prepended, it slides in from top with `opacity: 0 → 1, transform: translateY(-8px) → 0` over `300ms`.

---

### 5.9 Integrity Watchlist

**Header**:
- `INTEGRITY WATCHLIST` — `DM Mono 10px text-secondary letter-spacing:0.18em`
- `Run Sweep` button: `1px solid border-hot`, `DM Mono 11px text-primary`, `px:14 py:6`, `3px` border-radius. Hover: border `signal-warn`, text `signal-warn`

**Table layout**: `grid-template-columns: 32px 180px 1fr 120px`

- Col 1: status dot (`12px` circle)
- Col 2: team name `DM Mono 12px text-primary`
- Col 3: description `Space Mono 12px text-secondary`
- Col 4: status badge (right-aligned)

**Status Badges**:
| Label     | Background                      | Text           | Border                    |
|-----------|----------------------------------|----------------|---------------------------|
| HIGH RISK | `signal-alert` at 12% opacity   | `signal-alert` | `1px solid signal-alert` at 40% |
| REVIEW    | `signal-warn` at 12% opacity    | `signal-warn`  | `1px solid signal-warn` at 40%  |
| CLEAN     | `signal-clean` at 12% opacity   | `signal-clean` | `1px solid signal-clean` at 40% |

Badge: `DM Mono 9px`, `px:8 py:4`, `3px` border-radius, `letter-spacing: 0.12em`, uppercase.

Status dot colors mirror badge signals.

Row `1px` bottom border `border`. Hover: `surface-2` background, `0.1s` transition.

---

### 5.10 Bottom Status Bar

- Height: `32px`
- Background: `surface-2`
- Top border: `1px solid border`
- Three equal-width cells, `|`-separated (using `border-right: 1px solid border`)
- Each cell: centered text, `DM Mono 10px text-muted`
- Leading `●` dot:
  - Cell 1 (Broadcast): `signal-ping`
  - Cell 2 (Mentor ping): `signal-live`
  - Cell 3 (AI Match): `signal-info`

---

## 6. Motion & Animation

```css
/* Ticker scroll */
@keyframes ticker-scroll {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.ticker-track { animation: ticker-scroll 40s linear infinite; }

/* Live pulse dot */
@keyframes pulse-ring {
  0%   { box-shadow: 0 0 0 0 rgba(0,255,194,0.5); }
  70%  { box-shadow: 0 0 0 6px rgba(0,255,194,0); }
  100% { box-shadow: 0 0 0 0 rgba(0,255,194,0); }
}
.dot-live { animation: pulse-ring 2s ease-out infinite; }

/* Cursor blink */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
.cli-cursor { animation: blink 1s step-end infinite; }

/* New commit slide-in */
@keyframes commit-in {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.commit-row-new { animation: commit-in 0.3s ease-out; }

/* Stat number count-up on page load */
/* Use a JS counter from 0 → final value over 800ms with easeOut */
```

**Global transitions**: `transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease` on all interactive elements.

---

## 7. Spacing System

```
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
```

---

## 8. Border Radius

```
--radius-sm:   3px   (badges, pills, buttons)
--radius-md:   4px   (cards, panels)
--radius-none: 0     (sidebar items, table rows)
```

No large border-radii anywhere. This is a precision instrument, not a consumer app.

---

## 9. Iconography

Use **Lucide icons** exclusively. Size: `14px` for nav/sidebar, `12px` for inline row icons.

```
Overview     → grid-2x2
Teams        → users
Integrity    → shield-alert
Scores       → bar-chart-2
Mentor Pings → message-square
Commits      → git-commit
Timeline     → clock
Broadcast    → radio
```

Icon color inherits from parent text color. No filled icons — stroke-only.

---

## 10. Responsive Behavior

| Breakpoint     | Behavior                                                     |
|----------------|--------------------------------------------------------------|
| `>= 1280px`    | Full layout as specified                                     |
| `1024–1279px`  | Sidebar collapses to `64px` icon-only rail                   |
| `768–1023px`   | Sidebar becomes off-canvas drawer; stat row 2×2 grid        |
| `< 768px`      | Not a primary target; show a "best on desktop" message       |

---

## 11. Accessibility

- All color combinations must pass WCAG AA (4.5:1 for body, 3:1 for large text)
- Focus rings: `2px solid signal-live`, `offset: 2px`, on all interactive elements
- Live regions: `role="log"` on commit feed; `aria-live="polite"` on mentor pings; `aria-live="assertive"` on integrity flags
- Ticker: `aria-hidden="true"` (decorative duplication of data shown elsewhere)

---

## 12. Implementation Notes for Antigravity

- Use CSS custom properties (vars above) declared on `:root`
- All layout via CSS Grid and Flexbox — no absolute positioning except the ticker
- The ticker is a `position: sticky; top: 0; z-index: 100` strip
- Sidebar is `position: sticky; top: 32px; height: calc(100vh - 32px)` (accounts for ticker)
- Cards and rows should use `will-change: transform` on hover-animated elements only
- Commit feed: render as a `<ul>` with `aria-label="Live commit feed"`; prepend new items to the top of the DOM list
- Stat numbers: animate with a JS count-up on mount (0 → value, 800ms, ease-out cubic)
- No external CSS frameworks — pure custom CSS against this spec
