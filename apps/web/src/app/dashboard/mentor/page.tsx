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
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { ResumeUpload } from "@/components/ui/ResumeUpload"
import { api } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { useNotifications } from "@/hooks/useNotifications"

export default function MentorDashboard() {
  // Auth & Event state
  const [user, setUser] = useState<any>(null)
  const [event, setEvent] = useState<any>(null)
  const [hasJoinedEvent, setHasJoinedEvent] = useState(false)
  const [loading, setLoading] = useState(true)

  // Event join form
  const [eventCode, setEventCode] = useState("")
  const [selectedDomain, setSelectedDomain] = useState("")
  const [joinError, setJoinError] = useState("")
  const [joining, setJoining] = useState(false)

  // Dashboard data
  const [teams, setTeams] = useState<any[]>([])
  const [commits, setCommits] = useState<any[]>([])
  const [mentorProfile, setMentorProfile] = useState<any>(null)

  // Notifications — synced safely into local state
  const [notifications, setNotifs] = useState<any[]>([])
  const hookNotifs = useNotifications(event?.id, user?.id, "mentor")
  useEffect(() => {
    if (Array.isArray(hookNotifs)) setNotifs(hookNotifs)
  }, [hookNotifs])

  // ─── Init: check auth + check if already joined an event ───
  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) { setLoading(false); return }
        setUser(authUser)

        // Check if mentor has joined any event
        const { data: participations } = await supabase
          .from("event_participants")
          .select("event_id, events(id, event_code, name, start_time, end_time, tracks)")
          .eq("user_id", authUser.id)
          .order("joined_at", { ascending: false })
          .limit(1)

        if (participations?.length && participations[0].events) {
          const ev = participations[0].events as any
          setEvent(ev)
          setHasJoinedEvent(true)
          await loadDashboardData()
        }

        // Load mentor profile
        const { data: profile } = await supabase
          .from("mentor_profiles")
          .select("*")
          .eq("user_id", authUser.id)
          .maybeSingle()
        if (profile) setMentorProfile(profile)
      } catch (err) {
        console.error("Init failed:", err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // ─── Load dashboard data (teams + commits) ───
  const loadDashboardData = async () => {
    try {
      const teamsData = await api.get("/teams/mentor/assigned")
      setTeams(teamsData || [])
    } catch { /* mentor may not have teams yet */ }

    try {
      const commitsData = await api.get("/commits/mentor")
      setCommits(commitsData || [])
    } catch { /* no commits yet */ }
  }

  // ─── Join event by code ───
  const handleJoinEvent = async () => {
    if (!eventCode.trim() || !selectedDomain) return
    setJoining(true)
    setJoinError("")

    try {
      const supabase = createClient()

      // 1. Look up event by code
      const { data: eventData, error: eventErr } = await supabase
        .from("events")
        .select("id, event_code, name, start_time, end_time, tracks")
        .eq("event_code", eventCode.trim().toUpperCase())
        .maybeSingle()

      if (eventErr || !eventData) {
        setJoinError("Event not found. Check the code and try again.")
        setJoining(false)
        return
      }

      // 2. Insert into event_participants
      const { error: joinErr } = await supabase
        .from("event_participants")
        .upsert({
          event_id: eventData.id,
          user_id: user.id,
        }, { onConflict: "event_id, user_id" })

      if (joinErr) {
        setJoinError("Failed to join: " + joinErr.message)
        setJoining(false)
        return
      }

      // 3. Ensure mentor_profiles row exists with selected domain
      await supabase
        .from("mentor_profiles")
        .upsert({
          user_id: user.id,
          expertise_tags: [selectedDomain],
          is_available: true,
        }, { onConflict: "user_id" })

      // 4. Transition to dashboard
      setEvent(eventData)
      setHasJoinedEvent(true)
      await loadDashboardData()
    } catch (err: any) {
      setJoinError(err.message || "Something went wrong.")
    } finally {
      setJoining(false)
    }
  }

  // ─── Loading ───
  if (loading) {
    return (
      <div className="min-h-screen dashboard-root flex items-center justify-center">
        <span className="text-[15px] text-[var(--hb-muted)] animate-hb-pulse">Loading Mentor Dashboard...</span>
      </div>
    )
  }

  // ─── Not logged in ───
  if (!user) {
    return (
      <div className="min-h-screen dashboard-root flex items-center justify-center">
        <Card variant="elevated" className="p-10 text-center max-w-md">
          <h2 className="text-[20px] font-bold text-[var(--hb-text)] mb-2">Sign in Required</h2>
          <p className="text-[14px] text-[var(--hb-muted)]">Please sign in as a mentor to access this dashboard.</p>
        </Card>
      </div>
    )
  }

  // ═══════════════════════════════════════════════
  // STATE 1: Event Setup — Enter EVENT_CODE
  // ═══════════════════════════════════════════════
  if (!hasJoinedEvent) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--void)] font-body">
        <NavBar role="mentor" />
        <main className="flex-1 flex flex-col items-center justify-center p-6 bg-[rgba(255,45,85,0.02)]">
          <div className="w-full max-w-[800px] bg-[var(--surface-1)] border border-[var(--border-hot)] rounded-[4px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="bg-[var(--surface-2)] border-b border-[var(--border-hot)] px-6 py-4 flex flex-col">
              <span className="font-ui text-[10px] text-[var(--signal-alert)] uppercase tracking-[0.2em]">Specialist Verification</span>
              <h2 className="font-display text-[24px] font-bold text-[var(--text-primary)]">AUTHENTICATION_OVERRIDE</h2>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-7 flex flex-col gap-6">
                  <div className="font-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border)] pb-2">
                    01. EVENT_DEPLOYMENT_CODE
                  </div>
                  <div className="flex flex-col gap-4">
                    <Input
                      placeholder="e.g. HACK26"
                      value={eventCode}
                      onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                      className="h-12 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] font-mono tracking-widest text-[18px]"
                    />
                    
                    <div className="flex flex-col gap-2">
                       <label className="font-ui text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Expertise Domain</label>
                       <Input
                          list="domain-options"
                          value={selectedDomain}
                          onChange={(e) => setSelectedDomain(e.target.value)}
                          placeholder="Select specialization..."
                          className="h-11 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]"
                        />
                        <datalist id="domain-options">
                          <option value="Web3 / Blockchain" />
                          <option value="AI / Machine Learning" />
                          <option value="Full Stack Development" />
                          <option value="Mobile Development" />
                          <option value="DevOps / Cloud" />
                          <option value="UI/UX Design" />
                          <option value="Data Science" />
                          <option value="Cybersecurity" />
                          <option value="IoT / Hardware" />
                          <option value="Social Impact" />
                          <option value="General / Multi-domain" />
                        </datalist>
                    </div>

                    <Button
                      variant="primary"
                      onClick={handleJoinEvent}
                      disabled={joining || !eventCode.trim() || !selectedDomain}
                      className="h-14 font-bold text-[14px] tracking-[0.1em] mt-2"
                    >
                      {joining ? "VERIFYING..." : "INITIALIZE_SESSION"}
                    </Button>

                    {joinError && (
                      <div className="p-3 bg-[rgba(255,45,85,0.1)] border border-[rgba(255,45,85,0.3)] text-[var(--signal-alert)] font-ui text-[11px] uppercase tracking-wider">
                        ERROR: {joinError}
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-5 flex flex-col gap-6 border-l border-[var(--border)] pl-8">
                   <div className="font-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border)] pb-2">
                    02. SPECIALIST_CREDENTIALS
                  </div>
                  <ResumeUpload
                    role="mentor"
                    existingProfile={mentorProfile || undefined}
                    onUploadComplete={(analysis) => setMentorProfile(analysis)}
                    className="[&>div:first-child>div:first-child]:hidden"
                  />
                  <p className="font-body text-[10px] text-[var(--text-muted)] italic">
                    Uploading your operational history (resume) allows the Matching Engine to optimize node assignments.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ═══════════════════════════════════════════════
  // STATE 2: Full Dashboard — Event Joined
  // ═══════════════════════════════════════════════
  const pings = notifications.filter(n => n.type === "mentor_ping")
  const broadcasts = notifications.filter(n => n.type === "broadcast")

  const tickerContent = [
    { type: "SYNC", id: "0x1", team: "SYSTEM", msg: "Specialist channel established" },
    { type: "COMMIT", id: commits[0]?.id?.slice(0, 6) || "----", team: commits[0]?.teams?.name || "SYS", msg: commits[0]?.message || "No activity detected" },
    { type: "PING", id: "!", team: pings[0]?.teams?.name || "SYS", msg: pings[0]?.message || "Queue clear" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--void)] font-body">
      {/* Live Ticker Bar */}
      <div className="h-[32px] bg-[rgba(255,45,85,0.08)] border-b border-[rgba(255,45,85,0.2)] overflow-hidden flex items-center w-full">
        <div className="ticker-track whitespace-nowrap flex items-center">
          {[...tickerContent, ...tickerContent, ...tickerContent].map((item, i) => (
            <span key={i} className="font-ui text-[10px] text-[var(--signal-alert)] uppercase tracking-[0.1em] mx-4">
              <span className="mr-2">{item.type === 'SYNC' ? '●' : (item.type === 'COMMIT' ? '⚑' : '◎')}</span>
              {item.type} {item.id} · {item.team} · {item.msg}
              <span className="ml-8 opacity-30">·····</span>
            </span>
          ))}
        </div>
      </div>

      <NavBar eventCode={event?.event_code || "HACK26"} role="mentor" />
      
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-96px)]">
        {/* Sidebar (240px) */}
        <aside className="w-[240px] flex-shrink-0 bg-[var(--surface-1)] border-r border-[var(--border)] hidden lg:flex flex-col sticky top-0 h-full overflow-y-auto">
          <div className="py-5 px-6 font-ui text-[9px] text-[var(--text-muted)] tracking-[0.2em] uppercase">Specialist Control</div>
          <div className="px-6 py-2 flex items-center text-[var(--text-primary)] border-l-4 border-[var(--signal-alert)] bg-[rgba(255,45,85,0.04)] font-ui text-[12px] h-[40px] cursor-pointer transition-all">
            Command Overview
          </div>
          <div className="px-6 py-2 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)] font-ui text-[12px] h-[40px] cursor-pointer border-l-4 border-transparent transition-all">
            Assigned Nodes
          </div>
          <div className="px-6 py-2 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)] font-ui text-[12px] h-[40px] cursor-pointer border-l-4 border-transparent transition-all">
            Activity Feed
          </div>
          <div className="px-6 py-2 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)] font-ui text-[12px] h-[40px] cursor-pointer border-l-4 border-transparent transition-all">
            Incoming Pings
          </div>
          
          <div className="mt-8 py-2 px-6 font-ui text-[9px] text-[var(--text-muted)] tracking-[0.2em] uppercase">Support</div>
          <div className="px-6 py-2 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)] font-ui text-[12px] h-[40px] cursor-pointer border-l-4 border-transparent transition-all">
            Global Logs
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
                  <div className="w-2 h-2 rounded-full bg-[var(--signal-alert)] animate-pulse" />
                  <span className="font-ui text-[11px] text-[var(--text-primary)]">MNT-SIGMA-04</span>
                </div>
             </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-[720px] flex flex-col h-full overflow-y-auto">
          
          {/* CLI Status Bar */}
          <div className="h-[40px] flex-shrink-0 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center justify-between px-6">
            <div className="font-display text-[12px] text-[var(--text-code)]">
              $ hackbridge status --specialist={user?.email || "UNKNOWN"}
              <span className="cli-cursor text-[var(--signal-alert)] inline-block w-[6px] h-[14px] bg-[var(--signal-alert)] align-middle ml-1"></span>
            </div>
            <div className="font-ui text-[11px] text-[var(--signal-alert)] border border-[var(--signal-alert)] rounded-[3px] px-2.5 py-1 uppercase tracking-tight">
              {mentorProfile?.expertise_tags?.[0]?.toUpperCase() || "GENERALIST"}
            </div>
            <div className="font-ui text-[11px] text-[var(--text-secondary)]">
              Session Encrypted · Feedback Channel Open
            </div>
          </div>

          <div className="p-[32px_40px] flex flex-col flex-1">
            {/* Page Header */}
            <div className="mb-[32px] border-b border-[var(--border)] pb-6">
              <div className="font-ui text-[10px] text-[var(--text-muted)] tracking-[0.18em] uppercase mb-1">
                SPECIALIST · DASHBOARD
              </div>
              <h1 className="font-display text-[48px] font-bold text-[var(--text-primary)] leading-none mb-2 tracking-tight">
                {user?.user_metadata?.name || user?.user_metadata?.full_name || "COMMAND_CENTER"}
              </h1>
              <div className="font-body text-[13px] text-[var(--text-secondary)]">
                {event?.name || "Initializing..."} · {teams.length} Nodes Assigned · {commits.length} Global Commits Detected
              </div>
            </div>

            {/* Stat Grid */}
            <div className="grid grid-cols-3 gap-[16px] mb-[24px]">
              <StatCard label="Active Nodes" value={teams.length.toString()} sub="Assigned projects" />
              <StatCard label="Pending Pings" value={<span className="text-[var(--signal-ping)]">{pings.length}</span>} sub="Awaiting ACK" />
              <StatCard label="Activity Metric" value={commits.length.toString()} sub="Commits today" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px] mb-[24px]">
              
              {/* Pings Column - 40% */}
              <div className="lg:col-span-5 flex flex-col gap-2">
                <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase mb-1">
                  Incoming Signal Queue
                </div>
                <div className="flex flex-col gap-3">
                  {pings.length > 0 ? pings.map(ping => (
                    <div key={ping.id} className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-4 flex flex-col gap-3 group hover:border-[var(--border-hot)] transition-all">
                       <div className="flex justify-between items-start">
                          <span className="font-ui text-[10px] px-1.5 py-0.5 bg-[rgba(255,184,0,0.1)] text-[var(--signal-ping)] border border-[rgba(255,184,0,0.3)] rounded-[2px]">MENTOR_PING</span>
                          <span className="font-body text-[10px] text-[var(--text-muted)]">{new Date(ping.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       </div>
                       <div className="font-body text-[13px] text-[var(--text-primary)] italic">
                          &ldquo;{ping.message}&rdquo;
                       </div>
                       <Button variant="ghost" size="sm" className="w-full text-[11px] h-8 border border-[var(--border)]">ESTABLISH_UPLINK</Button>
                    </div>
                  )) : (
                    <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-10 text-center">
                       <span className="font-body text-[12px] text-[var(--text-muted)] italic">Signal queue clear. Monitoring for incoming pings...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Commit Feed Column - 60% */}
              <div className="lg:col-span-7 flex flex-col gap-2">
                <div className="flex justify-between items-end mb-1">
                  <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase">
                    Live Commit Feed
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto">
                    {teams.map(t => (
                      <span key={t.id} className="font-ui text-[9px] px-1.5 py-0.5 bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] rounded-[2px]">{t.name}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] h-[400px] overflow-y-auto">
                  {commits.length > 0 ? commits.map(commit => (
                    <div key={commit.id} className="p-4 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                       <div className="flex justify-between items-center mb-1">
                          <span className="font-ui text-[10px] font-bold text-[var(--signal-info)]">NODE_{commit.teams?.name?.toUpperCase() || "UNK"}</span>
                          <span className="font-display text-[10px] text-[var(--text-code)]">{commit.id?.slice(0, 7)}</span>
                       </div>
                       <div className="font-body text-[13px] text-[var(--text-primary)] mb-2">{commit.message}</div>
                       {commit.ai_summary && (
                         <div className="p-2 bg-[rgba(99,115,210,0.04)] border-l-2 border-[var(--signal-info)] font-body text-[11px] text-[var(--text-secondary)] italic">
                            {commit.ai_summary}
                         </div>
                       )}
                    </div>
                  )) : (
                    <div className="flex items-center justify-center h-full">
                       <span className="font-body text-[12px] text-[var(--text-muted)] italic">No commit telemetry detected yet...</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Assigned Team Roster */}
            <div className="mb-[64px]">
               <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase mb-3">
                  Assigned Project Nodes
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teams.length > 0 ? teams.map(team => (
                    <div key={team.id} className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-5 hover:border-[var(--border-hot)] transition-all flex flex-col gap-4">
                       <div className="flex justify-between items-start">
                          <div>
                             <h3 className="font-ui text-[16px] font-bold text-[var(--text-primary)] leading-tight">{team.name}</h3>
                             <div className="font-ui text-[10px] text-[var(--text-muted)] uppercase tracking-tight mt-1">{team.selected_track || "General"}</div>
                          </div>
                          <span className="font-ui text-[9px] px-1.5 py-0.5 bg-[rgba(0,255,194,0.1)] text-[var(--signal-live)] border border-[rgba(0,255,194,0.3)] rounded-[2px]">STABLE</span>
                       </div>
                       <div className="flex items-center justify-between mt-2 pt-4 border-t border-[var(--border)]">
                          <span className="font-display text-[11px] text-[var(--text-code)]">{team.team_code}</span>
                          <Button variant="ghost" size="sm" className="text-[10px] h-7">VIEW_NODE</Button>
                       </div>
                    </div>
                  )) : (
                    <div className="col-span-3 bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-12 text-center">
                       <span className="font-body text-[13px] text-[var(--text-muted)] italic uppercase tracking-widest animate-pulse">Awaiting node assignment from COMMAND_CENTER...</span>
                    </div>
                  )}
               </div>
            </div>


          </div>

          {/* Bottom Status Bar */}
          <div className="h-[32px] mt-auto flex-shrink-0 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center">
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center font-ui text-[10px] text-[var(--text-muted)]">
              <span className="text-[var(--signal-alert)] mr-2">●</span> SPECIALIST_ACTIVE
            </div>
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center font-ui text-[10px] text-[var(--text-muted)]">
              <span className="text-[var(--signal-info)] mr-2">●</span> FEED_NOMINAL
            </div>
            <div className="flex-1 flex items-center justify-center font-ui text-[10px] text-[var(--text-muted)]">
              <span className="text-[var(--signal-clean)] mr-2">●</span> ENCRYPTION_ACTIVE
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}