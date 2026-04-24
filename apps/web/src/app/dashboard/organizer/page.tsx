"use client"

import { useState, useEffect } from "react"
import { NavBar } from "@/components/dashboard/NavBar"
import { NotificationFeed } from "@/components/dashboard/NotificationFeed"
import { StatCard } from "@/components/ui/StatCard"
import { RiskFlagRow } from "@/components/ui/RiskFlagRow"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { api } from "@/lib/api"

interface Flag {
  id: string | number;
  teams: { name: string };
  flag_type: "plagiarism" | "track_deviation";
  risk_level?: "High" | "Medium" | "Clean";
  alignment_score?: number;
  evidence?: string;
  alignment_rationale?: string;
  silenced?: boolean;
}

interface MatchSuggestion {
  id: string;
  teams: { name: string };
  current_mentor?: { name: string };
  suggested_mentor: { name: string };
  current_match_score: number;
  suggested_match_score: number;
  rationale: string;
}

export default function OrganizerDashboard() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [activeTab, setActiveTab] = useState<"plagiarism" | "track_drift">("plagiarism");
  const [loading, setLoading] = useState(true);
  const [broadcastMsg, setBroadcastMsg] = useState("");

  const fetchData = async () => {
    setLoading(true)
    try {
      // Mocked v1.5 data for UI showcase
      setFlags([
        { id: 1, teams: { name: "ByteForce" }, flag_type: "plagiarism", risk_level: "High", evidence: "Pre-event commits ratio > 0.5", silenced: false },
        { id: 2, teams: { name: "SyntaxError" }, flag_type: "plagiarism", risk_level: "Medium", evidence: "Local scan pre-event files ratio > 0.15", silenced: false },
        { id: 3, teams: { name: "CodeTitans" }, flag_type: "track_deviation", alignment_score: 45, alignment_rationale: "Repo uses React but track is AI/ML", silenced: false }
      ]);
      setSuggestions([
        { id: "1", teams: { name: "ByteForce" }, current_mentor: { name: "Alice" }, suggested_mentor: { name: "Bob" }, current_match_score: 60, suggested_match_score: 90, rationale: "Bob has strong Web3 expertise matching the new commits." }
      ]);
    } catch (error) {
      console.error("Failed to fetch data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSweep = async () => {
    setLoading(true);
    // await api.post("/integrity/sweep/event/123", { trigger: "manual_organizer" })
    setTimeout(() => {
      fetchData();
    }, 1000);
  }

  const handleMatchScan = async () => {
    // await api.post("/mentor-match/event/123/run-all")
    console.log("Match scan triggered");
  }

  const handleSilence = (id: string | number) => {
    setFlags(flags.map(f => f.id === id ? { ...f, silenced: true } : f));
  }

  const mockNotifications = [
    { id: "1", type: "system", message: "Sweep completed", meta: "Just now", variant: "ai" as const }
  ];

  return (
    <div className="min-h-screen dashboard-root">
      <NavBar eventCode="HACK26" role="organizer" />
      
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Header Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard label="Teams" value="42" sub="8 pending setup" />
          <StatCard label="Active Pings" value={<span className="text-[var(--hb-indigo-bright)]">3</span>} sub="Mentors responding" />
          <StatCard label="Risk Flags" value={<span className="text-[var(--hb-red)]">2</span>} sub="Requiring attention" />
        </div>

        {/* Broadcast Composer */}
        <div className="mb-6 flex gap-2">
          <Input 
            placeholder="Type a broadcast message to all participants..." 
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
          />
          <Button variant="primary" onClick={() => setBroadcastMsg("")}>Send</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
          {/* Integrity Watchlist (v1.5) */}
          <div className="lg:col-span-3 flex flex-col gap-2">
            <div className="flex justify-between items-end mb-1">
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em]">
                Integrity Watchlist
              </div>
              <Button variant="secondary" size="sm" onClick={handleSweep} disabled={loading}>
                {loading ? "Sweeping..." : "Run Pre-Round Sweep"}
              </Button>
            </div>

            <div className="flex gap-2 mb-2">
              <button 
                onClick={() => setActiveTab("plagiarism")}
                className={`text-[11px] px-3 py-1 rounded-[4px] ${activeTab === "plagiarism" ? "bg-[var(--hb-surface3)] text-[var(--hb-text)]" : "text-[var(--hb-muted)] hover:text-[var(--hb-text)]"}`}
              >
                Plagiarism
              </button>
              <button 
                onClick={() => setActiveTab("track_drift")}
                className={`text-[11px] px-3 py-1 rounded-[4px] ${activeTab === "track_drift" ? "bg-[var(--hb-surface3)] text-[var(--hb-text)]" : "text-[var(--hb-muted)] hover:text-[var(--hb-text)]"}`}
              >
                Track Drift
              </button>
            </div>

            {flags.filter(f => activeTab === "plagiarism" ? f.flag_type === "plagiarism" : f.flag_type === "track_deviation").map((flag) => (
              <div key={flag.id} className="relative group">
                {flag.flag_type === "plagiarism" ? (
                  <RiskFlagRow 
                    teamName={flag.teams.name}
                    evidence={flag.evidence || ""}
                    riskLevel={flag.risk_level as "High" | "Medium" | "Clean"}
                    className={flag.silenced ? "opacity-50" : ""}
                  />
                ) : (
                  <div className={`flex items-center justify-between px-2.5 py-1.5 bg-[var(--hb-surface2)] rounded-[6px] mb-1.5 border border-[var(--hb-border)] ${flag.silenced ? "opacity-50" : ""}`}>
                    <div>
                      <div className="text-[11px] font-medium text-[var(--hb-text)]">{flag.teams.name}</div>
                      <div className="text-[10px] text-[var(--hb-muted)]">{flag.alignment_rationale}</div>
                    </div>
                    <div className="text-[11px] font-mono text-[var(--hb-amber)]">Score: {flag.alignment_score}/100</div>
                  </div>
                )}
                {!flag.silenced && (
                  <button onClick={() => handleSilence(flag.id)} className="absolute right-[-60px] top-1/2 -translate-y-1/2 text-[10px] text-[var(--hb-muted)] hover:text-[var(--hb-text)] opacity-0 group-hover:opacity-100 transition-opacity">
                    Silence
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Mentor Stats */}
          <div className="lg:col-span-2 flex flex-col gap-2">
            <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-1">
              Mentor Pings
            </div>
            <Card variant="base">
              <div className="flex justify-between items-center py-1 border-b border-[var(--hb-border)] mb-2">
                <span className="text-[11px] text-[var(--hb-text)]">Total requests today</span>
                <span className="text-[11px] text-[var(--hb-text)] font-semibold">124</span>
              </div>


              <div className="flex justify-between items-center py-1">
                <span className="text-[11px] text-[var(--hb-text)]">ByteForce</span>
                <span className="text-[11px] text-[var(--hb-muted)]">3 pings</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[11px] text-[var(--hb-text)]">CodeTitans</span>
                <span className="text-[11px] text-[var(--hb-muted)]">2 pings</span>
              </div>
            </Card>
          </div>
        </div>

        {/* Matching Optimization Panel (v1.5) */}
        <div className="mb-6">
          <div className="flex justify-between items-end mb-2">
            <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em]">
              Matching Optimization
            </div>
            <Button variant="secondary" size="sm" onClick={handleMatchScan}>
              Run Matching Scan
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestions.map(sugg => (
              <Card key={sugg.id} variant="elevated" className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] font-semibold text-[var(--hb-text)]">{sugg.teams.name}</span>
                  <div className="text-[10px] bg-[rgba(99,115,210,0.1)] text-[var(--hb-indigo-bright)] px-1.5 py-0.5 rounded">
                    +{sugg.suggested_match_score - sugg.current_match_score} pts
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
                  <div className="bg-[var(--hb-surface3)] p-2 rounded border border-[var(--hb-border)]">
                    <div className="text-[var(--hb-muted)] mb-1">Current</div>
                    <div className="text-[var(--hb-text)]">{sugg.current_mentor?.name || "None"} ({sugg.current_match_score}%)</div>
                  </div>
                  <div className="bg-[rgba(110,231,160,0.05)] p-2 rounded border border-[var(--hb-green-dim)]">
                    <div className="text-[var(--hb-muted)] mb-1">Suggested</div>
                    <div className="text-[var(--hb-green)]">{sugg.suggested_mentor.name} ({sugg.suggested_match_score}%)</div>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--hb-muted)] italic mb-2">
                  "{sugg.rationale}"
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1 text-[11px] h-7">Approve Swap</Button>
                  <Button variant="ghost" className="flex-1 text-[11px] h-7">Keep Current</Button>
                </div>
              </Card>
            ))}
            {suggestions.length === 0 && (
              <div className="col-span-2 text-center text-[11px] text-[var(--hb-muted)] py-4">
                No active matching suggestions. Run a scan to evaluate assignments.
              </div>
            )}
          </div>
        </div>

        {/* Final Placement */}
        <div className="mb-6">
          <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2">
            Final Placement
          </div>
          <Card variant="elevated" className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-[11px] text-[var(--hb-muted)] mb-1">1st Place</label>
              <Select>
                <option value="">Select team...</option>
                <option value="1">ByteForce</option>
              </Select>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] text-[var(--hb-muted)] mb-1">2nd Place</label>
              <Select>
                <option value="">Select team...</option>
                <option value="2">CodeTitans</option>
              </Select>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] text-[var(--hb-muted)] mb-1">3rd Place</label>
              <Select>
                <option value="">Select team...</option>
                <option value="3">SyntaxError</option>
              </Select>
            </div>
            <div className="pt-5">
              <Button variant="primary">Confirm Winners</Button>
            </div>
          </Card>
        </div>

      </main>

      <div className="fixed bottom-0 right-0 w-[320px] p-4 hidden lg:block">
        <NotificationFeed notifications={mockNotifications} />
      </div>
    </div>
  )
}
