"use client"

import { useState, useEffect } from "react"
import { NavBar } from "@/components/dashboard/NavBar"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResumeUpload } from "@/components/ui/ResumeUpload"
import { ScoreBar } from "@/components/ui/ScoreBar"
import { Select } from "@/components/ui/select"
import { api } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"

import { LayoutGrid, Users, History, FileBadge } from "lucide-react"

export default function JudgeDashboard() {
  const [allEvents, setAllEvents] = useState<any[]>([])
  const [event, setEvent] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [editableScores, setEditableScores] = useState<any>({})
  const [hasJoinedEvent, setHasJoinedEvent] = useState(false)
  const [eventCode, setEventCode] = useState("")
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState("")
  const [judgeProfile, setJudgeProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<"scoring" | "roster" | "history">("scoring")
  const [historyScores, setHistoryScores] = useState<any[]>([])
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null)




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
          role: "judge"
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
      if (suggestion?.rubric_scores) {
        setEditableScores(suggestion.rubric_scores)
      } else {
        setEditableScores({})
      }
    } catch (err) {
      console.error("AI suggestion failed:", err)
      setAiAnalysis(null)
      setEditableScores({})
    }
  }

  useEffect(() => {
    if (selectedTeam) {
      fetchAiSuggestion(selectedTeam.id)
    }
  }, [selectedTeam])

  useEffect(() => {
    const fetchHistory = async () => {
      if (activeTab === "history" && user && event) {
        const supabase = createClient()
        const { data } = await supabase
          .from("scores")
          .select("*, teams(name, team_code)")
          .eq("judge_id", user.id)
          .eq("event_id", event.id)
          .order("created_at", { ascending: false })
        if (data) setHistoryScores(data)
      }
    }
    fetchHistory()
  }, [activeTab, user, event])

  const handleSubmitScore = async () => {
    if (!selectedTeam || !event) return;
    setSubmitting(true)
    try {
      await api.post("/scores/", {
        team_id: selectedTeam.id,
        event_id: event.id,
        round: 1,
        rubric_scores: Object.keys(editableScores).length > 0 ? editableScores : { "Code Quality": 8, "Complexity": 7, "Completion": 8 },
        notes: `Scores submitted via Judge Dashboard.`
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
          <Button 
            variant="ghost" 
            onClick={() => setActiveTab("scoring")}
            className={`px-6 justify-start rounded-none h-[40px] border-l-[3px] font-ui text-[12px] uppercase tracking-wider ${activeTab === 'scoring' ? "text-[var(--text-primary)] border-[var(--signal-ping)] bg-[var(--signal-ping)]/5" : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5"}`}
          >
            <LayoutGrid size={14} />
            Scoring Matrix
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => setActiveTab("roster")}
            className={`px-6 justify-start rounded-none h-[40px] border-l-[3px] font-ui text-[12px] uppercase tracking-wider ${activeTab === 'roster' ? "text-[var(--text-primary)] border-[var(--signal-ping)] bg-[var(--signal-ping)]/5" : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5"}`}
          >
            <Users size={14} />
            Team Roster
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => setActiveTab("history")}
            className={`px-6 justify-start rounded-none h-[40px] border-l-[3px] font-ui text-[12px] uppercase tracking-wider ${activeTab === 'history' ? "text-[var(--text-primary)] border-[var(--signal-ping)] bg-[var(--signal-ping)]/5" : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5"}`}
          >
            <History size={14} />
            Historical Scores
          </Button>




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
              
              {/* Scoring View */}
              {activeTab === "scoring" && (
                <>
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
                          {Object.keys(editableScores).length > 0 ? (
                            Object.entries(editableScores).map(([crit, val]: [string, any]) => (
                              <ScoreBar 
                                key={crit} 
                                criterion={crit} 
                                score={val} 
                                onChange={(newScore) => setEditableScores((prev: any) => ({ ...prev, [crit]: newScore }))}
                              />
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
                           &ldquo;{aiAnalysis?.rationale || "Scanning team repository... Analyzing code complexity and track alignment. Please hold."}&rdquo;
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
                </>
              )}

              {/* Roster View */}
              {activeTab === "roster" && (
                <div className="col-span-12 flex flex-col gap-3">
                  <div className="t-section uppercase">Active Teams in Event</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {teams.map(team => (
                      <div 
                        key={team.id} 
                        onClick={() => setExpandedTeamId(prev => prev === team.id ? null : team.id)}
                        className="p-4 bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] flex flex-col gap-2 transition-all hover:border-[var(--border-hot)] cursor-pointer"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-ui text-[14px] font-bold uppercase text-[var(--text-primary)]">{team.name}</span>
                          {team.selected_track && (
                            <span className="t-micro bg-[var(--signal-ping)]/10 text-[var(--signal-ping)] px-2 py-0.5 rounded-[2px] w-fit">
                              {team.selected_track}
                            </span>
                          )}
                        </div>
                        <span className="t-micro uppercase opacity-50">{team.team_code}</span>
                        
                        {expandedTeamId === team.id && team.team_members && (
                          <div className="mt-3 pt-3 border-t border-[var(--border)] flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <span className="t-micro uppercase text-[var(--text-secondary)] opacity-70 mb-1">Roster Details</span>
                            {team.team_members.map((tm: any, i: number) => (
                              <div key={i} className="flex justify-between items-center text-[12px] font-body bg-[var(--surface-2)] p-2 rounded-[2px] border border-[var(--border)]">
                                <span className="text-[var(--text-primary)] font-bold">{tm.users?.name || "Unknown Hacker"}</span>
                                <span className="text-[var(--text-muted)] opacity-70">{tm.users?.email || "No Email"}</span>
                              </div>
                            ))}
                            {team.team_members.length === 0 && (
                               <span className="text-[12px] text-[var(--text-muted)] italic py-2">No members registered yet.</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* History View */}
              {activeTab === "history" && (
                <div className="col-span-12 flex flex-col gap-3">
                  <div className="t-section uppercase">Past Evaluations</div>
                  <div className="flex flex-col gap-2">
                    {historyScores.length > 0 ? historyScores.map(score => (
                      <div key={score.id} className="p-4 bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] flex flex-col gap-2">
                        <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
                          <span className="font-ui text-[14px] font-bold uppercase text-[var(--text-primary)]">{score.teams?.name}</span>
                          <span className="t-micro uppercase opacity-50">Round {score.round}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          {Object.entries(score.rubric_scores || {}).map(([c, v]: [string, any]) => (
                             <div key={c} className="flex justify-between items-center t-micro">
                               <span className="opacity-70">{c}</span>
                               <span className="font-bold text-[var(--signal-ping)] text-[12px]">{v}</span>
                             </div>
                          ))}
                        </div>
                        {score.notes && (
                          <div className="mt-2 text-[12px] text-[var(--text-secondary)] italic">"{score.notes}"</div>
                        )}
                      </div>
                    )) : (
                      <div className="p-8 text-center border border-dashed border-[var(--border)] rounded-[4px] text-[var(--text-muted)] italic">
                        NO_EVALUATIONS_FOUND
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Removed Resume Upload Section per request */}
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