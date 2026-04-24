"use client"

import { useState } from "react"
import { NavBar } from "@/components/dashboard/NavBar"
import { NotificationFeed } from "@/components/dashboard/NotificationFeed"
import { Timeline, TimelineItem } from "@/components/ui/Timeline"
import { MentorCard } from "@/components/ui/MentorCard"
import { CLIBlock } from "@/components/ui/CLIBlock"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function ParticipantDashboard() {
  const [repoUrl, setRepoUrl] = useState("")
  const [analyzed, setAnalyzed] = useState(false)

  const timelineItems: TimelineItem[] = [
    { status: 'done', label: 'Hacking Begins', time: '10:00 AM' },
    { status: 'active', label: 'Check-in 1', time: '2:00 PM' },
    { status: 'pending', label: 'Check-in 2', time: '8:00 PM' },
    { status: 'pending', label: 'Submissions Close', time: '10:00 AM (Sun)' },
  ];

  const mockNotifications = [
    { id: "1", type: "broadcast", message: "Lunch is served in the main hall!", meta: "10 mins ago", variant: "broadcast" as const }
  ];

  const handleAnalyse = () => {
    setAnalyzed(true);
  };

  return (
    <div className="min-h-screen dashboard-root">
      <NavBar eventCode="HACK26" role="participant" />
      
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8">
          
          {/* Left Column - 40% */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            <section>
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2">
                Team Info
              </div>
              <Card variant="base">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-[15px] font-semibold text-[var(--hb-text)]">ByteForce</h2>
                    <p className="text-[11px] text-[var(--hb-muted)]">Web3 Track</p>
                  </div>
                  <Badge variant="indigo">T-14B9X</Badge>
                </div>
                
                <div className="flex gap-2">
                  <div className="w-[28px] h-[28px] rounded-full bg-[var(--hb-surface3)] border border-[var(--hb-border2)] flex items-center justify-center text-[10px] text-[var(--hb-muted)]">
                    RJ
                  </div>
                  <div className="w-[28px] h-[28px] rounded-full bg-[var(--hb-surface3)] border border-[var(--hb-border2)] flex items-center justify-center text-[10px] text-[var(--hb-muted)]">
                    AL
                  </div>
                </div>
              </Card>
            </section>

            <section>
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2">
                Event Timeline
              </div>
              <Card variant="base">
                <Timeline items={timelineItems} />
              </Card>
            </section>

          </div>

          {/* Right Column - 60% */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            
            <section>
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2">
                Assigned Mentor
              </div>
              <MentorCard 
                teamId="team_123"
                name="Sarah Chen"
                initials="SC"
                matchPct={94}
                tags={["React", "Web3", "Solidity"]}
              />
            </section>

            <section>
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2">
                GitHub Repository
              </div>
              <Card variant="base" className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <Input 
                    placeholder="https://github.com/username/repo" 
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                  />
                  <Button variant="secondary" onClick={handleAnalyse}>Analyse</Button>
                </div>
                
                {analyzed && (
                  <Card variant="ai">
                    Groq Analysis: Detected Next.js frontend with Hardhat smart contracts. High complexity. Domain matches Web3 track. 
                  </Card>
                )}
              </Card>
            </section>

            <section>
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2">
                CLI Integration
              </div>
              <CLIBlock 
                prompt="npx hackbridge-cli init T-14B9X"
                successMessage="CLI connected and scanning. Post-commit hook installed."
              />
            </section>

          </div>

        </div>

        {/* Full Width Footer - Notification Feed */}
        <section>
          <NotificationFeed notifications={mockNotifications} />
        </section>

      </main>
    </div>
  )
}
