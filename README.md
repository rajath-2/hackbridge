# HackBridge 🌉

**HackBridge** is a real-time, AI-powered hackathon intelligence platform designed to streamline event management, participant tracking, and judging.

Built for **Version 1.5**, this platform automates the most time-consuming aspects of running a hackathon, including **Mentor Matching**, **Plagiarism Detection**, **Track Integrity Checking**, and **Live Scoring**.

---

## 🚀 Features

### 🔍 1. Real-Time Repository Intelligence & Integrity
*   **Triple-Signal Plagiarism Engine**: Uses Git commit timestamps, local filesystem scans (via the CLI), and commit velocity anomaly detection to automatically flag suspicious code (e.g., pre-written code pushed during the event).
*   **Track Drift Detection**: Uses Groq AI to analyze a team's codebase fingerprint and ensure it aligns with their registered track (e.g., flagging if a team registered for "Web3" is building an "AI" app).
*   **Live Commit Feed**: Code changes pushed by participants are streamed in real-time to mentors via Supabase Realtime.

### 🤝 2. Smart Multi-Stage Mentor Matching
*   **AI-Driven Assignment**: Automatically pairs teams with the best mentor based on a Groq-powered fingerprint of the team's repository and the mentor's uploaded PDF resume.
*   **Match Optimization Panel**: Suggests better mentor swaps dynamically if a team's tech stack changes significantly during the hackathon.
*   **Live Mentor Pings**: Teams can request help with a click, triggering a strict, server-enforced rate-limited ping to their mentor.

### ⚖️ 3. Automated Judging & Scoring
*   **AI-Suggested Scores**: Judges receive pre-calculated AI suggestions against the specific rubric criteria for the current round, based on code complexity and completion.
*   **Progressive Sweeps**: Automated integrity sweeps run 5 minutes before every judging round to ensure no late rule-breaking goes unnoticed.

### 👥 4. Role-Based Dashboards
*   **Organizer**: Full control over matching, broadcast notifications, final placements, and the Integrity Watchlist.
*   **Participant**: Event timeline, CLI setup instructions, mentor assignment details, and repo scanner.
*   **Mentor**: Live commit feeds of assigned teams and an incoming ping queue.
*   **Judge**: Real-time team scoring queue with AI evaluation suggestions.

---

## 🏗️ Architecture & Tech Stack

This project is built as a monorepo containing three main components:

1.  **Frontend (`apps/web/`)**: Next.js 14 App Router, TypeScript, Tailwind CSS (v4 Dark-Only design system).
2.  **Backend (`apps/api/`)**: FastAPI (Python), utilizing Groq (`llama3-70b`) for AI analysis and `opendataloader-pdf` for resume parsing.
3.  **CLI Tool (`packages/cli/`)**: A Node.js CLI tool (`hackbridge-cli`) used by participants to initialize their environment, perform local filesystem scans, and install git `post-commit` hooks.
4.  **Database**: Supabase (PostgreSQL, Auth, Realtime).

---

## 🛠️ Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   Python (v3.11+)
*   Java 11+ (Required for `opendataloader-pdf` on the backend)
*   A [Supabase](https://supabase.com/) Account & Project
*   A [Groq](https://groq.com/) API Key

### 1. Database Setup
1. Open your Supabase project's SQL Editor.
2. Execute the scripts in the `sql/` directory **in exact order**:
   *   `01_schema.sql`
   *   `02_indexes.sql`
   *   `03_rls.sql`
   *   `04_auth_trigger.sql`
   *   `05_realtime.sql`

### 2. Backend Setup
```bash
cd apps/api
# Create a virtual environment (optional but recommended)
python -m venv .venv
source .venv/bin/activate  # Or .venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Create environment variables
echo "SUPABASE_URL=your_supabase_url" > .env
echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key" >> .env
echo "GROQ_API_KEY=your_groq_api_key" >> .env
echo "GITHUB_TOKEN=optional_github_pat" >> .env

# Run the server
uvicorn main:app --reload
```
The API will be available at `http://127.0.0.1:8000`.

### 3. Frontend Setup
```bash
cd apps/web
npm install

# Create environment variables
echo "NEXT_PUBLIC_SUPABASE_URL=your_supabase_url" > .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key" >> .env.local
echo "NEXT_PUBLIC_API_URL=http://127.0.0.1:8000" >> .env.local

# Run the dev server
npm run dev
```
The dashboard will be available at `http://localhost:3000`.

### 4. CLI Setup
The CLI tool is located in `packages/cli/`.
```bash
cd packages/cli
npm install
npm run build
```
You can test the CLI locally by running `node dist/index.js init <TEAM_CODE>`.

---

## 📄 License
This project is proprietary and built for HackBridge intelligence services.
