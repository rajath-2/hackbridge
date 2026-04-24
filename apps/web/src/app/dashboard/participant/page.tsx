"use client"

import { useState, useEffect } from "react"
import { NavBar } from "@/components/dashboard/NavBar"
import { NotificationFeed } from "@/components/dashboard/NotificationFeed"
import { Timeline, TimelineItem } from "@/components/ui/Timeline"
import { MentorCard } from "@/components/ui/MentorCard"
import { CLIBlock } from "@/components/ui/CLIBlock"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { useNotifications } from "@/hooks/useNotifications"
import { Select } from "@/components/ui/select"
import { BroadcastToastStack } from "@/components/ui/BroadcastToastStack"

export default function ParticipantDashboard() {
  const [team, setTeam] = useState<any>(null)
  const [mentor, setMentor] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [repoUrl, setRepoUrl] = useState("")
  const [analyzed, setAnalyzed] = useState(false)
  const [loading, setLoading] = useState(true)

  // Onboarding states
  const [events, setEvents] = useState<any[]>([])
  const [joinCode, setJoinCode] = useState("")
  const [newTeamName, setNewTeamName] = useState("")
  const [selectedEventId, setSelectedEventId] = useState("")
  const [selectedTrack, setSelectedTrack] = useState("")
  const [cliToken, setCliToken] = useState("")
  const [cliLinkedAt, setCliLinkedAt] = useState<string | null>(null)

  const notifications = useNotifications(team?.event_id, user?.id, "participant")

  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        setUser(authUser)

        const teamData = await api.get("/teams/me")
        setTeam(teamData)
        setRepoUrl(teamData?.repo_url || "")

        const { cli_token, cli_linked_at } = await api.get("/users/me/cli-token")
        setCliToken(cli_token)
        setCliLinkedAt(cli_linked_at)

        if (teamData?.mentor_id) {
          const { data: mentorData } = await supabase
            .from("users")
            .select("*, mentor_profiles(*)")
            .eq("id", teamData.mentor_id)
            .single()
          setMentor(mentorData)
        }

        if (!teamData) {
          const eventsData = await api.get("/events/all")
          setEvents(eventsData)
        }
      } catch (err) {
        console.error("Failed to init dashboard:", err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const handleJoinTeam = async () => {
    if (!joinCode) return
    setLoading(true)
    try {
      await api.post("/teams/join", { team_code: joinCode })
      window.location.reload()
    } catch (err) {
      console.error("Failed to join team:", err)
      alert("Invalid team code or already in a team.")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTeam = async () => {
    if (!newTeamName || !selectedEventId || !selectedTrack) return
    setLoading(true)
    try {
      await api.post("/teams", { 
        name: newTeamName, 
        event_id: selectedEventId, 
        selected_track: selectedTrack 
      })
      window.location.reload()
    } catch (err) {
      console.error("Failed to create team:", err)
    } finally {
      setLoading(false)
    }
  }

  const timelineItems: TimelineItem[] = [
    { status: 'done', label: 'Hacking Begins', time: '10:00 AM' },
    { status: 'active', label: 'Check-in 1', time: '2:00 PM' },
    { status: 'pending', label: 'Check-in 2', time: '8:00 PM' },
    { status: 'pending', label: 'Submissions Close', time: '10:00 AM (Sun)' },
  ];

  const handleAnalyse = async () => {
    if (!team || !repoUrl) return
    setLoading(true)
    try {
      await api.post(`/teams/${team.id}/repo`, { repo_url: repoUrl })
      setAnalyzed(true)
    } catch (err) {
      console.error("Analysis failed:", err)
    } finally {
      setLoading(false)
    }
  };

  if (loading) return (
    <div className="min-h-screen dashboard-root flex items-center justify-center">
      <span className="text-[14px] text-[var(--hb-muted)] animate-hb-pulse">Loading HackBridge...</span>
    </div>
  )

  if (!team) {
    return (
      <div className="min-h-screen dashboard-root">
        <NavBar role="participant" />
        <main className="max-w-[1200px] mx-auto px-6 py-12 flex flex-col items-center">
            <h1 className="text-[24px] font-bold text-[var(--hb-text)] mb-2">Welcome to HackBridge</h1>
            <p className="text-[14px] text-[var(--hb-muted)] mb-12">You are not in a team yet. Choose an option to get started.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                {/* Join Team */}
                <Card variant="elevated" className="p-8 flex flex-col">
                    <h2 className="text-[18px] font-semibold text-[var(--hb-text)] mb-4">Join an Existing Team</h2>
                    <p className="text-[12px] text-[var(--hb-muted)] mb-6 flex-1">Enter the team code shared by your team leader to join their workspace.</p>
                    <div className="flex flex-col gap-4">
                        <Input 
                          placeholder="TEAM-CODE" 
                          value={joinCode} 
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())} 
                        />
                        <Button variant="primary" onClick={handleJoinTeam}>Join Team</Button>
                    </div>
                </Card>

                {/* Create Team */}
                <Card variant="elevated" className="p-8 flex flex-col">
                    <h2 className="text-[18px] font-semibold text-[var(--hb-text)] mb-4">Create a New Team</h2>
                    <p className="text-[12px] text-[var(--hb-muted)] mb-6 flex-1">Start a new project and invite others to join using your team code.</p>
                    <div className="flex flex-col gap-4">
                        <Input 
                          placeholder="Team Name" 
                          value={newTeamName} 
                          onChange={(e) => setNewTeamName(e.target.value)} 
                        />
                        <Select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                            <option value="">Select Event...</option>
                            {events.map(e => (
                              <option key={e.id} value={e.id}>{e.name} ({e.event_code})</option>
                            ))}
                        </Select>
                        <Select value={selectedTrack} onChange={(e) => setSelectedTrack(e.target.value)}>
                            <option value="">Select Track...</option>
                            <option value="Web3">Web3</option>
                            <option value="AI/ML">AI/ML</option>
                            <option value="Social Impact">Social Impact</option>
                            <option value="General">General</option>
                        </Select>
                        <Button variant="primary" onClick={handleCreateTeam}>Create Team</Button>
                    </div>
                </Card>
            </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen dashboard-root">
      <NavBar eventCode={team?.events?.event_code || "HACK26"} role="participant" />
      <BroadcastToastStack notifications={notifications} />
      
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
                    <h2 className="text-[15px] font-semibold text-[var(--hb-text)]">{team.name}</h2>
                    <p className="text-[11px] text-[var(--hb-muted)]">{team.selected_track || "No track selected"}</p>
                  </div>
                  <Badge variant="indigo">{team.team_code}</Badge>
                </div>
              </Card>
            </section>

            <section>
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2">
                Team Members
              </div>
              <Card variant="base" className="flex flex-col gap-2">
                {team.team_members?.map((member: any) => (
                  <div key={member.user_id} className="flex items-center gap-2 py-1 border-b border-[var(--hb-border)] last:border-0">
                    <div className="w-6 h-6 rounded-full bg-[var(--hb-surface3)] flex items-center justify-center text-[10px] font-bold text-[var(--hb-indigo-bright)]">
                      {member.users?.name?.charAt(0) || "U"}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-[var(--hb-text)] font-medium">{member.users?.name || "Anonymous"}</span>
                      <span className="text-[9px] text-[var(--hb-muted)]">{member.users?.email}</span>
                    </div>
                    {member.user_id === team.leader_id && (
                      <Badge variant="indigo" className="ml-auto text-[8px] px-1.5 py-0">Leader</Badge>
                    )}
                  </div>
                ))}
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
              {mentor ? (
                <MentorCard 
                  teamId={team.id}
                  name={mentor.name}
                  initials={mentor.name.split(" ").map((n: string) => n[0]).join("")}
                  matchPct={team.mentor_match_score || 0}
                  tags={mentor.mentor_profiles?.expertise_tags || []}
                />
              ) : (
                <Card variant="base" className="text-center py-6 text-[11px] text-[var(--hb-muted)] italic">
                  Waiting for initial activity to match...
                </Card>
              )}
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
                  <Button variant="secondary" onClick={handleAnalyse} disabled={loading}>
                    {loading ? "Analyzing..." : "Analyse"}
                  </Button>
                </div>
                
                {analyzed && (
                  <Card variant="ai">
                    Groq Analysis: Detected {team?.repo_fingerprint?.primary_language} with {team?.repo_fingerprint?.tech_stack?.join(", ")}. 
                    {team?.mentor_match_score ? ` Initial match score: ${team.mentor_match_score}%` : ""}
                  </Card>
                )}
              </Card>
            </section>

            <section>
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2 flex justify-between items-center">
                <span>CLI Integration</span>
                <Badge variant="indigo" className="text-[9px]">Personal Link</Badge>
              </div>
              <CLIBlock 
                prompt={`hackbridge init ${cliToken || "YOUR_PERSONAL_TOKEN"}`}
                successMessage={cliLinkedAt ? "Personal CLI linked. Your activity will now be attributed to you." : undefined}
              />
              <p className="text-[9px] text-[var(--hb-muted)] mt-2 italic text-center">
                This token is unique to you. Do not share it with others.
              </p>
            </section>

          </div>

        </div>

        {/* Full Width Footer - Notification Feed */}
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
