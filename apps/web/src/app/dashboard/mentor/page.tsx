"use client"

import { useState, useEffect } from "react"
import { NavBar } from "@/components/dashboard/NavBar"
import { NotificationFeed } from "@/components/dashboard/NotificationFeed"
import { StatCard } from "@/components/ui/StatCard"
import { CommitFeedItem } from "@/components/ui/CommitFeedItem"
import { NotificationCard } from "@/components/ui/NotificationCard"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { useNotifications } from "@/hooks/useNotifications"

export default function MentorDashboard() {
  const [teams, setTeams] = useState<any[]>([])
  const [commits, setCommits] = useState<any[]>([])
  const [user, setUser] = useState<any>(null)
  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const notifications = useNotifications(event?.id, user?.id, "mentor")

  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        setUser(authUser)

        const events = await api.get("/events/all")
        setEvent(events.find((e: any) => e.event_code === "HACK26"))

        const teamsData = await api.get("/teams/mentor/assigned")
        setTeams(teamsData)

        const commitsData = await api.get("/commits/mentor")
        setCommits(commitsData)
      } catch (err) {
        console.error("Failed to init mentor dashboard:", err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen dashboard-root flex items-center justify-center">
        <span className="text-[14px] text-[var(--hb-muted)] animate-hb-pulse">Loading Mentor Dashboard...</span>
      </div>
    );
  }

  const pings = notifications.filter(n => n.type === "mentor_ping")

  return (
    <div className="min-h-screen dashboard-root">
      <NavBar eventCode={event?.event_code} role="mentor" />
      
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        
        {/* Stat Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard label="Assigned Teams" value={teams.length.toString()} sub="Active" />
          <StatCard label="Pending Pings" value={<span className="text-[var(--hb-amber)]">{pings.length}</span>} sub="Awaiting response" />
          <StatCard label="Commits Today" value={commits.length.toString()} sub="Across all teams" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Pings Column - 35% (approx 1 col of 3) */}
          <div className="flex flex-col gap-2">
            <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-1">
              Incoming Pings
            </div>
            {pings.map(ping => (
              <div key={ping.id} className="relative">
                <NotificationCard 
                  id={ping.id}
                  type="MENTOR PING"
                  message={ping.message}
                  meta={new Date(ping.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  variant="mentor-ping"
                />
                <Button variant="ghost" size="sm" className="absolute top-2.5 right-3 text-[10px] text-[var(--hb-amber)] hover:text-[#F0C060]">
                  View team &rarr;
                </Button>
              </div>
            ))}
            {pings.length === 0 && (
              <div className="text-[11px] text-[var(--hb-dim)] italic text-center py-4">
                No active pings
              </div>
            )}
          </div>

          {/* Commit Feed Column - 65% (approx 2 cols of 3) */}
          <div className="lg:col-span-2 flex flex-col gap-2 h-[400px]">
            <div className="flex justify-between items-end mb-1">
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em]">
                Live Commit Feed
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1">
                {teams.map(t => (
                  <Badge key={t.id} variant="indigo">{t.name}</Badge>
                ))}
              </div>
            </div>
            
            <Card variant="base" className="flex-1 overflow-y-auto">
              <div className="flex flex-col">
                {commits.map(commit => (
                  <CommitFeedItem 
                    key={commit.id} 
                    hash={commit.id.slice(0, 6)} 
                    message={commit.message} 
                    aiSummary={commit.ai_summary} 
                    teamName={commit.teams?.name}
                  />
                ))}
                {commits.length === 0 && (
                  <div className="text-[11px] text-[var(--hb-dim)] italic text-center py-10">
                    No commits detected yet
                  </div>
                )}
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
            {teams.map(team => (
              <Card key={team.id} variant="base">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[var(--hb-text)]">{team.name}</h3>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="indigo" className="text-[10px]">{team.selected_track}</Badge>
                    </div>
                  </div>
                  <Badge variant={team.risk_level === 'High' ? 'red' : 'green'}>{team.risk_level || 'Clean'}</Badge>
                </div>
                <div className="text-[11px] text-[var(--hb-muted)] mt-4">Team Code: {team.team_code}</div>
              </Card>
            ))}
          </div>
        </div>

        {/* Notification Feed */}
        <section>
          <NotificationFeed 
            notifications={notifications.map(n => ({
              id: n.id,
              type: n.type.replace('_', ' ').toUpperCase(),
              message: n.message,
              meta: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              variant: n.type === 'broadcast' ? 'broadcast' : (n.type === 'mentor_ping' ? 'mentor-ping' : 'ai')
            }))} 
          />
        </section>

      </main>
    </div>
  )
}
