"use client"

import { useState, useEffect } from "react"
import { NavBar } from "@/components/dashboard/NavBar"
import { NotificationFeed } from "@/components/dashboard/NotificationFeed"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResumeUpload } from "@/components/ui/ResumeUpload"
import { ScoreBar } from "@/components/ui/ScoreBar"
import { Select } from "@/components/ui/select"
import { api } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { useNotifications } from "@/hooks/useNotifications"
import { LayoutGrid, Users, History, FileBadge } from "lucide-react"

export default function JudgeDashboard() {
  const [allEvents, setAllEvents] = useState<any[]>([])
  const [event, setEvent] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [hasJoinedEvent, setHasJoinedEvent] = useState(false)
  const [eventCode, setEventCode] = useState("")
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState("")
  const [judgeProfile, setJudgeProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  const liveNotifications = useNotifications(event?.id, user?.id, "judge") || []

  const loadEventData = async (activeEvent: any) => {
    if (!activeEvent) return;
    setEvent(activeEvent);
    try {
      const teamsData = await api.get(`/teams/event/${activeEvent.id}`)
      setTeams(teamsData || [])
      if (teamsData?.length > 0) setSelectedTeam(teamsData[0])
    } catch (error) {
      console.error("Failed to load teams:", error)
    }
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (!authUser) { setLoading(false); return }
        setUser(authUser)

        // 1. Get Judge's events
        const { data: participations } = await supabase
          .from("event_participants")
          .select("event_id, events(id, event_code, name, start_time, end_time, tracks)")
          .eq("user_id", authUser.id)
          .order("joined_at", { ascending: false })

        const joinedEvents = participations?.map(p => p.events).filter(Boolean) || []
        setAllEvents(joinedEvents)

        if (joinedEvents.length > 0) {
          setHasJoinedEvent(true)
          await loadEventData(joinedEvents[0])
        }

        // 2. Get profile
        const { data: profile } = await supabase
          .from("judge_profiles")
          .select("*")
          .eq("user_id", authUser.id)
          .maybeSingle()
        if (profile) setJudgeProfile(profile)

      } catch (error) {
        console.error("Failed to fetch initial data:", error)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  const handleJoinEvent = async () => {
    if (!eventCode.trim()) return
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
        .from("judge_profiles")
        .upsert({
          user_id: user.id,
          event_id: eventData.id,
        }, { onConflict: "user_id" })

      setAllEvents(prev => [eventData, ...prev])
      setEvent(eventData)
      setHasJoinedEvent(true)
      await loadEventData(eventData)
    } catch (err: any) {
      setJoinError(err.message || "Something went wrong.")
    } finally {
      setJoining(false)
    }
  }

  const fetchAiSuggestion = async (teamId: string) => {
    try {
      const suggestion = await api.post(`/scores/ai-suggest/${teamId}?round=1`, {})
      setAiAnalysis(suggestion)
    } catch (err) {
      console.error("AI suggestion failed:", err)
      setAiAnalysis(null)
    }
  }

  useEffect(() => {
    if (selectedTeam) {
      fetchAiSuggestion(selectedTeam.id)
    }
  }, [selectedTeam])

  const handleSubmitScore = async () => {
    if (!selectedTeam || !event) return;
    setSubmitting(true)
    try {
      await api.post("/scores/", {
        team_id: selectedTeam.id,
        event_id: event.id,
        round: 1,
        rubric_scores: aiAnalysis?.scores || { "Code Quality": 8, "Complexity": 7, "Completion": 8 },
        notes: "Scores submitted via Judge Dashboard"
      })
      alert("Scores submitted successfully!")
    } catch (err) {
      console.error("Failed to submit score:", err)
    } finally {
      setSubmitting(false)
    }
  }

  const eventDropdown = (
    <Select
      className="w-auto font-mono text-[11px] h-6 py-0 bg-[var(--signal-ping)]/10 text-[var(--signal-ping)] border-[var(--signal-ping)]/30 cursor-pointer uppercase"
      value={event?.id || ""}
      onChange={(e) => {
        const selected = allEvents.find(ev => ev.id === e.target.value);
        if (selected) loadEventData(selected);
      }}
    >
      {allEvents.map(ev => (
        <option key={ev.id} value={ev.id}>{ev.event_code}</option>
      ))}
    </Select>
  );

  const tickerContent = [
    { type: "SCORE", id: "0x1", team: selectedTeam?.name || "SYS", msg: submitting ? "SUBMITTING_PACKET..." : "AWAITING_INPUT" },
    { type: "AI_NODE", id: "GROQ", team: "LLAMA3", msg: aiAnalysis ? "ANALYSIS_COMPLETE" : "SCANNING_REPOS..." },
    { type: "EVENT", id: event?.event_code || "N/A", team: event?.name || "VOID", msg: "JUDGING_PROTOCOL_ACTIVE" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--void)] flex items-center justify-center font-ui uppercase tracking-widest text-[var(--text-muted)] animate-pulse">
        Initialising Evaluation Node...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--void)] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[var(--surface-1)] border border-[var(--border)] p-10 text-center rounded-[4px]">
          <h2 className="t-display text-[20px] uppercase text-[var(--text-primary)] mb-4">UPLINK_DENIED</h2>
          <p className="t-body text-[var(--text-secondary)]">Please authenticate as a judge to access this sector.</p>
        </div>
      </div>
    )
  }

  if (!hasJoinedEvent) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--void)] font-body">
        <NavBar role="judge" />
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-[500px] bg-[var(--surface-1)] border border-[var(--signal-ping)] rounded-[4px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="bg-[var(--surface-2)] border-b border-[var(--signal-ping)] px-6 py-4 flex flex-col">
              <span className="t-section uppercase text-[var(--signal-ping)]">Evaluator Verification</span>
              <h2 className="t-display text-[24px] uppercase text-[var(--text-primary)]">INITIALIZE_EVALUATION</h2>
            </div>

            <div className="p-8 flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                <div className="t-micro uppercase opacity-50">Event Deployment Code</div>
                <Input
                  placeholder="e.g. HACK26"
                  value={eventCode}
                  onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                  className="h-12 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] font-mono tracking-widest text-[18px]"
                />
                <Button
                  onClick={handleJoinEvent}
                  disabled={joining || !eventCode.trim()}
                  className="h-14 font-bold bg-[var(--signal-ping)] text-[var(--void)] text-[14px] uppercase tracking-[0.1em]"
                >
                  {joining ? "VERIFYING..." : "CONNECT_TO_STATION"}
                </Button>
                {joinError && (
                  <div className="p-3 bg-[var(--signal-alert)]/10 border border-[var(--signal-alert)]/30 text-[var(--signal-alert)] t-micro uppercase tracking-wider">
                    ERROR: {joinError}
                  </div>
                )}
              </div>
              
              <div className="border-t border-[var(--border)] pt-6">
                <ResumeUpload
                  role="judge"
                  eventId={event?.id}
                  existingProfile={judgeProfile || undefined}
                  onUploadComplete={(analysis) => setJudgeProfile(analysis)}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--void)] font-body selection:bg-[var(--signal-ping)] selection:text-[var(--void)]">
      {/* 5.1 Live Ticker Bar */}
      <div className="h-[32px] bg-[var(--signal-ping)]/8 border-b border-[var(--signal-ping)]/20 overflow-hidden flex items-center w-full sticky top-0 z-[100]">
        <div className="ticker-track whitespace-nowrap flex items-center">
          {[...tickerContent, ...tickerContent, ...tickerContent].map((item, i) => (
            <span key={i} className="font-ui text-[10px] text-[var(--signal-ping)] uppercase tracking-[0.1em] mx-4 flex items-center gap-2">
              <span>{item.type === 'SCORE' ? '●' : (item.type === 'AI_NODE' ? '⚑' : '◎')}</span>
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

      <NavBar eventDropdown={allEvents.length > 0 ? eventDropdown : undefined} eventCode={event?.event_code} role="judge" />
      
      <div className="flex flex-1 overflow-hidden">
        {/* 5.4 Sidebar */}
        <aside className="w-[240px] flex-shrink-0 bg-[var(--surface-1)] border-r border-[var(--border)] hidden lg:flex flex-col sticky top-[32px] h-[calc(100vh-32px)]">
          <div className="py-5 px-6 t-section uppercase">Judging Station</div>
          <button className="px-6 py-2 flex items-center gap-3 h-[40px] transition-all border-l-[3px] text-[var(--text-primary)] border-[var(--signal-ping)] bg-[var(--signal-ping)]/5 font-ui text-[12px] uppercase tracking-wider">
            <LayoutGrid size={14} />
            Scoring Matrix
          </button>
          <button className="px-6 py-2 flex items-center gap-3 h-[40px] transition-all border-l-[3px] text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5 font-ui text-[12px] uppercase tracking-wider">
            <Users size={14} />
            Team Roster
          </button>
          <button className="px-6 py-2 flex items-center gap-3 h-[40px] transition-all border-l-[3px] text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5 font-ui text-[12px] uppercase tracking-wider">
            <History size={14} />
            Historical Scores
          </button>
          
          <div className="mt-8 py-2 px-6 t-micro uppercase opacity-50">Verification</div>
          <button className="px-6 py-2 flex items-center gap-3 h-[40px] transition-all border-l-[3px] text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5 font-ui text-[12px] uppercase tracking-wider">
            <FileBadge size={14} />
            Credentials
          </button>

          <div className="mt-8 mb-4 px-2">
            <NotificationFeed
              notifications={(liveNotifications || []).map(n => ({
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
                  <div className="w-2 h-2 rounded-full bg-[var(--signal-ping)] dot-live shadow-[0_0_8px_rgba(255,184,0,0.4)]" />
                  <span className="font-ui text-[11px] text-[var(--text-primary)] font-bold uppercase">JDG-ALPHA-01</span>
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
              <span>hackbridge judge --event={event?.event_code?.toLowerCase() || "void"} --round=1</span>
              <span className="cli-cursor ml-1 text-[var(--signal-ping)]">▋</span>
            </div>
            <div className="font-ui text-[11px] text-[var(--signal-ping)] border border-[var(--signal-ping)] rounded-[3px] px-2.5 py-1 uppercase tracking-tight">
              LIVE_SCORING
            </div>
            <div className="font-ui text-[11px] text-[var(--text-secondary)] uppercase tracking-tight">
              Station Encrypted · Round 1 Protocol
            </div>
          </div>

          <div className="p-[32px_40px] flex flex-col flex-1">
            {/* Page Header */}
            <div className="mb-[32px]">
              <div className="t-section mb-1 uppercase">
                EVALUATOR · DASHBOARD
              </div>
              <h1 className="t-display mb-2 text-[var(--text-primary)] uppercase">
                JUDGING STATION
              </h1>
              <div className="font-body text-[13px] text-[var(--text-secondary)] flex items-center gap-2 uppercase">
                <span>{event?.name || "Initializing..."}</span>
                <span className="opacity-30">·</span>
                <span>{teams.length} Nodes in Queue</span>
                <span className="opacity-30">·</span>
                <span>Round 1 active</span>
              </div>
              <div className="w-full h-[1px] bg-[var(--border)] mt-6"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px] mb-[24px]">
              
              {/* Team Queue */}
              <div className="lg:col-span-4 flex flex-col gap-3">
                <div className="t-section uppercase">Node Queue</div>
                <div className="flex flex-col gap-2">
                  {teams.length > 0 ? teams.map(team => (
                    <div
                      key={team.id}
                      onClick={() => setSelectedTeam(team)}
                      className={`p-4 border rounded-[4px] cursor-pointer flex justify-between items-center transition-all ${selectedTeam?.id === team.id
                          ? "bg-[var(--signal-ping)]/10 border-[var(--signal-ping)] shadow-[0_0_15px_rgba(255,184,0,0.1)]"
                          : "bg-[var(--surface-1)] border-[var(--border)] hover:border-[var(--border-hot)]"
                        }`}
                    >
                      <div className="flex flex-col">
                        <span className={`font-ui text-[14px] font-bold uppercase ${selectedTeam?.id === team.id ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                          {team.name}
                        </span>
                        <span className="t-micro uppercase opacity-50">{team.team_code}</span>
                      </div>
                      {selectedTeam?.id === team.id && (
                        <span className="t-micro px-1.5 py-0.5 bg-[var(--signal-ping)] text-[var(--void)] font-bold rounded-[2px] uppercase">Active</span>
                      )}
                    </div>
                  )) : (
                    <div className="bg-[var(--surface-1)] border border-[var(--border)] border-dashed rounded-[4px] p-8 text-center">
                      <span className="t-label italic uppercase opacity-50">No nodes detected in this sector.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Scoring Panel */}
              <div className="lg:col-span-8 flex flex-col gap-3">
                <div className="t-section uppercase">
                  Evaluation Terminal · {selectedTeam?.name || "AWAITING_SELECTION"}
                </div>

                {selectedTeam ? (
                  <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-6 flex flex-col gap-8 shadow-[0_0_30px_rgba(0,0,0,0.2)]">
                    <div className="flex justify-between items-start border-b border-[var(--border)] pb-6">
                      <div>
                        <h2 className="t-display text-[20px] text-[var(--text-primary)] uppercase">AI_SYNERGY_ANALYSIS</h2>
                        <p className="t-micro uppercase opacity-50 mt-1">Llama 3 cross-referenced commit architecture</p>
                      </div>
                      <div className="t-micro text-[var(--signal-info)] border border-[var(--signal-info)] rounded-[3px] px-2 py-1 uppercase font-bold tracking-widest">
                        GROQ_VALIDATED
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                      {aiAnalysis?.scores ? (
                        Object.entries(aiAnalysis.scores).map(([crit, val]: [string, any]) => (
                          <ScoreBar key={crit} criterion={crit} score={val} />
                        ))
                      ) : (
                        <>
                          <ScoreBar criterion="Code Quality" score={0} />
                          <ScoreBar criterion="Complexity" score={0} />
                          <ScoreBar criterion="Completion" score={0} />
                          <ScoreBar criterion="Innovation" score={0} />
                        </>
                      )}
                    </div>

                    <div className="p-4 bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] font-body text-[13px] text-[var(--text-primary)] leading-relaxed italic relative">
                       <span className="absolute -top-2 left-4 px-2 bg-[var(--surface-1)] t-micro uppercase tracking-widest opacity-50">AI_COMMENTARY</span>
                       &ldquo;{aiAnalysis?.evaluation || "Scanning team repository... Analyzing code complexity and track alignment. Please hold."}&rdquo;
                    </div>

                    <div className="pt-6 border-t border-[var(--border)] flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                         <label className="t-micro uppercase opacity-50">Evaluator Notes</label>
                         <textarea className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] p-3 font-body text-[13px] text-[var(--text-primary)] h-24 focus:border-[var(--signal-ping)] outline-none transition-all" placeholder="Enter manual feedback here..."></textarea>
                      </div>
                      <Button
                        className="w-full h-14 font-bold bg-[var(--signal-ping)] text-[var(--void)] text-[14px] uppercase tracking-[0.1em]"
                        onClick={handleSubmitScore}
                        disabled={submitting}
                      >
                        {submitting ? "UPLOADING_SCORES..." : "EXECUTE_SUBMISSION"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[var(--surface-1)] border border-[var(--border)] border-dashed rounded-[4px] flex items-center justify-center py-32">
                    <span className="t-label italic uppercase opacity-50 animate-pulse">Select a target node to begin evaluation protocol</span>
                  </div>
                )}
              </div>

            </div>

            {/* Resume Upload Section */}
            <div className="mb-[64px] max-w-[500px]">
               <div className="t-section uppercase mb-3">Evaluator Credentials</div>
               <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-6">
                  <ResumeUpload 
                    role="judge" 
                    eventId={event?.id}
                    existingProfile={judgeProfile || undefined}
                    onUploadComplete={(analysis) => setJudgeProfile(analysis)}
                  />
               </div>
            </div>
          </div>

          {/* 5.10 Bottom Status Bar */}
          <div className="h-[32px] mt-auto flex-shrink-0 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center">
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center t-micro uppercase">
              <span className="text-[var(--signal-ping)] mr-2">●</span> SCORING_LINK_UP
            </div>
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center t-micro uppercase">
              <span className="text-[var(--signal-info)] mr-2">●</span> AI_SYNC_NOMINAL
            </div>
            <div className="flex-1 flex items-center justify-center t-micro uppercase">
              <span className="text-[var(--signal-clean)] mr-2">●</span> STATION_SECURE
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}