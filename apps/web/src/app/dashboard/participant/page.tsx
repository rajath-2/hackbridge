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
      <div className="min-h-screen flex flex-col bg-[var(--void)] font-body">
        <NavBar role="participant" />
        <main className="flex-1 flex flex-col items-center justify-center p-6 bg-[rgba(0,255,194,0.02)]">
          <div className="w-full max-w-[900px] bg-[var(--surface-1)] border border-[var(--border-hot)] rounded-[4px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="bg-[var(--surface-2)] border-b border-[var(--border-hot)] px-6 py-4 flex flex-col">
              <span className="font-ui text-[10px] text-[var(--signal-live)] uppercase tracking-[0.2em]">Deployment Sequence</span>
              <h2 className="font-display text-[24px] font-bold text-[var(--text-primary)]">NODE_AUTHENTICATION_REQUIRED</h2>
            </div>

            <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Join Team */}
              <div className="flex flex-col">
                <div className="font-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border)] pb-2 mb-6">
                  OPTION_01: JOIN_EXISTING_NODE
                </div>
                <p className="font-body text-[13px] text-[var(--text-secondary)] mb-6 flex-1 leading-relaxed">
                  Enter the unique node identifier (team code) to sync with an established squad.
                </p>
                <div className="flex flex-col gap-4">
                  <Input
                    placeholder="e.g. BYT-X4K"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="h-11 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] font-mono tracking-wider"
                  />
                  <Button variant="primary" onClick={handleJoinTeam} className="h-11 font-bold">INITIATE_SYNC</Button>
                </div>
              </div>

              {/* Create Team */}
              <div className="flex flex-col border-l border-[var(--border)] pl-10">
                <div className="font-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border)] pb-2 mb-6">
                  OPTION_02: INITIALIZE_NEW_NODE
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-ui text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Node Designation</label>
                    <Input
                      placeholder="Team Name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="h-11 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-ui text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Target Sector</label>
                    <Select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="h-11 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]">
                      <option value="">Select Event...</option>
                      {events.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.event_code})</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-ui text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Operational Track</label>
                    <Select value={selectedTrack} onChange={(e) => setSelectedTrack(e.target.value)} className="h-11 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]">
                      <option value="">Select Track...</option>
                      {(() => {
                        const selectedEvent = events.find(e => e.id === selectedEventId)
                        const tracks = selectedEvent?.tracks || []
                        return tracks.length > 0
                          ? tracks.map((t: string) => <option key={t} value={t}>{t}</option>)
                          : <option value="General">General</option>
                      })()}
                    </Select>
                  </div>
                  <Button variant="secondary" onClick={handleCreateTeam} className="h-11 font-bold">BOOT_NEW_NODE</Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const tickerContent = [
    { type: "DEPLOY", id: team.team_code, team: team.name, msg: "Node fully operational in " + (team.selected_track || "General") },
    { type: "SIGNAL", id: "0x1", team: "ADMIN", msg: "Hackathon protocol active. Monitoring commits." },
    { type: "TIMELINE", id: "INF", team: "SYSTEM", msg: "Next milestone: " + (timelineItems.find(i => i.status === 'active')?.label || "Awaiting Start") },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--void)] font-body">
      {/* Live Ticker Bar */}
      <div className="h-[32px] bg-[rgba(0,255,194,0.08)] border-b border-[rgba(0,255,194,0.2)] overflow-hidden flex items-center w-full">
        <div className="ticker-track whitespace-nowrap flex items-center">
          {[...tickerContent, ...tickerContent, ...tickerContent].map((item, i) => (
            <span key={i} className="font-ui text-[10px] text-[var(--signal-live)] uppercase tracking-[0.1em] mx-4">
              <span className="mr-2">{item.type === 'DEPLOY' ? '●' : (item.type === 'SIGNAL' ? '⚑' : '◎')}</span>
              {item.type} {item.id} · {item.team} · {item.msg}
              <span className="ml-8 opacity-30">·····</span>
            </span>
          ))}
        </div>
      </div>

      <NavBar eventCode={event?.event_code || team?.events?.event_code || ""} role="participant" />
      
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-96px)]">
        {/* Sidebar (240px) */}
        <aside className="w-[240px] flex-shrink-0 bg-[var(--surface-1)] border-r border-[var(--border)] hidden lg:flex flex-col sticky top-0 h-full overflow-y-auto">
          <div className="py-5 px-6 font-ui text-[9px] text-[var(--text-muted)] tracking-[0.2em] uppercase">Control Panel</div>
          <div className="px-6 py-2 flex items-center text-[var(--text-primary)] border-l-4 border-[var(--signal-live)] bg-[rgba(0,255,194,0.04)] font-ui text-[12px] h-[40px] cursor-pointer transition-all">
            Overview
          </div>
          <div className="px-6 py-2 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)] font-ui text-[12px] h-[40px] cursor-pointer border-l-4 border-transparent transition-all">
            Team Node
          </div>
          <div className="px-6 py-2 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)] font-ui text-[12px] h-[40px] cursor-pointer border-l-4 border-transparent transition-all">
            Mentor Link
          </div>
          
          <div className="mt-8 py-2 px-6 font-ui text-[9px] text-[var(--text-muted)] tracking-[0.2em] uppercase">Operations</div>
          <div className="px-6 py-2 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)] font-ui text-[12px] h-[40px] cursor-pointer border-l-4 border-transparent transition-all">
            Repository
          </div>
          <div className="px-6 py-2 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)] font-ui text-[12px] h-[40px] cursor-pointer border-l-4 border-transparent transition-all">
            Logs
          </div>

          <div className="mt-8 mb-4">
            <NotificationFeed
              notifications={notifications.map(n => ({
                id: n.id,
                type: n.type.replace('_', ' ').toUpperCase(),
                message: n.message,
                meta: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                variant: n.type === 'broadcast' ? 'broadcast' : (n.type === 'mentor_ping' ? 'mentor-ping' : 'ai')
              }))}
            />
          </div>

          <div className="mt-auto p-6">
             <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] p-4 flex flex-col gap-2">
                <div className="font-ui text-[9px] text-[var(--text-muted)] uppercase tracking-widest">Station ID</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--signal-live)] animate-pulse" />
                  <span className="font-ui text-[11px] text-[var(--text-primary)]">{team.team_code}</span>
                </div>
             </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-[720px] flex flex-col h-full overflow-y-auto">
          
          {/* CLI Status Bar */}
          <div className="h-[40px] flex-shrink-0 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center justify-between px-6">
            <div className="font-display text-[12px] text-[var(--text-code)]">
              $ hackbridge status --node={team.team_code} --track={team.selected_track?.toUpperCase() || "GEN"}
              <span className="cli-cursor text-[var(--signal-live)] inline-block w-[6px] h-[14px] bg-[var(--signal-live)] align-middle ml-1"></span>
            </div>
            <div className="font-ui text-[11px] text-[var(--signal-live)] border border-[var(--signal-live)] rounded-[3px] px-2.5 py-1 uppercase tracking-tight">
              {team.selected_track || "GENERAL"}
            </div>
            <div className="font-ui text-[11px] text-[var(--text-secondary)]">
              Node Sync Nominal · Latency 14ms
            </div>
          </div>

          <div className="p-[32px_40px] flex flex-col flex-1">
            {/* Page Header */}
            <div className="mb-[32px] border-b border-[var(--border)] pb-6">
              <div className="font-ui text-[10px] text-[var(--text-muted)] tracking-[0.18em] uppercase mb-1">
                PARTICIPANT · DASHBOARD
              </div>
              <h1 className="font-display text-[48px] font-bold text-[var(--text-primary)] leading-none mb-2 tracking-tight uppercase">
                {team.name}
              </h1>
              <div className="font-body text-[13px] text-[var(--text-secondary)]">
                Operational Node · {team.team_members?.length || 0} Operators Active · Sector: {event?.name || "Initializing..."}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px] mb-[24px]">
              
              {/* Left Column (Info & Timeline) - 40% */}
              <div className="lg:col-span-5 flex flex-col gap-[24px]">
                
                {/* Team Roster */}
                <div className="flex flex-col gap-2">
                   <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase mb-1">
                      Node Operator Roster
                   </div>
                   <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-4 flex flex-col gap-3">
                      {team.team_members?.map((member: any) => (
                        <div key={member.user_id} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                          <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[11px] font-bold text-[var(--signal-info)]">
                            {member.users?.name?.charAt(0) || "U"}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-ui text-[13px] text-[var(--text-primary)]">{member.users?.name || "Anonymous"}</span>
                            <span className="font-body text-[10px] text-[var(--text-muted)] uppercase">{member.users?.email}</span>
                          </div>
                          {member.user_id === team.leader_id && (
                            <span className="ml-auto font-ui text-[9px] px-1.5 py-0.5 rounded-[2px] bg-[rgba(58,158,191,0.1)] text-[var(--signal-info)] border border-[rgba(58,158,191,0.3)]">LEAD</span>
                          )}
                        </div>
                      ))}
                   </div>
                </div>

                {/* Event Timeline */}
                <div className="flex flex-col gap-2">
                   <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase mb-1">
                      Mission Timeline
                   </div>
                   <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-6">
                      <Timeline items={timelineItems} />
                   </div>
                </div>

              </div>

              {/* Right Column (Mentor & Repo) - 60% */}
              <div className="lg:col-span-7 flex flex-col gap-[24px]">
                
                {/* Mentor Panel */}
                <div className="flex flex-col gap-2">
                   <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase mb-1">
                      Assigned Mentor Specialist
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
                    <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-10 text-center">
                      <span className="font-body text-[12px] text-[var(--text-muted)] italic">Awaiting specialist assignment... Scanning mentor pool.</span>
                    </div>
                  )}
                </div>

                {/* GitHub Repository */}
                <div className="flex flex-col gap-2">
                   <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase mb-1">
                      Data Ingestion (GitHub)
                   </div>
                   <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-5 flex flex-col gap-4">
                      <div className="flex gap-3">
                        <Input
                          placeholder="https://github.com/username/repo"
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                          className="h-11 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] font-body text-[13px]"
                        />
                        <Button variant="secondary" onClick={handleAnalyse} disabled={loading} className="h-11 px-6">
                          {loading ? "SYNC..." : "ANALYSE"}
                        </Button>
                      </div>

                      {analyzed && (
                        <div className="p-4 bg-[rgba(58,158,191,0.06)] border border-[rgba(58,158,191,0.2)] rounded-[4px] font-body text-[12px] text-[var(--text-primary)] leading-relaxed">
                           <span className="text-[var(--signal-info)] mr-2 font-bold">DETECTED:</span>
                           {team?.repo_fingerprint?.primary_language} architecture with {team?.repo_fingerprint?.tech_stack?.join(", ")}.
                           {team?.mentor_match_score ? ` Optimization match: ${team.mentor_match_score}%` : ""}
                        </div>
                      )}
                   </div>
                </div>

                {/* CLI Integration */}
                <div className="flex flex-col gap-2">
                   <div className="flex justify-between items-center mb-1">
                      <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase">
                        CLI_INTEGRATION_CHANNEL
                      </div>
                      <span className="font-ui text-[9px] px-1.5 py-0.5 bg-[rgba(99,115,210,0.1)] text-[var(--signal-info)] border border-[rgba(99,115,210,0.3)] rounded-[2px]">UNIQUE_TOKEN</span>
                   </div>
                   <CLIBlock
                    prompt={`hackbridge init ${cliToken || "YOUR_PERSONAL_TOKEN"}`}
                    successMessage={cliLinkedAt ? "Personal CLI linked. Your activity will now be attributed to you." : undefined}
                  />
                  <p className="font-body text-[9px] text-[var(--text-muted)] mt-1 italic text-center uppercase tracking-tighter">
                    This cryptographic token is node-exclusive. Transmission prohibited.
                  </p>
                </div>

              </div>
            </div>


          </div>

          {/* Bottom Status Bar */}
          <div className="h-[32px] mt-auto flex-shrink-0 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center">
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center font-ui text-[10px] text-[var(--text-muted)]">
              <span className="text-[var(--signal-live)] mr-2">●</span> NODE_LINK_ESTABLISHED
            </div>
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center font-ui text-[10px] text-[var(--text-muted)]">
              <span className="text-[var(--signal-info)] mr-2">●</span> CLI_FEED_NOMINAL
            </div>
            <div className="flex-1 flex items-center justify-center font-ui text-[10px] text-[var(--text-muted)]">
              <span className="text-[var(--signal-clean)] mr-2">●</span> SECURITY_VERIFIED
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}