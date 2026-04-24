"use client"

import { useState, useEffect } from "react"
import { NavBar } from "@/components/dashboard/NavBar"
import { NotificationFeed } from "@/components/dashboard/NotificationFeed"
import { StatCard } from "@/components/ui/StatCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResumeUpload } from "@/components/ui/ResumeUpload"
import { api } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { useNotifications } from "@/hooks/useNotifications"
import { LayoutDashboard, Users, Activity, Bell, FileText } from "lucide-react"

export default function MentorDashboard() {
  const [user, setUser] = useState<any>(null)
  const [event, setEvent] = useState<any>(null)
  const [hasJoinedEvent, setHasJoinedEvent] = useState(false)
  const [loading, setLoading] = useState(true)

  const [eventCode, setEventCode] = useState("")
  const [selectedDomain, setSelectedDomain] = useState("")
  const [joinError, setJoinError] = useState("")
  const [joining, setJoining] = useState(false)

  const [teams, setTeams] = useState<any[]>([])
  const [commits, setCommits] = useState<any[]>([])
  const [mentorProfile, setMentorProfile] = useState<any>(null)

  const [notifications, setNotifs] = useState<any[]>([])
  const hookNotifs = useNotifications(event?.id, user?.id, "mentor")
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

  const loadDashboardData = async () => {
    try {
      const teamsData = await api.get("/teams/mentor/assigned")
      setTeams(teamsData || [])
    } catch { }

    try {
      const commitsData = await api.get("/commits/mentor")
      setCommits(commitsData || [])
    } catch { }
  }

  const handleJoinEvent = async () => {
    if (!eventCode.trim() || !selectedDomain) return
    setJoining(true)
    setJoinError("")

    try {
      const supabase = createClient()
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

      await supabase
        .from("event_participants")
        .upsert({
          event_id: eventData.id,
          user_id: user.id,
        }, { onConflict: "event_id, user_id" })

      await supabase
        .from("mentor_profiles")
        .upsert({
          user_id: user.id,
          event_id: eventData.id,
          expertise_tags: [selectedDomain],
          is_available: true,
        }, { onConflict: "user_id" })

      setEvent(eventData)
      setHasJoinedEvent(true)
      await loadDashboardData()
    } catch (err: any) {
      setJoinError(err.message || "Something went wrong.")
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--void)] flex items-center justify-center font-ui uppercase tracking-widest text-[var(--text-muted)] animate-pulse">
        Initialising Specialist Node...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--void)] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[var(--surface-1)] border border-[var(--border)] p-10 text-center rounded-[4px]">
          <h2 className="t-display text-[20px] uppercase text-[var(--text-primary)] mb-4">UPLINK_DENIED</h2>
          <p className="t-body text-[var(--text-secondary)]">Please authenticate as a mentor to access this sector.</p>
        </div>
      </div>
    )
  }

  if (!hasJoinedEvent) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--void)] font-body">
        <NavBar role="mentor" />
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-[800px] bg-[var(--surface-1)] border border-[var(--border-hot)] rounded-[4px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="bg-[var(--surface-2)] border-b border-[var(--border-hot)] px-6 py-4 flex flex-col">
              <span className="t-section uppercase text-[var(--signal-alert)]">Specialist Verification</span>
              <h2 className="t-display text-[24px] uppercase text-[var(--text-primary)]">AUTHENTICATION_OVERRIDE</h2>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                <div className="md:col-span-7 flex flex-col gap-6">
                  <div className="t-section border-b border-[var(--border)] pb-2 uppercase">
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
                       <label className="t-micro uppercase">Expertise Domain</label>
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
                      onClick={handleJoinEvent}
                      disabled={joining || !eventCode.trim() || !selectedDomain}
                      className="h-14 font-bold bg-[var(--signal-alert)] text-[var(--void)] text-[14px] uppercase tracking-[0.1em] mt-2"
                    >
                      {joining ? "VERIFYING..." : "INITIALIZE_SESSION"}
                    </Button>

                    {joinError && (
                      <div className="p-3 bg-[var(--signal-alert)]/10 border border-[var(--signal-alert)]/30 text-[var(--signal-alert)] t-micro uppercase tracking-wider">
                        ERROR: {joinError}
                      </div>
                    )}
                  </div>
                </div>

                <div className="md:col-span-5 flex flex-col gap-6 border-l border-[var(--border)] pl-8">
                   <div className="t-section border-b border-[var(--border)] pb-2 uppercase">
                    02. SPECIALIST_CREDENTIALS
                  </div>
                  <ResumeUpload
                    role="mentor"
                    eventId={event?.id}
                    existingProfile={mentorProfile || undefined}
                    onUploadComplete={(analysis) => setMentorProfile(analysis)}
                    className="[&>div:first-child>div:first-child]:hidden"
                  />
                  <p className="t-micro italic uppercase opacity-50">
                    Uploading operational history allows matching engine optimization.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const pings = notifications.filter(n => n.type === "mentor_ping")
  const tickerContent = [
    { type: "SYNC", id: "0x1", team: "SYSTEM", msg: "Specialist channel established" },
    { type: "COMMIT", id: commits[0]?.id?.slice(0, 6) || "----", team: commits[0]?.teams?.name || "SYS", msg: commits[0]?.message || "No activity detected" },
    { type: "PING", id: "!", team: pings[0]?.teams?.name || "SYS", msg: pings[0]?.message || "Queue clear" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--void)] font-body selection:bg-[var(--signal-alert)] selection:text-[var(--void)]">
      {/* 5.1 Live Ticker Bar */}
      <div className="h-[32px] bg-[var(--signal-alert)]/8 border-b border-[var(--signal-alert)]/20 overflow-hidden flex items-center w-full sticky top-0 z-[100]">
        <div className="ticker-track whitespace-nowrap flex items-center">
          {[...tickerContent, ...tickerContent, ...tickerContent].map((item, i) => (
            <span key={i} className="font-ui text-[10px] text-[var(--signal-alert)] uppercase tracking-[0.1em] mx-4 flex items-center gap-2">
              <span>{item.type === 'SYNC' ? '●' : (item.type === 'COMMIT' ? '⚑' : '◎')}</span>
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

      <NavBar eventCode={event?.event_code || "HACK26"} role="mentor" />
      
      <div className="flex flex-1 overflow-hidden">
        {/* 5.4 Sidebar */}
        <aside className="w-[240px] flex-shrink-0 bg-[var(--surface-1)] border-r border-[var(--border)] hidden lg:flex flex-col sticky top-[32px] h-[calc(100vh-32px)]">
          <div className="py-5 px-6 t-section uppercase">Specialist Control</div>
          <button className="px-6 py-2 flex items-center gap-3 h-[40px] transition-all border-l-[3px] text-[var(--text-primary)] border-[var(--signal-alert)] bg-[var(--signal-alert)]/5 font-ui text-[12px] uppercase tracking-wider">
            <LayoutDashboard size={14} />
            Command Overview
          </button>
          <button className="px-6 py-2 flex items-center gap-3 h-[40px] transition-all border-l-[3px] text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5 font-ui text-[12px] uppercase tracking-wider">
            <Users size={14} />
            Assigned Nodes
          </button>
          <button className="px-6 py-2 flex items-center gap-3 h-[40px] transition-all border-l-[3px] text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5 font-ui text-[12px] uppercase tracking-wider">
            <Activity size={14} />
            Activity Feed
          </button>
          <button className="px-6 py-2 flex items-center gap-3 h-[40px] transition-all border-l-[3px] text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5 font-ui text-[12px] uppercase tracking-wider">
            <Bell size={14} />
            Incoming Pings
          </button>
          
          <div className="mt-8 py-2 px-6 t-micro uppercase opacity-50">Support</div>
          <button className="px-6 py-2 flex items-center gap-3 h-[40px] transition-all border-l-[3px] text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5 font-ui text-[12px] uppercase tracking-wider">
            <FileText size={14} />
            Global Logs
          </button>

          <div className="mt-8 mb-4 px-2">
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

          <div className="mt-auto p-6 bg-[var(--surface-1)] border-t border-[var(--border)]">
             <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] p-4 flex flex-col gap-2">
                <div className="t-micro uppercase tracking-widest opacity-50">Station ID</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--signal-alert)] dot-live shadow-[0_0_8px_rgba(255,45,85,0.4)]" />
                  <span className="font-ui text-[11px] text-[var(--text-primary)] font-bold uppercase">MNT-SIGMA-04</span>
                </div>
             </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-[720px] flex flex-col h-full overflow-y-auto">
          
          {/* 5.3 CLI Status Bar */}
          <div className="h-[40px] flex-shrink-0 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center justify-between px-6">
            <div className="t-code flex items-center">
              <span className="mr-2">$</span>
              <span>hackbridge status --specialist={user?.email?.split('@')[0]}</span>
              <span className="cli-cursor ml-1 text-[var(--signal-alert)]">▋</span>
            </div>
            <div className="font-ui text-[11px] text-[var(--signal-alert)] border border-[var(--signal-alert)] rounded-[3px] px-2.5 py-1 uppercase tracking-tight">
              {mentorProfile?.expertise_tags?.[0]?.toUpperCase() || "GENERALIST"}
            </div>
            <div className="font-ui text-[11px] text-[var(--text-secondary)] uppercase tracking-tight">
              Session Encrypted · Feedback Channel Open
            </div>
          </div>

          <div className="p-[32px_40px] flex flex-col flex-1">
            {/* Page Header */}
            <div className="mb-[32px]">
              <div className="t-section mb-1 uppercase">
                SPECIALIST · DASHBOARD
              </div>
              <h1 className="t-display mb-2 text-[var(--text-primary)] uppercase">
                {user?.user_metadata?.name || user?.user_metadata?.full_name || "COMMAND_CENTER"}
              </h1>
              <div className="font-body text-[13px] text-[var(--text-secondary)] flex items-center gap-2 uppercase">
                <span>{event?.name || "Initializing..."}</span>
                <span className="opacity-30">·</span>
                <span>{teams.length} Nodes Assigned</span>
                <span className="opacity-30">·</span>
                <span>{commits.length} Global Commits</span>
              </div>
              <div className="w-full h-[1px] bg-[var(--border)] mt-6"></div>
            </div>

            {/* Stat Grid */}
            <div className="grid grid-cols-3 gap-[16px] mb-[32px]">
              <StatCard label="Active Nodes" value={teams.length.toString()} sub="Assigned projects" variant="info" />
              <StatCard label="Pending Pings" value={pings.length.toString()} sub="Awaiting ACK" variant="alert" />
              <StatCard label="Activity Metric" value={commits.length.toString()} sub="Commits today" variant="live" />
            </div>

            <div className="grid grid-cols-12 gap-[24px] mb-[24px]">
              
              {/* Pings Queue */}
              <div className="col-span-12 lg:col-span-5 flex flex-col gap-3">
                <div className="t-section uppercase">Incoming Signal Queue</div>
                <div className="flex flex-col gap-3">
                  {pings.length > 0 ? pings.map(ping => (
                    <div key={ping.id} className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-4 flex flex-col gap-3 group hover:border-[var(--border-hot)] transition-all">
                       <div className="flex justify-between items-start">
                          <span className="t-micro px-1.5 py-0.5 bg-[var(--signal-alert)]/10 text-[var(--signal-alert)] border border-[var(--signal-alert)]/30 rounded-[2px] uppercase">Mentor Ping</span>
                          <span className="t-micro uppercase opacity-50">{new Date(ping.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       </div>
                       <div className="font-body text-[13px] text-[var(--text-primary)] italic">
                          &ldquo;{ping.message}&rdquo;
                       </div>
                       <Button className="w-full text-[11px] h-8 bg-white/5 border border-[var(--border)] text-[var(--text-primary)] hover:bg-white/10 uppercase">Establish Uplink</Button>
                    </div>
                  )) : (
                    <div className="bg-[var(--surface-1)] border border-[var(--border)] border-dashed rounded-[4px] p-10 text-center">
                       <span className="t-label italic uppercase opacity-50">Signal queue clear. Monitoring...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Live Commit Feed */}
              <div className="col-span-12 lg:col-span-7 flex flex-col gap-3">
                <div className="flex justify-between items-end">
                  <div className="t-section uppercase">Live Telemetry Feed</div>
                  <div className="flex gap-1.5 overflow-x-auto">
                    {teams.map(t => (
                      <span key={t.id} className="t-micro px-1.5 py-0.5 bg-[var(--surface-2)] text-[var(--text-muted)] border border-[var(--border)] rounded-[2px] uppercase">{t.name}</span>
                    ))}
                  </div>
                </div>
                <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] h-[400px] overflow-y-auto">
                  {commits.length > 0 ? commits.map(commit => (
                    <div key={commit.id} className="p-4 border-b border-[var(--border)] last:border-0 hover:bg-white/5 transition-colors">
                       <div className="flex justify-between items-center mb-1">
                          <span className="t-micro font-bold text-[var(--signal-info)] uppercase">Node_{commit.teams?.name || "UNK"}</span>
                          <span className="t-code text-[10px] opacity-50">{commit.id?.slice(0, 7)}</span>
                       </div>
                       <div className="font-body text-[13px] text-[var(--text-primary)] mb-2">{commit.message}</div>
                       {commit.ai_summary && (
                         <div className="p-2 bg-[var(--signal-info)]/5 border-l-2 border-[var(--signal-info)] font-body text-[11px] text-[var(--text-secondary)] italic">
                            {commit.ai_summary}
                         </div>
                       )}
                    </div>
                  )) : (
                    <div className="flex items-center justify-center h-full">
                       <span className="t-label italic uppercase opacity-50">No commit telemetry detected...</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Assigned Team Roster */}
            <div className="mb-[64px]">
               <div className="t-section uppercase mb-3">Assigned Project Nodes</div>
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teams.length > 0 ? teams.map(team => (
                    <div key={team.id} className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-5 hover:border-[var(--border-hot)] transition-all flex flex-col gap-4">
                       <div className="flex justify-between items-start">
                          <div>
                             <h3 className="font-ui text-[16px] font-bold text-[var(--text-primary)] uppercase leading-tight">{team.name}</h3>
                             <div className="t-micro uppercase opacity-60 mt-1">{team.selected_track || "General"}</div>
                          </div>
                          <span className="t-micro px-1.5 py-0.5 bg-[var(--signal-live)]/10 text-[var(--signal-live)] border border-[var(--signal-live)]/30 rounded-[2px] uppercase">Stable</span>
                       </div>
                       <div className="flex items-center justify-between mt-2 pt-4 border-t border-[var(--border)]">
                          <span className="t-code text-[11px]">{team.team_code}</span>
                          <Button className="text-[10px] h-7 bg-white/5 border border-[var(--border)] text-[var(--text-primary)] hover:bg-white/10 uppercase px-3">View Node</Button>
                       </div>
                    </div>
                  )) : (
                    <div className="col-span-3 bg-[var(--surface-1)] border border-[var(--border)] border-dashed rounded-[4px] p-12 text-center">
                       <span className="t-label italic uppercase opacity-50 animate-pulse">Awaiting node assignment from COMMAND_CENTER...</span>
                    </div>
                  )}
               </div>
            </div>
          </div>

          {/* 5.10 Bottom Status Bar */}
          <div className="h-[32px] mt-auto flex-shrink-0 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center">
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center t-micro uppercase">
              <span className="text-[var(--signal-alert)] mr-2">●</span> SPECIALIST_ACTIVE
            </div>
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center t-micro uppercase">
              <span className="text-[var(--signal-info)] mr-2">●</span> FEED_NOMINAL
            </div>
            <div className="flex-1 flex items-center justify-center t-micro uppercase">
              <span className="text-[var(--signal-clean)] mr-2">●</span> ENCRYPTION_ACTIVE
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}