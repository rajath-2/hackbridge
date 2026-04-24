"use client"

import { NavBar } from "@/components/dashboard/NavBar"
import { NotificationFeed } from "@/components/dashboard/NotificationFeed"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScoreBar } from "@/components/ui/ScoreBar"

export default function JudgeDashboard() {
  const mockTeams = [
    { id: "1", name: "ByteForce", status: "Scoring now" },
    { id: "2", name: "CodeTitans", status: "Pending" },
    { id: "3", name: "SyntaxError", status: "Flagged" }
  ];

  return (
    <div className="min-h-screen dashboard-root">
      <NavBar eventCode="HACK26" role="judge" />
      
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        
        {/* Round Indicator */}
        <div className="flex items-center justify-between bg-[var(--hb-surface2)] border border-[var(--hb-border)] rounded-[8px] p-3 px-4 mb-6">
          <div className="flex items-center gap-3">
            <Badge variant="cyan">Round 2</Badge>
            <span className="text-[13px] font-medium text-[var(--hb-text)]">Technical Execution</span>
          </div>
          <div className="text-[12px] font-mono text-[var(--hb-cyan)]">00:45:12 remaining</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Team Queue - 30% */}
          <div className="flex flex-col gap-2">
            <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-1">
              Team Queue
            </div>
            <div className="flex flex-col gap-1.5">
              {mockTeams.map(team => (
                <div 
                  key={team.id} 
                  className={`px-3 py-2 border rounded-[6px] cursor-pointer flex justify-between items-center ${
                    team.status === "Scoring now" 
                      ? "bg-[rgba(79,98,216,0.1)] border-[var(--hb-indigo-glow)]" 
                      : "bg-[var(--hb-surface2)] border-[var(--hb-border)] hover:border-[var(--hb-border2)]"
                  }`}
                >
                  <span className={`text-[12px] font-medium ${team.status === "Scoring now" ? "text-[var(--hb-text)]" : "text-[var(--hb-muted)]"}`}>
                    {team.name}
                  </span>
                  {team.status === "Scoring now" && <Badge variant="indigo">Active</Badge>}
                  {team.status === "Flagged" && <Badge variant="amber">Flagged</Badge>}
                </div>
              ))}
            </div>
          </div>

          {/* Scoring Panel - 70% */}
          <div className="lg:col-span-2 flex flex-col gap-2">
            <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-1">
              Scoring Panel - ByteForce
            </div>
            
            <Card variant="base" className="flex flex-col gap-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-[16px] font-semibold text-[var(--hb-text)]">AI Evaluation</h2>
                  <p className="text-[11px] text-[var(--hb-muted)]">Based on repo fingerprint and commit history</p>
                </div>
                <Badge variant="indigo">Groq · llama3-70b</Badge>
              </div>

              <div>
                <ScoreBar criterion="Code Quality" score={8.5} />
                <ScoreBar criterion="Complexity" score={9.0} />
                <ScoreBar criterion="Completion" score={7.0} />
              </div>

              <Card variant="ai">
                "The team demonstrated excellent use of advanced React patterns and implemented a custom Web3 wallet connector. However, testing coverage is minimal."
              </Card>

              <div className="pt-4 border-t border-[var(--hb-border)]">
                <Button variant="primary" className="w-full">Submit Round 2 Scores</Button>
              </div>
            </Card>
          </div>

        </div>

        {/* Notification Feed */}
        <section>
          <NotificationFeed notifications={[]} />
        </section>

      </main>
    </div>
  )
}
