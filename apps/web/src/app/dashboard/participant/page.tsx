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
  const [event, setEvent] = useState<any>(null)
  const [cliToken, setCliToken] = useState("")
  const [cliLinkedAt, setCliLinkedAt] = useState<string | null>(null)

  const hookNotifs = useNotifications(team?.event_id, user?.id, "participant")
  const [notifications, setNotifs] = useState<any[]>([])
  useEffect(() => {
    if (Array.isArray(hookNotifs)) setNotifs(hookNotifs)
  }, [hookNotifs])

  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) { setLoading(false); return }
        setUser(authUser)

        // Find team via team_members → teams join
        const { data: memberRow } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", authUser.id)
          .maybeSingle()

        if (!memberRow) {
          // Not in a team — load events for onboarding
          const { data: eventsData } = await supabase
            .from("events")
            .select("id, event_code, name, tracks")
            .order("created_at", { ascending: false })
          setEvents(eventsData || [])
          setLoading(false)
          return
        }

        // Fetch full team data
        const { data: teamData } = await supabase
          .from("teams")
          .select("*, events(event_code, start_time, end_time, name), team_members(user_id, users(name, email))")
          .eq("id", memberRow.team_id)
          .single()

        setTeam(teamData)
        setRepoUrl(teamData?.repo_url || "")

        // CLI token
        try {
          const { cli_token, cli_linked_at } = await api.get("/users/me/cli-token")
          setCliToken(cli_token)
          setCliLinkedAt(cli_linked_at)
        } catch (e) { console.error("CLI token fetch failed:", e) }

        // Fetch mentor if assigned
        if (teamData?.mentor_id) {
          const { data: mentorData } = await supabase
            .from("users")
            .select("*, mentor_profiles(*)")
            .eq("id", teamData.mentor_id)
            .maybeSingle()
          if (mentorData) setMentor(mentorData)
        }

        // Load event for timeline
        if (teamData?.event_id) {
          const { data: eventData } = await supabase
            .from("events")
            .select("*")
            .eq("id", teamData.event_id)
            .maybeSingle()
          setEvent(eventData)
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

  // Build timeline from real event data
  const buildTimeline = (): TimelineItem[] => {
    if (!event) return [{ status: 'pending' as const, label: 'Loading...', time: '' }]
    const now = new Date()
    const start = event.start_time ? new Date(event.start_time) : null
    const end = event.end_time ? new Date(event.end_time) : null
    const items: TimelineItem[] = []
    if (start) {
      items.push({
        status: now >= start ? 'done' as const : 'pending' as const,
        label: 'Hacking Begins',
        time: start.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      })
    }
    if (end) {
      items.push({
        status: now >= end ? 'done' as const : (now >= start! ? 'active' as const : 'pending' as const),
        label: 'Submissions Close',
        time: end.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      })
    }
    return items.length > 0 ? items : [{ status: 'pending' as const, label: 'No schedule set', time: '' }]
  }
  const timelineItems = buildTimeline()

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
        <main className="max-w-[800px] mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h1 className="text-[28px] font-bold text-[var(--hb-text)] mb-2">Welcome to HackBridge</h1>
            <p className="text-[15px] text-[var(--hb-muted)]">You’re not in a team yet. Join one or create your own to get started.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
            {/* Join Team */}
            <Card variant="elevated" className="p-8 flex flex-col">
              <h2 className="text-[20px] font-semibold text-[var(--hb-text)] mb-3">Join an Existing Team</h2>
              <p className="text-[13px] text-[var(--hb-muted)] mb-6 flex-1">Enter the team code shared by your team leader.</p>
              <div className="flex flex-col gap-4">
                <Input
                  placeholder="e.g. BYT-X4K"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  className="h-11 text-[14px] font-mono tracking-wider"
                />
                <Button variant="primary" onClick={handleJoinTeam} className="h-11 text-[14px]">Join Team</Button>
              </div>
            </Card>

            {/* Create Team */}
            <Card variant="elevated" className="p-8 flex flex-col">
              <h2 className="text-[20px] font-semibold text-[var(--hb-text)] mb-3">Create a New Team</h2>
              <p className="text-[13px] text-[var(--hb-muted)] mb-6 flex-1">Start a new project and invite others using your team code.</p>
              <div className="flex flex-col gap-4">
                <Input
                  placeholder="Team Name"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="h-11 text-[14px]"
                />
                <Select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="h-11 text-[13px]">
                  <option value="">Select Event...</option>
                  {events.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.event_code})</option>
                  ))}
                </Select>
                <Select value={selectedTrack} onChange={(e) => setSelectedTrack(e.target.value)} className="h-11 text-[13px]">
                  <option value="">Select Track...</option>
                  {(() => {
                    const selectedEvent = events.find(e => e.id === selectedEventId)
                    const tracks = selectedEvent?.tracks || []
                    return tracks.length > 0
                      ? tracks.map((t: string) => <option key={t} value={t}>{t}</option>)
                      : <option value="General">General</option>
                  })()}
                </Select>
                <Button variant="primary" onClick={handleCreateTeam} className="h-11 text-[14px]">Create Team</Button>
              </div>
            </Card>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen dashboard-root">
      <NavBar eventCode={event?.event_code || team?.events?.event_code || ""} role="participant" />

      <main className="max-w-[1200px] mx-auto px-6 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-10">

          {/* Left Column */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            <section>
              <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2 font-semibold">
                Team Info
              </div>
              <Card variant="base">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-[18px] font-bold text-[var(--hb-text)]">{team.name}</h2>
                    <p className="text-[13px] text-[var(--hb-muted)] mt-1">{team.selected_track || "No track selected"}</p>
                  </div>
                  <Badge variant="indigo" className="text-[11px]">{team.team_code}</Badge>
                </div>
              </Card>
            </section>

            <section>
              <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2 font-semibold">
                Team Members
              </div>
              <Card variant="base" className="flex flex-col gap-2">
                {team.team_members?.map((member: any) => (
                  <div key={member.user_id} className="flex items-center gap-3 py-1.5 border-b border-[var(--hb-border)] last:border-0">
                    <div className="w-7 h-7 rounded-full bg-[var(--hb-surface3)] flex items-center justify-center text-[11px] font-bold text-[var(--hb-indigo-bright)]">
                      {member.users?.name?.charAt(0) || "U"}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] text-[var(--hb-text)] font-medium">{member.users?.name || "Anonymous"}</span>
                      <span className="text-[10px] text-[var(--hb-muted)]">{member.users?.email}</span>
                    </div>
                    {member.user_id === team.leader_id && (
                      <Badge variant="indigo" className="ml-auto text-[8px] px-1.5 py-0">Leader</Badge>
                    )}
                  </div>
                ))}
              </Card>
            </section>

            <section>
              <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2 font-semibold">
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
              <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2 font-semibold">
                Assigned Mentor
              </div>
              {mentor ? (
                <MentorCard
                  teamId={team.id}
                  name={mentor.name}
                  initials={mentor.name?.split(" ").map((n: string) => n[0]).join("") || "?"}
                  matchPct={team.mentor_match_score || 0}
                  tags={mentor.mentor_profiles?.expertise_tags || []}
                />
              ) : (
                <Card variant="base" className="text-center py-8 text-[13px] text-[var(--hb-muted)] italic">
                  Waiting for mentor assignment...
                </Card>
              )}
            </section>

            <section>
              <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2 font-semibold">
                GitHub Repository
              </div>
              <Card variant="base" className="flex flex-col gap-4">
                <div className="flex gap-3">
                  <Input
                    placeholder="https://github.com/username/repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    className="h-11 text-[13px]"
                  />
                  <Button variant="secondary" onClick={handleAnalyse} disabled={loading} className="h-11 text-[13px]">
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
              <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2 flex justify-between items-center font-semibold">
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
        <section className="mb-8">
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