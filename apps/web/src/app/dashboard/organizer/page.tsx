"use client"

import { useState, useEffect } from "react"
import { NavBar } from "@/components/dashboard/NavBar"
import { NotificationFeed } from "@/components/dashboard/NotificationFeed"
import { StatCard } from "@/components/ui/StatCard"
import { RiskFlagRow } from "@/components/ui/RiskFlagRow"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { JudgingRoundForm } from "@/components/ui/JudgingRoundForm"
import { Plus, Trash2 } from "lucide-react"
import { api } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { useNotifications } from "@/hooks/useNotifications"

interface Flag {
  id: string | number;
  teams: { name: string };
  flag_type: "plagiarism" | "track_deviation";
  risk_level?: "High" | "Medium" | "Clean";
  alignment_score?: number;
  evidence?: string;
  alignment_rationale?: string;
  silenced?: boolean;
}

interface MatchSuggestion {
  id: string;
  teams: { name: string };
  current_mentor?: { name: string };
  suggested_mentor: { name: string };
  current_match_score: number;
  suggested_match_score: number;
  rationale: string;
}

export default function OrganizerDashboard() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [activeTab, setActiveTab] = useState<"plagiarism" | "track_drift">("plagiarism");
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<any[]>([]);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [event, setEvent] = useState<any>(null);
  const [isCreatingNewEvent, setIsCreatingNewEvent] = useState(false);
  const [user, setUser] = useState<any>(null);

  // New Event Form State
  const [eventName, setEventName] = useState("");
  const [eventCode, setEventCode] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [tracks, setTracks] = useState<string[]>(["General"]);
  const [rounds, setRounds] = useState<any[]>([
    { round: 1, criteria: [{ name: "Innovation", description: "", weight: 1.0 }] }
  ]);

  const notifications = useNotifications(event?.id, user?.id, "organizer");


  const loadEventData = async (activeEvent: any) => {
    if (!activeEvent) {
      setEvent(null);
      return;
    }
    setEvent(activeEvent);
    setIsCreatingNewEvent(false);
    try {
      const flagsData = await api.get(`/integrity/flags/event/${activeEvent.id}`)
      setFlags(flagsData)

      const suggestionsData = await api.get(`/mentor-match/suggestions/event/${activeEvent.id}`)
      setSuggestions(suggestionsData)

      const teamsData = await api.get(`/teams/event/${activeEvent.id}`)
      setTeams(teamsData)
    } catch (error) {
      console.error("Failed to load event data:", error)
    }
  }

  const fetchInitialData = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      const events = await api.get("/events/all")
      setAllEvents(events || [])
      
      if (events && events.length > 0) {
        await loadEventData(events[0])
      } else {
        setEvent(null)
      }
    } catch (error) {
      console.error("Failed to fetch initial data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInitialData()
  }, [])

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName || !eventCode || !startTime || !endTime) {
      alert("Please fill in all basic event details.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        event_code: eventCode,
        name: eventName,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        tracks: tracks.filter(t => t.trim() !== ""),
        judging_rounds: rounds.map(r => ({
          ...r,
          start: r.start ? new Date(r.start).toISOString() : undefined,
          end: r.end ? new Date(r.end).toISOString() : undefined,
        }))
      };
      
      await api.post("/events/", payload);
      setIsCreatingNewEvent(false);
      await fetchInitialData(); 
    } catch (err) {
      console.error("Failed to create event:", err);
      alert("Failed to create event. Check console for details.");
    } finally {
      setLoading(false);
    }
  }

  const addTrack = () => setTracks([...tracks, ""]);
  const removeTrack = (index: number) => {
    const newTracks = [...tracks];
    newTracks.splice(index, 1);
    setTracks(newTracks);
  }
  const updateTrack = (index: number, val: string) => {
    const newTracks = [...tracks];
    newTracks[index] = val;
    setTracks(newTracks);
  }

  const addRound = () => setRounds([...rounds, { 
    round: rounds.length + 1, 
    criteria: [{ name: "", description: "", weight: 1.0 }] 
  }]);
  const removeRound = (index: number) => {
    const newRounds = [...rounds];
    newRounds.splice(index, 1);
    // Re-index rounds
    const indexedRounds = newRounds.map((r, i) => ({ ...r, round: i + 1 }));
    setRounds(indexedRounds);
  }
  const updateRound = (index: number, data: any) => {
    const newRounds = [...rounds];
    newRounds[index] = data;
    setRounds(newRounds);
  }

  const handleSweep = async () => {
    if (!event) return;
    setLoading(true);
    try {
      await api.post(`/integrity/sweep/event/${event.id}`, { trigger: "manual_organizer" })
      await loadEventData(event)
    } catch (err) {
      console.error("Sweep failed:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleMatchScan = async () => {
    if (!event) return;
    setLoading(true)
    try {
      await api.post(`/mentor-match/event/${event.id}/run-all`, { trigger_stage: "manual" })
      await loadEventData(event)
    } catch (err) {
      console.error("Match scan failed:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSilence = (id: string | number) => {
    setFlags(flags.map(f => f.id === id ? { ...f, silenced: true } : f));
  }

  const handleBroadcast = async () => {
    if (!broadcastMsg || !event) return;
    try {
      await api.post('/notifications/broadcast', { event_id: event.id, message: broadcastMsg });
      setBroadcastMsg("");
    } catch (err) {
      console.error("Failed to broadcast:", err);
    }
  }

  const safeNotifs = Array.isArray(notifications) ? notifications : [];
  const mentorPingsCount = safeNotifs.filter(n => n.type === 'mentor_ping').length;
  const activeFlagsCount = flags.filter(f => !f.silenced).length;

  if (loading) {
    return (
      <div className="min-h-screen dashboard-root flex items-center justify-center">
        <span className="text-[14px] text-[var(--hb-muted)] animate-hb-pulse">Loading Organizer Dashboard...</span>
      </div>
    );
  }

  const eventDropdown = (
    <Select 
      className="w-auto font-mono text-[11px] h-6 py-0 bg-[rgba(99,115,210,0.1)] text-[var(--hb-indigo-bright)] border-[var(--hb-indigo-dim)] cursor-pointer"
      value={isCreatingNewEvent ? "new" : (event?.id || "new")}
      onChange={(e) => {
        if (e.target.value === "new") {
          setIsCreatingNewEvent(true);
          setEvent(null);
        } else {
          const selected = allEvents.find(ev => ev.id === e.target.value);
          if (selected) loadEventData(selected);
        }
      }}
    >
      {allEvents.map(ev => (
        <option key={ev.id} value={ev.id}>{ev.event_code}</option>
      ))}
      <option value="new">+ Create New Event</option>
    </Select>
  );

  if (!loading && (!event || isCreatingNewEvent)) {
    return (
      <div className="min-h-screen dashboard-root">
        <NavBar role="organizer" eventDropdown={allEvents.length > 0 ? eventDropdown : undefined} />
        <main className="max-w-[800px] mx-auto px-6 py-12">
          <Card variant="elevated" className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[24px] font-bold text-[var(--hb-text)]">Event Setup</h2>
              {allEvents.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setIsCreatingNewEvent(false)}>Cancel</Button>
              )}
            </div>
            
            <form onSubmit={handleCreateEvent} className="flex flex-col gap-10">
              {/* Basic Info */}
              <div className="space-y-5">
                <div className="text-[12px] text-[var(--hb-indigo-bright)] uppercase font-bold tracking-widest border-b border-[var(--hb-border2)] pb-2">
                  Event Details
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2">
                    <label className="block text-[12px] text-[var(--hb-muted)] mb-1.5 font-medium">Event Name</label>
                    <Input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. HackBridge Global 2026" required className="h-11 text-[14px]" />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--hb-muted)] mb-1.5 font-medium">Event Code</label>
                    <Input value={eventCode} onChange={e => setEventCode(e.target.value.toUpperCase())} placeholder="HACK26" required className="h-11 text-[14px] font-mono tracking-wider" />
                    <p className="text-[11px] text-[var(--hb-dim)] mt-1">Share this code with participants, mentors & judges</p>
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--hb-muted)] mb-1.5 font-medium">Tracks</label>
                    <div className="flex flex-wrap gap-1.5 min-h-[44px] items-center bg-[var(--hb-surface3)] border border-[var(--hb-border)] rounded-[8px] px-3 py-2">
                      {tracks.filter(t => t.trim()).map((t, i) => (
                        <span key={i} className="text-[11px] bg-[var(--hb-indigo-dim)] text-[var(--hb-indigo-bright)] px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                      {tracks.filter(t => t.trim()).length === 0 && <span className="text-[11px] text-[var(--hb-dim)] italic">Add tracks below</span>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--hb-muted)] mb-1.5 font-medium">Start Date & Time</label>
                    <Input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} required className="h-11 text-[13px]" />
                  </div>
                  <div>
                    <label className="block text-[12px] text-[var(--hb-muted)] mb-1.5 font-medium">End Date & Time</label>
                    <Input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} required className="h-11 text-[13px]" />
                  </div>
                </div>
              </div>

              {/* Tracks */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-[var(--hb-border2)] pb-2">
                  <div className="text-[12px] text-[var(--hb-indigo-bright)] uppercase font-bold tracking-widest">
                    Tracks
                  </div>
                  <Button variant="secondary" size="sm" type="button" onClick={addTrack} className="h-7 py-0 text-[11px]">
                    <Plus size={12} /> Add Track
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {tracks.map((track, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input value={track} onChange={e => updateTrack(idx, e.target.value)} placeholder="e.g. AI/ML, Web3, Healthcare" className="flex-1 h-10 text-[13px]" />
                      <Button variant="ghost" size="sm" type="button" onClick={() => removeTrack(idx)} className="text-[var(--hb-red)] h-10">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Judging Rounds */}
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-[var(--hb-border2)] pb-2">
                  <div className="text-[12px] text-[var(--hb-indigo-bright)] uppercase font-bold tracking-widest">
                    Judging Rounds & Rubrics
                  </div>
                  <Button variant="secondary" size="sm" type="button" onClick={addRound} className="h-7 py-0 text-[11px]">
                    <Plus size={12} /> Add Round
                  </Button>
                </div>
                
                {rounds.map((round, idx) => (
                  <JudgingRoundForm 
                    key={idx}
                    data={round}
                    onChange={(data) => updateRound(idx, data)}
                    onRemove={() => removeRound(idx)}
                  />
                ))}
              </div>
              
              <Button variant="primary" type="submit" disabled={loading} className="mt-6 h-14 text-[16px] font-semibold shadow-[0_0_20px_rgba(79,98,216,0.3)]">
                {loading ? "Creating Event..." : "Create Event"}
              </Button>
            </form>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen dashboard-root">
      <NavBar eventDropdown={eventDropdown} role="organizer" />
      
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Header Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard label="Teams" value={teams.length.toString()} sub={`${teams.filter(t => !t.repo_url).length} pending setup`} />
          <StatCard label="Active Pings" value={<span className="text-[var(--hb-indigo-bright)]">{mentorPingsCount}</span>} sub="Mentors responding" />
          <StatCard label="Risk Flags" value={<span className="text-[var(--hb-red)]">{activeFlagsCount}</span>} sub="Requiring attention" />
        </div>

        {/* Broadcast Composer */}
        <div className="mb-8 flex gap-3">
          <Input 
            placeholder="Type a broadcast message to all participants..." 
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleBroadcast()}
            className="h-12 text-[14px]"
          />
          <Button variant="primary" onClick={handleBroadcast} className="h-12 px-8 text-[14px]">Send</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
          {/* Integrity Watchlist (v1.5) */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <div className="flex justify-between items-end mb-1">
              <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] font-semibold">
                Integrity Watchlist
              </div>
              <Button variant="secondary" size="sm" onClick={handleSweep} disabled={loading}>
                {loading ? "Sweeping..." : "Run Pre-Round Sweep"}
              </Button>
            </div>

            <div className="flex gap-2 mb-2">
              <button 
                onClick={() => setActiveTab("plagiarism")}
                className={`text-[11px] px-3 py-1 rounded-[4px] ${activeTab === "plagiarism" ? "bg-[var(--hb-surface3)] text-[var(--hb-text)]" : "text-[var(--hb-muted)] hover:text-[var(--hb-text)]"}`}
              >
                Plagiarism
              </button>
              <button 
                onClick={() => setActiveTab("track_drift")}
                className={`text-[11px] px-3 py-1 rounded-[4px] ${activeTab === "track_drift" ? "bg-[var(--hb-surface3)] text-[var(--hb-text)]" : "text-[var(--hb-muted)] hover:text-[var(--hb-text)]"}`}
              >
                Track Drift
              </button>
            </div>

            {flags.filter(f => activeTab === "plagiarism" ? f.flag_type === "plagiarism" : f.flag_type === "track_deviation").map((flag) => (
              <div key={flag.id} className="relative group">
                {flag.flag_type === "plagiarism" ? (
                  <RiskFlagRow 
                    teamName={flag.teams.name}
                    evidence={flag.evidence || ""}
                    riskLevel={flag.risk_level as "High" | "Medium" | "Clean"}
                    className={flag.silenced ? "opacity-50" : ""}
                  />
                ) : (
                  <div className={`flex items-center justify-between px-2.5 py-1.5 bg-[var(--hb-surface2)] rounded-[6px] mb-1.5 border border-[var(--hb-border)] ${flag.silenced ? "opacity-50" : ""}`}>
                    <div>
                      <div className="text-[11px] font-medium text-[var(--hb-text)]">{flag.teams.name}</div>
                      <div className="text-[10px] text-[var(--hb-muted)]">{flag.alignment_rationale}</div>
                    </div>
                    <div className="text-[11px] font-mono text-[var(--hb-amber)]">Score: {flag.alignment_score}/100</div>
                  </div>
                )}
                {!flag.silenced && (
                  <button onClick={() => handleSilence(flag.id)} className="absolute right-[-60px] top-1/2 -translate-y-1/2 text-[10px] text-[var(--hb-muted)] hover:text-[var(--hb-text)] opacity-0 group-hover:opacity-100 transition-opacity">
                    Silence
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Mentor Stats */}
          <div className="lg:col-span-2 flex flex-col gap-2">
            <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-1 font-semibold">
              Mentor Pings
            </div>
            <Card variant="base">
              <div className="flex justify-between items-center py-1 border-b border-[var(--hb-border)] mb-2">
                <span className="text-[11px] text-[var(--hb-text)]">Total requests today</span>
                <span className="text-[11px] text-[var(--hb-text)] font-semibold">{mentorPingsCount}</span>
              </div>

              {safeNotifs.filter(n => n.type === 'mentor_ping').slice(0, 5).map((ping, i) => {
                const team = teams.find(t => t.id === ping.team_id);
                return (
                  <div key={i} className="flex justify-between items-center py-1">
                    <span className="text-[11px] text-[var(--hb-text)]">{team?.name || 'Unknown Team'}</span>
                    <span className="text-[11px] text-[var(--hb-muted)] truncate max-w-[120px]">{ping.message}</span>
                  </div>
                );
              })}
              {mentorPingsCount === 0 && (
                 <div className="text-[11px] text-[var(--hb-muted)] text-center py-2">No active pings.</div>
              )}
            </Card>
          </div>
        </div>

        {/* Matching Optimization Panel (v1.5) */}
        <div className="mb-6">
          <div className="flex justify-between items-end mb-2">
            <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] font-semibold">
              Matching Optimization
            </div>
            <Button variant="secondary" size="sm" onClick={handleMatchScan}>
              Run Matching Scan
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestions.map(sugg => (
              <Card key={sugg.id} variant="elevated" className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-[12px] font-semibold text-[var(--hb-text)]">{sugg.teams.name}</span>
                  <div className="text-[10px] bg-[rgba(99,115,210,0.1)] text-[var(--hb-indigo-bright)] px-1.5 py-0.5 rounded">
                    +{sugg.suggested_match_score - sugg.current_match_score} pts
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] mb-2">
                  <div className="bg-[var(--hb-surface3)] p-2 rounded border border-[var(--hb-border)]">
                    <div className="text-[var(--hb-muted)] mb-1">Current</div>
                    <div className="text-[var(--hb-text)]">{sugg.current_mentor?.name || "None"} ({sugg.current_match_score}%)</div>
                  </div>
                  <div className="bg-[rgba(110,231,160,0.05)] p-2 rounded border border-[var(--hb-green-dim)]">
                    <div className="text-[var(--hb-muted)] mb-1">Suggested</div>
                    <div className="text-[var(--hb-green)]">{sugg.suggested_mentor.name} ({sugg.suggested_match_score}%)</div>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--hb-muted)] italic mb-2">
                  "{sugg.rationale}"
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" className="flex-1 text-[11px] h-7">Approve Swap</Button>
                  <Button variant="ghost" className="flex-1 text-[11px] h-7">Keep Current</Button>
                </div>
              </Card>
            ))}
            {suggestions.length === 0 && (
              <div className="col-span-2 text-center text-[11px] text-[var(--hb-muted)] py-4">
                No active matching suggestions. Run a scan to evaluate assignments.
              </div>
            )}
          </div>
        </div>

        {/* Final Placement */}
        <div className="mb-10">
          <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-3 font-semibold">
            Final Placement
          </div>
          <Card variant="elevated" className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-[12px] text-[var(--hb-muted)] mb-1.5 font-medium">🥇 1st Place</label>
                <Select>
                  <option value="">Select team...</option>
                  {teams.map(t => <option key={`1-${t.id}`} value={t.id}>{t.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-[12px] text-[var(--hb-muted)] mb-1.5 font-medium">🥈 2nd Place</label>
                <Select>
                  <option value="">Select team...</option>
                  {teams.map(t => <option key={`2-${t.id}`} value={t.id}>{t.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-[12px] text-[var(--hb-muted)] mb-1.5 font-medium">🥉 3rd Place</label>
                <Select>
                  <option value="">Select team...</option>
                  {teams.map(t => <option key={`3-${t.id}`} value={t.id}>{t.name}</option>)}
                </Select>
              </div>
            </div>
            <Button variant="primary" className="w-full h-12 text-[14px]">Confirm Winners</Button>
          </Card>
        </div>

        {/* Notification Feed — inline */}
        <section className="mb-8">
          <NotificationFeed 
            notifications={safeNotifs.map(n => ({
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