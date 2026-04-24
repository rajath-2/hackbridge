"use client"

<<<<<<< Updated upstream
=======
import { useState, useEffect } from "react"
>>>>>>> Stashed changes
import { NavBar } from "@/components/dashboard/NavBar"
import { NotificationFeed } from "@/components/dashboard/NotificationFeed"
import { StatCard } from "@/components/ui/StatCard"
import { CommitFeedItem } from "@/components/ui/CommitFeedItem"
import { NotificationCard } from "@/components/ui/NotificationCard"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
<<<<<<< Updated upstream
=======
import { ResumeUpload } from "@/components/ui/ResumeUpload"
import { api } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { useNotifications } from "@/hooks/useNotifications"
>>>>>>> Stashed changes

export default function MentorDashboard() {
  const mockPings = [
    { id: "1", type: "Mentor Ping", message: "ByteForce needs your help!", meta: "2 mins ago", variant: "mentor-ping" as const }
  ];

  const mockCommits = [
    { id: "1", hash: "a1b2c3", message: "feat: implement matching algo", aiSummary: "Added Groq integration for matching service" },
    { id: "2", hash: "f4e5d6", message: "fix: resolve db constraint", aiSummary: "Fixed foreign key issue in Supabase schema" }
  ];

  return (
    <div className="min-h-screen dashboard-root">
<<<<<<< Updated upstream
      <NavBar eventCode="HACK26" role="mentor" />
      
=======
      <NavBar eventCode={event?.event_code} role="mentor" />

>>>>>>> Stashed changes
      <main className="max-w-[1200px] mx-auto px-6 py-8">

        {/* Stat Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard label="Assigned Teams" value="3" sub="Active" />
          <StatCard label="Pending Pings" value={<span className="text-[var(--hb-amber)]">1</span>} sub="Awaiting response" />
          <StatCard label="Commits Today" value="24" sub="Across all teams" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Pings Column - 35% (approx 1 col of 3) */}
          <div className="flex flex-col gap-2">
            <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-1">
              Incoming Pings
            </div>
            {mockPings.map(ping => (
              <div key={ping.id} className="relative">
<<<<<<< Updated upstream
                <NotificationCard {...ping} />
=======
                <NotificationCard
                  id={ping.id}
                  type="MENTOR PING"
                  message={ping.message}
                  meta={new Date(ping.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  variant="mentor-ping"
                />
>>>>>>> Stashed changes
                <Button variant="ghost" size="sm" className="absolute top-2.5 right-3 text-[10px] text-[var(--hb-amber)] hover:text-[#F0C060]">
                  View team &rarr;
                </Button>
              </div>
            ))}
          </div>

          {/* Commit Feed Column - 65% (approx 2 cols of 3) */}
          <div className="lg:col-span-2 flex flex-col gap-2 h-[400px]">
            <div className="flex justify-between items-end mb-1">
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em]">
                Live Commit Feed
              </div>
              <div className="flex gap-1">
                <Badge variant="indigo">ByteForce</Badge>
                <Badge variant="green" className="opacity-50">CodeTitans</Badge>
              </div>
            </div>

            <Card variant="base" className="flex-1 overflow-y-auto">
              <div className="flex flex-col">
<<<<<<< Updated upstream
                {mockCommits.map(commit => (
                  <CommitFeedItem key={commit.id} hash={commit.hash} message={commit.message} aiSummary={commit.aiSummary} />
=======
                {commits.map(commit => (
                  <CommitFeedItem
                    key={commit.id}
                    hash={commit.id.slice(0, 6)}
                    message={commit.message}
                    aiSummary={commit.ai_summary}
                    teamName={commit.teams?.name}
                  />
>>>>>>> Stashed changes
                ))}
              </div>
            </Card>
          </div>

        </div>

        {/* Teams List */}
        <div className="mb-8">
          <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2">
            Assigned Teams
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card variant="base">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--hb-text)]">ByteForce</h3>
                  <div className="flex gap-1 mt-1">
                    <span className="text-[10px] text-[var(--hb-muted)] bg-[var(--hb-surface3)] px-1.5 py-0.5 rounded">React</span>
                    <span className="text-[10px] text-[var(--hb-muted)] bg-[var(--hb-surface3)] px-1.5 py-0.5 rounded">Web3</span>
                  </div>
                </div>
                <Badge variant="green">Clean</Badge>
              </div>
              <div className="text-[11px] text-[var(--hb-muted)] mt-4">12 Commits</div>
            </Card>
          </div>
        </div>

        {/* Resume Upload */}
        <div className="mb-8 max-w-[480px]">
          <ResumeUpload role="mentor" />
        </div>

        {/* Notification Feed */}
        <section>
<<<<<<< Updated upstream
          <NotificationFeed notifications={[]} />
=======
          <NotificationFeed
            notifications={notifications.map(n => ({
              id: n.id,
              type: n.type.replace('_', ' ').toUpperCase(),
              message: n.message,
              meta: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              variant: n.type === 'broadcast' ? 'broadcast' : (n.type === 'mentor_ping' ? 'mentor-ping' : 'ai')
            }))}
          />
>>>>>>> Stashed changes
        </section>

      </main>
    </div>
  )
}
