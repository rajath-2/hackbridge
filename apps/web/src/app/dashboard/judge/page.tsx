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

  if (loading) return (
    <div className="min-h-screen dashboard-root flex items-center justify-center">
      <span className="text-[14px] text-[var(--hb-muted)] animate-hb-pulse">Loading Judge Dashboard...</span>
    </div>
  )

  return (
    <div className="min-h-screen dashboard-root">
      <NavBar eventDropdown={allEvents.length > 0 ? eventDropdown : undefined} eventCode={event?.event_code} role="judge" />

      <main className="max-w-[1200px] mx-auto px-6 py-8">

        {/* Round Indicator */}
        <div className="flex items-center justify-between bg-[var(--hb-surface2)] border border-[var(--hb-border)] rounded-[8px] p-3 px-4 mb-6">
          <div className="flex items-center gap-3">
            <Badge variant="cyan">Round 1</Badge>
            <span className="text-[13px] font-medium text-[var(--hb-text)]">{event?.name || "No event loaded"}</span>
          </div>
          <div className="text-[12px] font-mono text-[var(--hb-cyan)]">
            {teams.length} teams · Live Scoring
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Team Queue - 30% */}
          <div className="flex flex-col gap-2">
            <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-1">
              Team Queue
            </div>
            <div className="flex flex-col gap-1.5">
              {teams.length > 0 ? teams.map(team => (
                <div
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`px-3 py-2 border rounded-[6px] cursor-pointer flex justify-between items-center ${selectedTeam?.id === team.id
                      ? "bg-[rgba(79,98,216,0.1)] border-[var(--hb-indigo-glow)]"
                      : "bg-[var(--hb-surface2)] border-[var(--hb-border)] hover:border-[var(--hb-border2)]"
                    }`}
                >
                  <span className={`text-[12px] font-medium ${selectedTeam?.id === team.id ? "text-[var(--hb-text)]" : "text-[var(--hb-muted)]"}`}>
                    {team.name}
                  </span>
                  {selectedTeam?.id === team.id && <Badge variant="indigo">Active</Badge>}
                </div>
              )) : (
                <div className="text-[11px] text-[var(--hb-muted)] italic p-4 text-center">
                  No teams found for this event.
                </div>
              )}
            </div>
          </div>

          {/* Scoring Panel - 70% */}
          <div className="lg:col-span-2 flex flex-col gap-2">
            <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-1">
              Scoring Panel - {selectedTeam?.name || "Select a team"}
            </div>

            {selectedTeam ? (
              <Card variant="base" className="flex flex-col gap-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-[16px] font-semibold text-[var(--hb-text)]">AI Evaluation</h2>
                    <p className="text-[11px] text-[var(--hb-muted)]">Based on repo fingerprint and commit history</p>
                  </div>
                  <Badge variant="indigo">Groq · llama3-70b</Badge>
                </div>

                <div>
                  {aiAnalysis?.scores ? (
                    Object.entries(aiAnalysis.scores).map(([crit, val]: [string, any]) => (
                      <ScoreBar key={crit} criterion={crit} score={val} />
                    ))
                  ) : (
                    <>
                      <ScoreBar criterion="Code Quality" score={0} />
                      <ScoreBar criterion="Complexity" score={0} />
                      <ScoreBar criterion="Completion" score={0} />
                    </>
                  )}
                </div>

                <Card variant="ai">
                  {aiAnalysis?.evaluation || "Waiting for AI analysis... Select a team to begin."}
                </Card>

                <div className="pt-4 border-t border-[var(--hb-border)]">
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handleSubmitScore}
                    disabled={submitting}
                  >
                    {submitting ? "Submitting..." : "Submit Scores"}
                  </Button>
                </div>
              </Card>
            ) : (
              <Card variant="base" className="flex items-center justify-center py-20 text-[var(--hb-muted)] text-[12px] italic">
                Select a team from the queue to start scoring
              </Card>
            )}
          </div>

        </div>

        {/* Resume Upload */}
        <div className="mb-8 max-w-[480px]">
          <ResumeUpload role="judge" />
        </div>

        {/* Notification Feed */}
        <section>
          <NotificationFeed
            notifications={(liveNotifications || []).map(n => ({
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