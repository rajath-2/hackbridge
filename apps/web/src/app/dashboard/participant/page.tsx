"use client"

import { useState, useEffect } from "react"
import { NavBar } from "@/components/dashboard/NavBar"
import { NotificationFeed } from "@/components/dashboard/NotificationFeed"
import { Timeline, TimelineItem } from "@/components/ui/Timeline"
import { MentorCard } from "@/components/ui/MentorCard"
import { CLIBlock } from "@/components/ui/CLIBlock"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { useNotifications } from "@/hooks/useNotifications"
import { Select } from "@/components/ui/select"
import { StatCard } from "@/components/ui/StatCard"
import { Grid2X2, RefreshCw, Radio } from "lucide-react"

export default function ParticipantDashboard() {
  const [team, setTeam] = useState<any>(null)
  const [mentor, setMentor] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [repoUrl, setRepoUrl] = useState("")
  const [loading, setLoading] = useState(true)
  const [collabData, setCollabData] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<"overview" | "sync">("overview")
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null)

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

        const { data: memberRow } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", authUser.id)
          .maybeSingle()

        if (!memberRow) {
          const { data: eventsData } = await supabase
            .from("events")
            .select("id, event_code, name, tracks")
            .order("created_at", { ascending: false })
          setEvents(eventsData || [])
          setLoading(false)
          return
        }

        const { data: teamData } = await supabase
          .from("teams")
          .select("*, events(event_code, start_time, end_time, name), team_members(user_id, users(name, email))")
          .eq("id", memberRow.team_id)
          .single()

        setTeam(teamData)
        setRepoUrl(teamData?.repo_url || "")

        try {
          const { cli_token, cli_linked_at } = await api.get("/users/me/cli-token")
          setCliToken(cli_token)
          setCliLinkedAt(cli_linked_at)
        } catch (e) { console.error("CLI token fetch failed:", e) }

        if (teamData?.mentor_id) {
          const { data: mentorData } = await supabase
            .from("users")
            .select("*, mentor_profiles(*)")
            .eq("id", teamData.mentor_id)
            .maybeSingle()
          if (mentorData) setMentor(mentorData)
        }

        if (teamData) {
          const collab = await api.get(`/collaboration/team/${teamData.id}`)
          setCollabData(collab)
        }

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
      const teamData = await api.get("/teams/me")
      setTeam(teamData)
    } catch (err) {
      console.error("Analysis failed:", err)
    } finally {
      setLoading(false)
    }
  };

  const handleBroadcast = async () => {
    // Participant broadcast functionality? Maybe just a ping.
    alert("Broadcast functionality reserved for Organizers.")
  }

  if (loading) return (
    <div className="min-h-screen bg-[var(--void)] flex items-center justify-center font-ui uppercase tracking-widest text-[var(--text-muted)] animate-pulse">
      Initialising Participant Node...
    </div>
  )

  if (!team) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--void)] font-body">
        <NavBar role="participant" />
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-[900px] bg-[var(--surface-1)] border border-[var(--border-hot)] rounded-[4px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="bg-[var(--surface-2)] border-b border-[var(--border-hot)] px-6 py-4 flex flex-col">
              <span className="t-section uppercase">Deployment Sequence</span>
              <h2 className="t-display text-[24px] uppercase text-[var(--text-primary)]">NODE_AUTHENTICATION_REQUIRED</h2>
            </div>

            <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="flex flex-col">
                <div className="t-section border-b border-[var(--border)] pb-2 mb-6">
                  OPTION_01: JOIN_EXISTING_NODE
                </div>
                <p className="t-body text-[var(--text-secondary)] mb-6 flex-1">
                  Enter the unique node identifier (team code) to sync with an established squad.
                </p>
                <div className="flex flex-col gap-4">
                  <Input
                    placeholder="e.g. BYT-X4K"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    className="h-11 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] font-mono tracking-wider"
                  />
                  <Button onClick={handleJoinTeam} className="h-11 font-bold bg-[var(--signal-live)] text-[var(--void)]">INITIATE_SYNC</Button>
                </div>
              </div>

              <div className="flex flex-col border-l border-[var(--border)] pl-10">
                <div className="t-section border-b border-[var(--border)] pb-2 mb-6">
                  OPTION_02: INITIALIZE_NEW_NODE
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="t-micro uppercase">Node Designation</label>
                    <Input
                      placeholder="Team Name"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="h-11 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="t-micro uppercase">Target Sector</label>
                    <Select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="h-11 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]">
                      <option value="">Select Event...</option>
                      {events.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.event_code})</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="t-micro uppercase">Operational Track</label>
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
                  <Button onClick={handleCreateTeam} className="h-11 font-bold bg-[var(--signal-live)] text-[var(--void)]">BOOT_NEW_NODE</Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const driftCount = collabData?.environments?.filter((env: any) => {
    const officialDeps = collabData?.official_state?.dependencies || {};
    for (const [name, reqVer] of Object.entries(officialDeps)) {
      if (env.dependencies?.[name] && env.dependencies[name] !== reqVer) return true;
    }
    return false;
  }).length || 0;

  const tickerContent = [
    { type: "DEPLOY", id: team.team_code, team: team.name, msg: "Node fully operational in " + (team.selected_track || "General") },
    { type: "SIGNAL", id: "0x1", team: "ADMIN", msg: "Hackathon protocol active. Monitoring commits." },
    { type: "TIMELINE", id: "INF", team: "SYSTEM", msg: "Next milestone: " + (timelineItems.find(i => i.status === 'active')?.label || "Awaiting Start") },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--void)] font-body selection:bg-[var(--signal-live)] selection:text-[var(--void)]">
      {/* 5.1 Live Ticker Bar */}
      <div className="h-[32px] bg-[var(--signal-live)]/8 border-b border-[var(--signal-live)]/20 overflow-hidden flex items-center w-full sticky top-0 z-[100]">
        <div className="ticker-track whitespace-nowrap flex items-center">
          {[...tickerContent, ...tickerContent, ...tickerContent].map((item, i) => (
            <span key={i} className="font-ui text-[10px] text-[var(--signal-live)] uppercase tracking-[0.1em] mx-4 flex items-center gap-2">
              <span>{item.type === 'DEPLOY' ? '●' : (item.type === 'SIGNAL' ? '⚑' : '◎')}</span>
              <span className="font-bold">{item.type} {item.id}</span>
              <span className="opacity-60">·</span>
              <span>{item.team}</span>
              <span className="opacity-60">·</span>
              <span>{item.msg}</span>
              <span className="ml-8 opacity-30">·····</span>
            </span>
          ))}
        </div>
      </div>

      <NavBar eventCode={event?.event_code || team?.events?.event_code || ""} role="participant" />
      
      <div className="flex flex-1 overflow-hidden">
        {/* 5.4 Sidebar */}
        <aside className="w-[240px] flex-shrink-0 bg-[var(--surface-1)] border-r border-[var(--border)] flex flex-col sticky top-[32px] h-[calc(100vh-32px)]">
          <div className="py-5 px-6 t-section">Navigation</div>
          <button 
            onClick={() => setActiveTab("overview")}
            className={`px-6 py-2 flex items-center gap-3 h-[40px] transition-all border-l-[3px] font-ui text-[12px] uppercase tracking-wider ${activeTab === 'overview' ? "text-[var(--text-primary)] border-[var(--signal-live)] bg-[var(--signal-live)]/5" : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5"}`}
          >
            <Grid2X2 size={14} />
            Overview
          </button>
          <button 
            onClick={() => setActiveTab("sync")}
            className={`px-6 py-2 flex items-center gap-3 h-[40px] transition-all border-l-[3px] font-ui text-[12px] uppercase tracking-wider ${activeTab === 'sync' ? "text-[var(--text-primary)] border-[var(--signal-live)] bg-[var(--signal-live)]/5" : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5"}`}
          >
            <RefreshCw size={14} />
            Team Sync
            {driftCount > 0 && (
              <span className="ml-auto font-ui text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--signal-alert)]/15 text-[var(--signal-alert)] border border-[var(--signal-alert)]/40">{driftCount}</span>
            )}
          </button>

          <div className="mt-auto p-6 border-t border-[var(--border)] bg-[var(--surface-1)]">
             <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] p-4 flex flex-col gap-2">
                <div className="t-micro uppercase tracking-widest">Station ID</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--signal-live)] dot-live shadow-[0_0_8px_rgba(0,255,194,0.4)]" />
                  <span className="font-ui text-[11px] text-[var(--text-primary)] font-bold">{team.team_code}</span>
                </div>
             </div>
             <button 
                onClick={handleBroadcast}
                className="w-full mt-4 bg-[var(--signal-live)] text-[var(--void)] font-display text-[12px] font-bold uppercase tracking-[0.08em] h-[36px] rounded-[4px] hover:shadow-[0_0_15px_rgba(0,255,194,0.4)] transition-all flex items-center justify-center gap-2"
             >
               <Radio size={14} />
               PING_ADMIN
             </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-[720px] flex flex-col h-full overflow-y-auto">
          
          {/* 5.3 CLI Status Bar */}
          <div className="h-[40px] flex-shrink-0 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center justify-between px-6">
            <div className="t-code flex items-center">
              <span className="mr-2">$</span>
              <span>hackbridge status --node={team.team_code?.toLowerCase()} --track={team.selected_track?.toLowerCase()}</span>
              <span className="cli-cursor ml-1 text-[var(--signal-live)]">▋</span>
            </div>
            <div className="font-ui text-[11px] text-[var(--signal-live)] border border-[var(--signal-live)] rounded-[3px] px-2.5 py-1 uppercase tracking-tight">
              {team.selected_track || "GENERAL"}
            </div>
            <div className="font-ui text-[11px] text-[var(--text-secondary)] uppercase tracking-tight">
              Node Sync Nominal · Latency 14ms
            </div>
          </div>

          <div className="p-[32px_40px] flex flex-col flex-1">
            {activeTab === "overview" ? (
              <>
                {/* Page Header */}
                <div className="mb-[32px]">
                  <div className="t-section mb-1 uppercase">
                    PARTICIPANT · DASHBOARD
                  </div>
                  <h1 className="t-display mb-2 text-[var(--text-primary)] uppercase">
                    {team.name}
                  </h1>
                  <div className="font-body text-[13px] text-[var(--text-secondary)] flex items-center gap-2">
                    <span>Operational Node</span>
                    <span className="opacity-30">·</span>
                    <span>{team.team_members?.length || 0} Operators Active</span>
                    <span className="opacity-30">·</span>
                    <span>Sector: {event?.name || "Initializing..."}</span>
                  </div>
                  <div className="w-full h-[1px] bg-[var(--border)] mt-6"></div>
                </div>

                {/* 5.6 Stat Row (Simplified for participant) */}
                <div className="grid grid-cols-4 gap-[16px] mb-[32px]">
                  <StatCard label="Cluster Sync" value="100%" sub="All environments nominal" variant="live" />
                  <StatCard label="Active Tasks" value="04" sub="Pending submission" variant="info" />
                  <StatCard label="Uplink" value="LIVE" sub="Secure channel encrypted" variant="live" />
                  <StatCard label="Risk Level" value="SAFE" sub="No integrity flags" variant="default" />
                </div>

                <div className="grid grid-cols-12 gap-[24px]">
                  {/* Left Column */}
                  <div className="col-span-12 lg:col-span-5 flex flex-col gap-[24px]">
                    {/* Team Roster */}
                    <div className="flex flex-col gap-3">
                       <div className="t-section uppercase">Node Operator Roster</div>
                       <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-4 flex flex-col gap-3">
                          {team.team_members?.map((member: any) => (
                            <div key={member.user_id} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                              <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[11px] font-bold text-[var(--signal-info)]">
                                {member.users?.name?.charAt(0) || "U"}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-ui text-[13px] text-[var(--text-primary)] uppercase">{member.users?.name || "Anonymous"}</span>
                                <span className="t-micro uppercase">{member.users?.email}</span>
                              </div>
                              {member.user_id === team.leader_id && (
                                <span className="ml-auto font-ui text-[9px] px-1.5 py-0.5 rounded-[2px] bg-[var(--signal-info)]/10 text-[var(--signal-info)] border border-[var(--signal-info)]/30 uppercase">Lead</span>
                              )}
                            </div>
                          ))}
                       </div>
                    </div>

                    {/* Timeline */}
                    <div className="flex flex-col gap-3">
                       <div className="t-section uppercase">Mission Timeline</div>
                       <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-6">
                          <Timeline items={timelineItems} />
                       </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="col-span-12 lg:col-span-7 flex flex-col gap-[24px]">
                    {/* CLI Integration - Prominent */}
                    <div className="flex flex-col gap-3 bg-[var(--surface-1)] border border-[var(--border-hot)] rounded-[4px] p-6 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
                       <div className="flex justify-between items-center">
                          <div className="t-section text-[var(--signal-live)] uppercase tracking-widest">
                            CLI_INTEGRATION_CHANNEL
                          </div>
                          <span className="font-ui text-[9px] px-1.5 py-0.5 bg-[var(--signal-info)]/10 text-[var(--signal-info)] border border-[var(--signal-info)]/30 rounded-[2px] uppercase">Unique Access Token</span>
                       </div>
                       <div className="mt-2">
                         <CLIBlock
                          prompt={`hackbridge init ${cliToken || "GENERATING_TOKEN..."}`}
                          successMessage={cliLinkedAt ? "Node linked successfully. Signal strength: 100%." : undefined}
                        />
                       </div>
                       <p className="t-micro italic text-center uppercase tracking-tighter mt-1 opacity-50">
                        This cryptographic token is node-exclusive. Transmission prohibited.
                      </p>
                    </div>

                    {/* Repository Ingestion */}
                    <div className="flex flex-col gap-3">
                       <div className="t-section uppercase">Data Ingestion (GitHub)</div>
                       <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-5 flex flex-col gap-4">
                          <div className="flex gap-3">
                            <Input
                              placeholder="https://github.com/username/repo"
                              value={repoUrl}
                              onChange={(e) => setRepoUrl(e.target.value)}
                              className="h-11 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] font-body text-[13px] focus:border-[var(--signal-live)] transition-all"
                            />
                            <Button onClick={handleAnalyse} disabled={loading} className="h-11 px-8 bg-[var(--signal-live)] text-[var(--void)] font-bold">
                              {loading ? "SYNCING..." : "ANALYSE"}
                            </Button>
                          </div>

                          {(team?.repo_fingerprint && (team.repo_fingerprint.primary_language || team.repo_fingerprint.languages?.length > 0)) && (
                            <div className="p-4 bg-[var(--signal-info)]/5 border border-[var(--signal-info)]/20 rounded-[4px] font-body text-[12px] text-[var(--text-primary)] leading-relaxed">
                               <span className="text-[var(--signal-info)] mr-2 font-bold uppercase">Detected:</span>
                               {team?.repo_fingerprint?.primary_language || team?.repo_fingerprint?.languages?.[0]} architecture 
                               {(team?.repo_fingerprint?.tech_stack?.length > 0 || team?.repo_fingerprint?.frameworks?.length > 0) ? 
                                 ` with ${(team.repo_fingerprint.tech_stack || team.repo_fingerprint.frameworks)?.join(", ")}` : ""}. 
                               {team?.mentor_match_score ? ` Optimization match: ${team.mentor_match_score}%` : ""}
                            </div>
                          )}
                       </div>
                    </div>

                    {/* Mentor Specialist */}
                    <div className="flex flex-col gap-3">
                       <div className="t-section uppercase">Assigned Specialist</div>
                       {mentor ? (
                        <MentorCard
                          teamId={team.id}
                          name={mentor.name}
                          initials={mentor.name?.split(" ").map((n: string) => n[0]).join("") || "?"}
                          matchPct={team.mentor_match_score || 0}
                          tags={mentor.mentor_profiles?.expertise_tags || []}
                        />
                      ) : (
                        <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-10 text-center border-dashed">
                          <span className="t-label italic uppercase opacity-50">Awaiting specialist assignment... Scanning mentor pool.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Team Sync View */}
                <div className="mb-[12px]">
                  <div className="t-section mb-1 uppercase">
                    OPERATIONS · COLLABORATION
                  </div>
                  <h1 className="t-display mb-2 text-[var(--text-primary)] uppercase">
                    TEAM_SYNC
                  </h1>
                  <div className="font-body text-[13px] text-[var(--text-secondary)] flex items-center gap-2">
                    <span>Cross-Node Environment Auditing</span>
                    <span className="opacity-30">·</span>
                    <span>Real-time Dependency Synchronization</span>
                  </div>
                  <div className="w-full h-[1px] bg-[var(--border)] mt-6"></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Connected Nodes */}
                  <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="t-section uppercase">Connected Cluster Nodes ({collabData?.environments?.length || 0})</div>
                    <div className="flex flex-col gap-2">
                      {collabData?.environments?.map((env: any) => {
                        const isActive = (Date.now() - new Date(env.last_active).getTime()) < 10 * 60 * 1000;
                        return (
                          <div 
                            key={env.id} 
                            className={`p-4 cursor-pointer transition-all border rounded-[4px] ${selectedEnvId === env.id ? "bg-[var(--signal-live)]/5 border-[var(--signal-live)] shadow-[0_0_15px_rgba(0,255,194,0.1)]" : "bg-[var(--surface-1)] border-[var(--border)] hover:border-[var(--border-hot)]"}`}
                            onClick={() => setSelectedEnvId(env.id)}
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${isActive ? "bg-[var(--signal-live)] shadow-[0_0_8px_rgba(0,255,194,0.6)]" : "bg-[var(--text-muted)]"}`} />
                                <span className="font-ui text-[13px] font-bold text-[var(--text-primary)] uppercase">{env.users?.name}</span>
                              </div>
                              <span className={`t-micro px-1.5 py-0.5 rounded-[2px] border ${isActive ? "bg-[var(--signal-live)]/10 text-[var(--signal-live)] border-[var(--signal-live)]/30" : "bg-white/5 text-[var(--text-muted)] border-[var(--border)]"}`}>
                                {isActive ? "ONLINE" : "OFFLINE"}
                              </span>
                            </div>
                            <div className="mt-2 t-micro uppercase opacity-60 flex justify-between">
                              <span>Last sync: {new Date(env.last_active).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {selectedEnvId === env.id && <span className="text-[var(--signal-live)] font-bold">SELECTED</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-[var(--surface-2)] border border-[var(--border-hot)] rounded-[4px] p-5 mt-2">
                      <h3 className="t-section mb-3 text-[var(--text-secondary)]">Global Sync Command</h3>
                      <div className="t-code bg-[var(--void)] p-3 rounded border border-[var(--border)] text-[var(--signal-live)]">
                        $ hackbridge collab sync
                      </div>
                    </div>
                  </div>

                  {/* Audit Table & Details */}
                  <div className="lg:col-span-2 flex flex-col gap-8">
                    <div className="flex flex-col gap-4">
                      <div className="t-section uppercase">Cluster Integrity Audit vs Master</div>
                      <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                        <table className="w-full text-left t-code">
                          <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] uppercase border-b border-[var(--border)]">
                            <tr>
                              <th className="px-4 py-3 font-medium">Node Operator</th>
                              <th className="px-4 py-3 font-medium">Runtime Stack</th>
                              <th className="px-4 py-3 font-medium text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border)]">
                            {collabData?.environments?.map((env: any) => {
                              const officialDeps = collabData?.official_state?.dependencies || {};
                              let isDrifting = false;
                              for (const [name, reqVer] of Object.entries(officialDeps)) {
                                if (env.dependencies?.[name] && env.dependencies[name] !== reqVer) {
                                  isDrifting = true;
                                  break;
                                }
                              }
                              
                              return (
                                <tr 
                                  key={env.id} 
                                  onClick={() => setSelectedEnvId(env.id)}
                                  className={`cursor-pointer transition-colors ${selectedEnvId === env.id ? "bg-[var(--signal-live)]/5" : "hover:bg-white/5"}`}
                                >
                                  <td className="px-4 py-3 font-bold text-[var(--text-primary)] uppercase">{env.users?.name}</td>
                                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                                    {env.tools?.["node"] ? `Node ${env.tools["node"]}` : 
                                     env.tools?.["python"] ? `Py ${env.tools["python"]}` : 
                                     env.tools?.["go"] ? `Go ${env.tools["go"]}` : 
                                     env.tools?.["rustc"] ? `Rust ${env.tools["rustc"]}` : "Unknown"}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    {isDrifting ? (
                                      <span className="t-micro px-1.5 py-0.5 bg-[var(--signal-alert)]/10 text-[var(--signal-alert)] border border-[var(--signal-alert)]/30 rounded-[2px] uppercase font-bold">Drift Detected</span>
                                    ) : (
                                      <span className="t-micro px-1.5 py-0.5 bg-[var(--signal-live)]/10 text-[var(--signal-live)] border border-[var(--signal-live)]/30 rounded-[2px] uppercase font-bold">Synced</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Dependency Drift Details */}
                    {selectedEnvId && (
                      <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="t-section uppercase text-[var(--text-primary)]">
                              Detailed Dependency Audit · {collabData.environments.find((e: any) => e.id === selectedEnvId)?.users?.name}
                            </div>
                            <div className="t-micro uppercase text-[var(--signal-info)] font-bold">
                              Source: Master_Manifest
                            </div>
                          </div>
                          
                          <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] overflow-hidden">
                            <table className="w-full text-left t-code">
                              <thead className="bg-[var(--surface-2)] text-[var(--text-muted)] uppercase border-b border-[var(--border)]">
                                <tr>
                                  <th className="px-4 py-2 font-medium text-[11px]">Package Identifier</th>
                                  <th className="px-4 py-2 font-medium text-[11px]">Master Version</th>
                                  <th className="px-4 py-2 font-medium text-[11px]">Node Version</th>
                                  <th className="px-4 py-2 font-medium text-[11px] text-right">Differential</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--border)]">
                                {(() => {
                                  const selectedEnv = collabData.environments.find((e: any) => e.id === selectedEnvId);
                                  const officialDeps = collabData?.official_state?.dependencies || {};
                                  const allDepKeys = Array.from(new Set([...Object.keys(officialDeps), ...Object.keys(selectedEnv?.dependencies || {})]));
                                  
                                  const rows = allDepKeys.map(pkg => {
                                    const masterVer = officialDeps[pkg];
                                    const nodeVer = selectedEnv?.dependencies?.[pkg];
                                    const isMismatched = masterVer && nodeVer && masterVer !== nodeVer;
                                    const isMissingLocal = masterVer && !nodeVer;
                                    const isExtraLocal = !masterVer && nodeVer;

                                    if (!isMismatched && !isMissingLocal && !isExtraLocal) return null;

                                    return (
                                      <tr key={pkg} className="bg-[var(--void)]/50">
                                        <td className="px-4 py-2 text-[var(--text-primary)] font-bold">{pkg}</td>
                                        <td className="px-4 py-2 text-[var(--text-muted)]">{masterVer || "N/A"}</td>
                                        <td className="px-4 py-2 text-[var(--text-secondary)]">{nodeVer || "MISSING"}</td>
                                        <td className="px-4 py-2 text-right">
                                          {isMismatched ? (
                                            <span className="text-[var(--signal-alert)]">MISMATCH</span>
                                          ) : isMissingLocal ? (
                                            <span className="text-[var(--signal-alert)]">REQUIRED</span>
                                          ) : (
                                            <span className="text-[var(--signal-info)]">UNTRACKED</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  }).filter(Boolean);
                                  
                                  if (rows.length === 0) {
                                    return (
                                      <tr>
                                        <td colSpan={4} className="px-4 py-12 text-center t-label italic opacity-30 uppercase">
                                          No environment drift detected for this node
                                        </td>
                                      </tr>
                                    );
                                  }
                                  return rows;
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Environment Secrets Check */}
                        <div className="flex flex-col gap-4">
                          <div className="t-section uppercase text-[var(--text-primary)]">
                            Environment Secrets Integrity Audit
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(() => {
                              const selectedEnv = collabData.environments.find((e: any) => e.id === selectedEnvId);
                              const envKeys = selectedEnv?.env_keys || {};
                              const keys = Object.keys(envKeys);
                              
                              if (keys.length === 0) {
                                return <div className="col-span-2 t-micro uppercase opacity-30 italic">No environment variables tracked for this node.</div>;
                              }
                              
                              return keys.map(key => (
                                <div key={key} className="flex items-center justify-between p-3 bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] t-code">
                                  <span className="text-[var(--text-primary)] font-bold">{key}</span>
                                  {envKeys[key] === "present" ? (
                                    <span className="flex items-center gap-2 text-[var(--signal-live)] font-bold text-[10px]">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--signal-live)]" />
                                      PRESENT
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-2 text-[var(--signal-alert)] font-bold text-[10px]">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--signal-alert)] animate-pulse" />
                                      MISSING
                                    </span>
                                  )}
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* History */}
                    <div className="mt-4">
                      <div className="t-section uppercase mb-6">Evolution Timeline</div>
                      <div className="flex flex-col gap-8">
                        {collabData?.history?.slice(0, 8).map((entry: any) => (
                          <div key={entry.id} className="flex gap-6 relative pl-6 border-l border-[var(--border)] py-1 group">
                            <div className="absolute left-[-5px] top-3 w-2.5 h-2.5 rounded-full bg-[var(--border-hot)] group-hover:bg-[var(--signal-live)] transition-colors shadow-[0_0_8px_rgba(0,0,0,0.5)]" />
                            <div className="flex flex-col flex-1 gap-2">
                              <div className="flex items-center justify-between">
                                <span className="font-body text-[14px] font-bold uppercase text-[var(--text-primary)] tracking-wide">{entry.message}</span>
                                <span className="t-micro uppercase opacity-50 bg-[var(--surface-2)] px-2 py-0.5 rounded-[2px]">{new Date(entry.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              
                              {/* Detailed Changes Breakdown */}
                              {entry.changes && (entry.changes.added?.length > 0 || entry.changes.updated?.length > 0 || entry.changes.removed?.length > 0) && (
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {entry.changes.added?.map((pkg: string) => (
                                    <span key={pkg} className="t-micro px-1.5 py-0.5 bg-[var(--signal-live)]/10 text-[var(--signal-live)] border border-[var(--signal-live)]/20 rounded-[2px] font-bold">
                                      + {pkg}
                                    </span>
                                  ))}
                                  {entry.changes.updated?.map((upd: any) => (
                                    <span key={upd.name} className="t-micro px-1.5 py-0.5 bg-[var(--signal-info)]/10 text-[var(--signal-info)] border border-[var(--signal-info)]/20 rounded-[2px] font-bold">
                                      Δ {upd.name}: {upd.old} → {upd.new}
                                    </span>
                                  ))}
                                  {entry.changes.removed?.map((pkg: string) => (
                                    <span key={pkg} className="t-micro px-1.5 py-0.5 bg-[var(--signal-alert)]/10 text-[var(--signal-alert)] border border-[var(--signal-alert)]/20 rounded-[2px] font-bold">
                                      - {pkg}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5.10 Bottom Status Bar */}
          <div className="h-[32px] mt-auto flex-shrink-0 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center">
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center t-micro uppercase">
              <span className="text-[var(--signal-live)] mr-2">●</span> NODE_LINK_ESTABLISHED
            </div>
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center t-micro uppercase">
              <span className="text-[var(--signal-info)] mr-2">●</span> CLI_FEED_NOMINAL
            </div>
            <div className="flex-1 flex items-center justify-center t-micro uppercase">
              <span className="text-[var(--signal-clean)] mr-2">●</span> SECURITY_VERIFIED
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}