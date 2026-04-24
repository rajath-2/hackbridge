"use client"

import { useState, useEffect } from "react"
import { NavBar } from "@/components/dashboard/NavBar"
import { NotificationFeed } from "@/components/dashboard/NotificationFeed"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ResumeUpload } from "@/components/ui/ResumeUpload"
import { ScoreBar } from "@/components/ui/ScoreBar"
import { Select } from "@/components/ui/select"
import { api } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { useNotifications } from "@/hooks/useNotifications"

export default function JudgeDashboard() {
  const [allEvents, setAllEvents] = useState<any[]>([])
  const [event, setEvent] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)

  // useNotifications returns the array directly
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
        setUser(authUser)

        const eventsData = await api.get("/events/all")
        setAllEvents(eventsData || [])
        if (eventsData?.length > 0) {
          await loadEventData(eventsData[0])
        }
      } catch (error) {
        console.error("Failed to fetch initial data:", error)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

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
      alert("Failed to submit scores. Check console for details.")
    } finally {
      setSubmitting(false)
    }
  }

  const eventDropdown = (
    <Select
      className="w-auto font-mono text-[11px] h-6 py-0 bg-[rgba(99,115,210,0.1)] text-[var(--hb-indigo-bright)] border-[var(--hb-indigo-dim)] cursor-pointer"
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

  return (
    <div className="min-h-screen flex flex-col bg-[var(--void)] font-body">
      {/* Live Ticker Bar */}
      <div className="h-[32px] bg-[rgba(255,184,0,0.08)] border-b border-[rgba(255,184,0,0.2)] overflow-hidden flex items-center w-full">
        <div className="ticker-track whitespace-nowrap flex items-center">
          {[...tickerContent, ...tickerContent, ...tickerContent].map((item, i) => (
            <span key={i} className="font-ui text-[10px] text-[var(--signal-ping)] uppercase tracking-[0.1em] mx-4">
              <span className="mr-2">{item.type === 'SCORE' ? '●' : (item.type === 'AI_NODE' ? '⚑' : '◎')}</span>
              {item.type} {item.id} · {item.team} · {item.msg}
              <span className="ml-8 opacity-30">·····</span>
            </span>
          ))}
        </div>
      </div>

      <NavBar eventDropdown={allEvents.length > 0 ? eventDropdown : undefined} eventCode={event?.event_code} role="judge" />
      
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-96px)]">
        {/* Sidebar (240px) */}
        <aside className="w-[240px] flex-shrink-0 bg-[var(--surface-1)] border-r border-[var(--border)] hidden lg:flex flex-col sticky top-0 h-full overflow-y-auto">
          <div className="py-5 px-6 font-ui text-[9px] text-[var(--text-muted)] tracking-[0.2em] uppercase">Judging Station</div>
          <div className="px-6 py-2 flex items-center text-[var(--text-primary)] border-l-4 border-[var(--signal-ping)] bg-[rgba(255,184,0,0.04)] font-ui text-[12px] h-[40px] cursor-pointer transition-all">
            Scoring Matrix
          </div>
          <div className="px-6 py-2 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)] font-ui text-[12px] h-[40px] cursor-pointer border-l-4 border-transparent transition-all">
            Team Roster
          </div>
          <div className="px-6 py-2 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)] font-ui text-[12px] h-[40px] cursor-pointer border-l-4 border-transparent transition-all">
            Historical Scores
          </div>
          
          <div className="mt-8 py-2 px-6 font-ui text-[9px] text-[var(--text-muted)] tracking-[0.2em] uppercase">Verification</div>
          <div className="px-6 py-2 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)] font-ui text-[12px] h-[40px] cursor-pointer border-l-4 border-transparent transition-all">
            Credentials
          </div>

          <div className="mt-8 mb-4">
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

          <div className="mt-auto p-6">
             <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] p-4 flex flex-col gap-2">
                <div className="font-ui text-[9px] text-[var(--text-muted)] uppercase tracking-widest">Station ID</div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[var(--signal-ping)] animate-pulse" />
                  <span className="font-ui text-[11px] text-[var(--text-primary)]">JDG-ALPHA-01</span>
                </div>
             </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-[720px] flex flex-col h-full overflow-y-auto">
          
          {/* CLI Status Bar */}
          <div className="h-[40px] flex-shrink-0 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center justify-between px-6">
            <div className="font-display text-[12px] text-[var(--text-code)]">
              $ hackbridge judge --event={event?.event_code || "VOID"} --round=1
              <span className="cli-cursor text-[var(--signal-ping)] inline-block w-[6px] h-[14px] bg-[var(--signal-ping)] align-middle ml-1"></span>
            </div>
            <div className="font-ui text-[11px] text-[var(--signal-ping)] border border-[var(--signal-ping)] rounded-[3px] px-2.5 py-1 uppercase tracking-tight">
              LIVE_SCORING
            </div>
            <div className="font-ui text-[11px] text-[var(--text-secondary)]">
              Station Encrypted · Round 1 Protocol
            </div>
          </div>

          <div className="p-[32px_40px] flex flex-col flex-1">
            {/* Page Header */}
            <div className="mb-[32px] border-b border-[var(--border)] pb-6">
              <div className="font-ui text-[10px] text-[var(--text-muted)] tracking-[0.18em] uppercase mb-1">
                EVALUATOR · DASHBOARD
              </div>
              <h1 className="font-display text-[48px] font-bold text-[var(--text-primary)] leading-none mb-2 tracking-tight">
                JUDGING STATION
              </h1>
              <div className="font-body text-[13px] text-[var(--text-secondary)]">
                {event?.name || "Initializing..."} · {teams.length} Nodes in Queue · Round 1 active
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px] mb-[24px]">
              
              {/* Team Queue - 30% */}
              <div className="lg:col-span-4 flex flex-col gap-2">
                <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase mb-1">
                  Node Queue
                </div>
                <div className="flex flex-col gap-2">
                  {teams.length > 0 ? teams.map(team => (
                    <div
                      key={team.id}
                      onClick={() => setSelectedTeam(team)}
                      className={`p-4 border rounded-[4px] cursor-pointer flex justify-between items-center transition-all ${selectedTeam?.id === team.id
                          ? "bg-[rgba(255,184,0,0.06)] border-[var(--signal-ping)] shadow-[0_0_15px_rgba(255,184,0,0.1)]"
                          : "bg-[var(--surface-1)] border-[var(--border)] hover:border-[var(--border-hot)]"
                        }`}
                    >
                      <div className="flex flex-col">
                        <span className={`font-ui text-[14px] font-bold ${selectedTeam?.id === team.id ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                          {team.name}
                        </span>
                        <span className="font-body text-[10px] text-[var(--text-muted)] uppercase">{team.team_code}</span>
                      </div>
                      {selectedTeam?.id === team.id && (
                        <span className="font-ui text-[9px] px-1.5 py-0.5 bg-[var(--signal-ping)] text-[var(--void)] font-bold rounded-[2px]">ACTIVE</span>
                      )}
                    </div>
                  )) : (
                    <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-8 text-center">
                      <span className="font-body text-[12px] text-[var(--text-muted)] italic">No nodes detected in this sector.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Scoring Panel - 70% */}
              <div className="lg:col-span-8 flex flex-col gap-2">
                <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase mb-1">
                  Evaluation Terminal - {selectedTeam?.name || "AWAITING_SELECTION"}
                </div>

                {selectedTeam ? (
                  <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-6 flex flex-col gap-8">
                    <div className="flex justify-between items-start border-b border-[var(--border)] pb-6">
                      <div>
                        <h2 className="font-display text-[20px] font-bold text-[var(--text-primary)]">AI_SYNERGY_ANALYSIS</h2>
                        <p className="font-body text-[12px] text-[var(--text-muted)] mt-1">Llama 3 cross-referenced commit architecture</p>
                      </div>
                      <div className="font-ui text-[10px] text-[var(--signal-info)] border border-[var(--signal-info)] rounded-[3px] px-2 py-1 uppercase font-bold tracking-widest">
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
                       <span className="absolute -top-2 left-4 px-2 bg-[var(--surface-1)] font-ui text-[9px] text-[var(--text-muted)] uppercase tracking-widest">AI_COMMENTARY</span>
                       &ldquo;{aiAnalysis?.evaluation || "Scanning team repository... Analyzing code complexity and track alignment. Please hold."}&rdquo;
                    </div>

                    <div className="pt-6 border-t border-[var(--border)] flex flex-col gap-4">
                      <div className="flex flex-col gap-2">
                         <label className="font-ui text-[10px] text-[var(--text-muted)] uppercase tracking-widest">Evaluator Notes</label>
                         <textarea className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] p-3 font-body text-[13px] text-[var(--text-primary)] h-24 focus:border-[var(--signal-ping)] outline-none" placeholder="Enter manual feedback here..."></textarea>
                      </div>
                      <Button
                        variant="primary"
                        className="w-full h-14 font-bold text-[14px] tracking-[0.1em]"
                        onClick={handleSubmitScore}
                        disabled={submitting}
                      >
                        {submitting ? "UPLOADING_SCORES..." : "EXECUTE_SUBMISSION"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] flex items-center justify-center py-32">
                    <span className="font-body text-[13px] text-[var(--text-muted)] italic uppercase tracking-widest animate-pulse">Select a target node to begin evaluation protocol</span>
                  </div>
                )}
              </div>

            </div>

            {/* Resume Upload Section */}
            <div className="mb-[64px] max-w-[500px]">
               <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase mb-3">
                  Evaluator Credentials
               </div>
               <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-6">
                  <ResumeUpload role="judge" />
               </div>
            </div>


          </div>

          {/* Bottom Status Bar */}
          <div className="h-[32px] mt-auto flex-shrink-0 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center">
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center font-ui text-[10px] text-[var(--text-muted)]">
              <span className="text-[var(--signal-ping)] mr-2">●</span> SCORING_LINK_UP
            </div>
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center font-ui text-[10px] text-[var(--text-muted)]">
              <span className="text-[var(--signal-info)] mr-2">●</span> AI_SYNC_NOMINAL
            </div>
            <div className="flex-1 flex items-center justify-center font-ui text-[10px] text-[var(--text-muted)]">
              <span className="text-[var(--signal-clean)] mr-2">●</span> STATION_SECURE
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}