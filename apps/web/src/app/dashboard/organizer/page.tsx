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
  const [mentors, setMentors] = useState<any[]>([]);
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

    const supabase = createClient()

    // Fetch flags — direct Supabase
    try {
      const { data: flagsData } = await supabase
        .from("integrity_flags")
        .select("*, teams(name)")
        .eq("event_id", activeEvent.id)
      setFlags(flagsData || [])
    } catch (error) {
      setFlags([])
    }

    // Fetch suggestions — direct Supabase
    try {
      const { data: suggestionsData } = await supabase
        .from("match_suggestions")
        .select("*, teams(name), current_mentor:current_mentor_id(name), suggested_mentor:suggested_mentor_id(name)")
        .eq("event_id", activeEvent.id)
        .eq("status", "pending")
      setSuggestions(suggestionsData || [])
    } catch (error) {
      setSuggestions([])
    }

    // Fetch teams — direct Supabase to bypass ownership check
    try {
      const { data: teamsData } = await supabase
        .from("teams")
        .select("*")
        .eq("event_id", activeEvent.id)
      setTeams(teamsData || [])
    } catch (error) {
      console.error("Failed to load teams:", error)
      setTeams([])
    }

    // Fetch mentors who joined this event
    try {
      const { data: participants } = await supabase
        .from("event_participants")
        .select("user_id")
        .eq("event_id", activeEvent.id)
      const pIds = (participants || []).map((p: any) => p.user_id)

      if (pIds.length > 0) {
        const { data: mentorUsers } = await supabase
          .from("users")
          .select("id, name, email, role")
          .eq("role", "mentor")
          .in("id", pIds)

        const { data: profiles } = await supabase
          .from("mentor_profiles")
          .select("user_id, expertise_tags")
          .in("user_id", pIds)

        const profileMap: Record<string, string[]> = {}
        ;(profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.expertise_tags || [] })

        const merged = (mentorUsers || []).map((u: any) => ({
          user_id: u.id,
          name: u.name,
          email: u.email,
          expertise_tags: profileMap[u.id] || []
        }))
        setMentors(merged)
      } else {
        setMentors([])
      }
    } catch (err) {
      console.error("Failed to fetch mentors:", err)
      setMentors([])
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
      <div className="min-h-screen flex flex-col bg-[var(--void)] font-body">
        <NavBar role="organizer" eventDropdown={allEvents.length > 0 ? eventDropdown : undefined} />
        
        <main className="flex-1 flex flex-col items-center justify-center p-6 bg-[rgba(99,115,210,0.02)]">
          <div className="w-full max-w-[800px] bg-[var(--surface-1)] border border-[var(--border-hot)] rounded-[4px] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="bg-[var(--surface-2)] border-b border-[var(--border-hot)] px-6 py-4 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="font-ui text-[10px] text-[var(--signal-info)] uppercase tracking-[0.2em]">System Initialization</span>
                <h2 className="font-display text-[20px] font-bold text-[var(--text-primary)]">EVENT CONFIGURATION</h2>
              </div>
              {allEvents.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setIsCreatingNewEvent(false)}>ABORT_SETUP</Button>
              )}
            </div>
            
            <div className="p-8">
              <form onSubmit={handleCreateEvent} className="flex flex-col gap-10">
                {/* Basic Info */}
                <div className="space-y-5">
                  <div className="font-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest border-b border-[var(--border)] pb-2">
                    01. IDENTITY & SCHEDULE
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="col-span-2">
                      <label className="block font-ui text-[11px] text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Event Designation</label>
                      <Input value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. HackBridge Global 2026" required className="h-11 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]" />
                    </div>
                    <div>
                      <label className="block font-ui text-[11px] text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Network Code</label>
                      <Input value={eventCode} onChange={e => setEventCode(e.target.value.toUpperCase())} placeholder="HACK26" required className="h-11 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] font-mono tracking-wider" />
                    </div>
                    <div>
                      <label className="block font-ui text-[11px] text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Active Tracks</label>
                      <div className="flex flex-wrap gap-1.5 min-h-[44px] items-center bg-[var(--surface-2)] border border-[var(--border)] rounded-[4px] px-3 py-2">
                        {tracks.filter(t => t.trim()).map((t, i) => (
                          <span key={i} className="text-[10px] bg-[rgba(58,158,191,0.15)] text-[var(--signal-info)] px-2 py-0.5 rounded-[2px] border border-[rgba(58,158,191,0.3)] font-ui uppercase">{t}</span>
                        ))}
                        {tracks.filter(t => t.trim()).length === 0 && <span className="text-[10px] text-[var(--text-muted)] italic">Awaiting track definition...</span>}
                      </div>
                    </div>
                    <div>
                      <label className="block font-ui text-[11px] text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Operational Start</label>
                      <Input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} required className="h-11 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] font-mono" />
                    </div>
                    <div>
                      <label className="block font-ui text-[11px] text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">Operational End</label>
                      <Input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} required className="h-11 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] font-mono" />
                    </div>
                  </div>
                </div>

                {/* Tracks */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
                    <div className="font-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest">
                      02. SECTOR DEFINITION
                    </div>
                    <Button variant="secondary" size="sm" type="button" onClick={addTrack} className="h-7 py-0 text-[10px]">
                      + ADD_TRACK
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {tracks.map((track, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input value={track} onChange={e => updateTrack(idx, e.target.value)} placeholder="e.g. AI/ML, Web3" className="flex-1 h-10 bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)]" />
                        <Button variant="ghost" size="sm" type="button" onClick={() => removeTrack(idx)} className="text-[var(--signal-alert)] h-10 border-[var(--border)]">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Judging Rounds */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-[var(--border)] pb-2">
                    <div className="font-ui text-[11px] text-[var(--text-muted)] uppercase tracking-widest">
                      03. EVALUATION MATRIX
                    </div>
                    <Button variant="secondary" size="sm" type="button" onClick={addRound} className="h-7 py-0 text-[10px]">
                      + ADD_ROUND
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
                
                <Button variant="primary" type="submit" disabled={loading} className="mt-6 h-14 text-[14px] font-bold tracking-[0.1em]">
                  {loading ? "INITIALIZING..." : "EXECUTE EVENT CREATION"}
                </Button>
              </form>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const tickerContent = [
    { type: "COMMIT", id: "a3f7d1", team: "ByteForce", msg: "feat: implement real-time analytics" },
    { type: "INTEGRITY", id: "⚑", team: "Team Cipher", msg: "HIGH RISK: Pattern mismatch" },
    { type: "PING", id: "◎", team: "DataNinjas", msg: "Mentor requested: Auth help" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--void)] font-body">
      {/* Live Ticker Bar */}
      <div className="h-[32px] bg-[rgba(0,255,194,0.08)] border-b border-[rgba(0,255,194,0.2)] overflow-hidden flex items-center w-full">
        <div className="ticker-track whitespace-nowrap flex items-center">
          {[...tickerContent, ...tickerContent, ...tickerContent].map((item, i) => (
            <span key={i} className="font-ui text-[10px] text-[var(--signal-live)] uppercase tracking-[0.1em] mx-4">
              <span className="mr-2">{item.type === 'COMMIT' ? '●' : (item.type === 'INTEGRITY' ? '⚑' : '◎')}</span>
              {item.type} {item.id} · {item.team} · {item.msg}
              <span className="ml-8 opacity-30">·····</span>
            </span>
          ))}
        </div>
      </div>

      <NavBar eventDropdown={eventDropdown} role="organizer" />
      
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-96px)]">
        {/* Sidebar (240px) */}
        <aside className="w-[240px] flex-shrink-0 bg-[var(--surface-1)] border-r border-[var(--border)] hidden lg:flex flex-col sticky top-0 h-full overflow-y-auto">
          <div className="py-5 px-6 font-ui text-[9px] text-[var(--text-muted)] tracking-[0.2em] uppercase">Control Panel</div>
          <div 
            onClick={() => { setActiveTab("plagiarism") }}
            className={`px-6 py-2 flex items-center h-[40px] cursor-pointer transition-all border-l-4 ${activeTab === 'plagiarism' ? "text-[var(--text-primary)] border-[var(--signal-live)] bg-[rgba(0,255,194,0.04)]" : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]"} font-ui text-[12px]`}
          >
            Overview
          </div>
          <div 
            onClick={() => { setActiveTab("track_drift") }}
            className={`px-6 py-2 flex items-center h-[40px] cursor-pointer transition-all border-l-4 ${activeTab === 'track_drift' ? "text-[var(--text-primary)] border-[var(--signal-live)] bg-[rgba(0,255,194,0.04)]" : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)]"} font-ui text-[12px]`}
          >
            Teams
            <span className="ml-auto font-ui text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]">{teams.length}</span>
          </div>
          <div className="px-6 py-2 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)] font-ui text-[12px] h-[40px] cursor-pointer border-l-4 border-transparent">
            Scores
          </div>
          
          <div className="mt-8 py-2 px-6 font-ui text-[9px] text-[var(--text-muted)] tracking-[0.2em] uppercase">Support</div>
          <div className="px-6 py-2 flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.03)] font-ui text-[12px] h-[40px] cursor-pointer border-l-4 border-transparent">
            Mentor Pings
            {mentorPingsCount > 0 && (
              <span className="ml-auto font-ui text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[rgba(255,184,0,0.15)] text-[var(--signal-ping)] border border-[rgba(255,184,0,0.4)]">{mentorPingsCount}</span>
            )}
          </div>
          
          <div className="mt-8 mb-4">
            <NotificationFeed 
              notifications={safeNotifs.map(n => ({
                id: n.id,
                type: n.type.replace('_', ' ').toUpperCase(),
                message: n.message,
                meta: new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                variant: n.type === 'broadcast' ? 'broadcast' : (n.type === 'mentor_ping' ? 'mentor-ping' : 'ai')
              }))} 
            />
          </div>

          <div className="mt-auto p-6 border-t border-[var(--border)] bg-[var(--surface-1)]">
             <button 
                onClick={handleBroadcast}
                className="w-full bg-[var(--signal-live)] text-[var(--void)] font-display text-[12px] font-bold uppercase tracking-[0.08em] h-[36px] rounded-[4px] hover:shadow-[0_0_15px_rgba(0,255,194,0.4)] transition-all flex items-center justify-center gap-2"
             >
               BROADCAST
             </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-[720px] flex flex-col h-full overflow-y-auto">
          
          {/* CLI Status Bar */}
          <div className="h-[40px] flex-shrink-0 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center justify-between px-6">
            <div className="font-display text-[12px] text-[var(--text-code)]">
              $ hackbridge status --event={event?.event_code || "UNKNOWN"}
              <span className="cli-cursor text-[var(--signal-live)] inline-block w-[6px] h-[14px] bg-[var(--signal-live)] align-middle ml-1"></span>
            </div>
            <div className="font-ui text-[11px] text-[var(--signal-live)] border border-[var(--signal-live)] rounded-[3px] px-2.5 py-1 uppercase tracking-tight">
              {event?.event_code || "UNKNOWN"}
            </div>
            <div className="font-ui text-[11px] text-[var(--text-secondary)]">
              Operational Room · Stage 2 active
            </div>
          </div>

          <div className="p-[32px_40px] flex flex-col flex-1">
            {/* Page Header */}
            <div className="mb-[32px] border-b border-[var(--border)] pb-6">
              <div className="font-ui text-[10px] text-[var(--text-muted)] tracking-[0.18em] uppercase mb-1">
                ORGANIZER · DASHBOARD
              </div>
              <h1 className="font-display text-[48px] font-bold text-[var(--text-primary)] leading-none mb-2 tracking-tight">
                COMMAND CENTER
              </h1>
              <div className="font-body text-[13px] text-[var(--text-secondary)]">
                {event?.name || "Hackathon"} · {teams.length} teams · {mentors.length} mentors linked
              </div>
            </div>

            {/* Stat Grid */}
            <div className="grid grid-cols-3 gap-[16px] mb-[24px]">
              <StatCard label="Total Nodes" value={teams.length.toString()} sub={`${teams.filter(t => !t.repo_url).length} unlinked`} />
              <StatCard label="Active Pings" value={<span className="text-[var(--signal-ping)]">{mentorPingsCount}</span>} sub="Awaiting ACK" />
              <StatCard label="Risk Flags" value={<span className="text-[var(--signal-alert)]">{activeFlagsCount}</span>} sub="Critical alerts" />
            </div>

            {/* Broadcast Composer */}
            <div className="mb-[24px] flex flex-col gap-2">
              <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase">
                Global Comm Channel
              </div>
              <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-4 flex gap-3">
                <Input 
                  placeholder="Type a broadcast message to all participants..." 
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleBroadcast()}
                  className="flex-1 font-body text-[13px] bg-[var(--surface-2)] border-[var(--border)] h-[36px] text-[var(--text-primary)]"
                />
                <Button onClick={handleBroadcast} className="px-6 h-[36px]">Send</Button>
              </div>
            </div>

            {/* Mentor Assignment Section */}
            <div className="mb-[32px]">
              <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase mb-3">
                Team → Mentor Assignment
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {teams.map((t: any) => (
                  <div key={t.id} className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-4 flex items-center justify-between group hover:border-[var(--border-hot)] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="font-ui text-[14px] font-bold text-[var(--text-primary)] truncate">{t.name}</div>
                      <div className="font-ui text-[10px] text-[var(--text-muted)] uppercase tracking-tight">{t.selected_track || "General"} · {t.team_code}</div>
                    </div>
                    <Select
                      className="w-[180px] font-ui text-[11px] h-8 bg-[var(--surface-2)] border-[var(--border)]"
                      value={t.mentor_id || ""}
                      onChange={async (e) => {
                        const mentorId = e.target.value || null
                        const supabase = createClient()
                        await supabase.from("teams").update({ mentor_id: mentorId }).eq("id", t.id)
                        setTeams(prev => prev.map(team => team.id === t.id ? { ...team, mentor_id: mentorId } : team))
                      }}
                    >
                      <option value="">No mentor</option>
                      {mentors.map((m: any) => (
                        <option key={m.user_id} value={m.user_id}>
                          {m.name || m.email} {m.expertise_tags?.length ? `(${m.expertise_tags[0]})` : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-[24px] mb-[24px]">
              {/* Integrity Watchlist */}
              <div className="lg:col-span-7 flex flex-col gap-2">
                <div className="flex justify-between items-end mb-1">
                  <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase">
                    Integrity Watchlist
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleSweep} disabled={loading}>
                    {loading ? "Sweeping..." : "Run Sweep"}
                  </Button>
                </div>
                
                <div className="flex gap-2 mb-2">
                  <button 
                    onClick={() => setActiveTab("plagiarism")}
                    className={`font-ui text-[10px] px-3 py-1 rounded-[3px] border ${activeTab === "plagiarism" ? "bg-[rgba(0,255,194,0.08)] border-[var(--signal-live)] text-[var(--signal-live)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}
                  >
                    PLAGIARISM
                  </button>
                  <button 
                    onClick={() => setActiveTab("track_drift")}
                    className={`font-ui text-[10px] px-3 py-1 rounded-[3px] border ${activeTab === "track_drift" ? "bg-[rgba(0,255,194,0.08)] border-[var(--signal-live)] text-[var(--signal-live)]" : "border-[var(--border)] text-[var(--text-muted)]"}`}
                  >
                    TRACK DRIFT
                  </button>
                </div>

                <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] overflow-hidden">
                  {flags.filter(f => activeTab === "plagiarism" ? f.flag_type === "plagiarism" : f.flag_type === "track_deviation").map((flag) => (
                    <div key={flag.id} className={`p-4 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors group relative ${flag.silenced ? "opacity-40" : ""}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-ui text-[13px] font-bold text-[var(--text-primary)]">{flag.teams.name}</div>
                          <div className="font-body text-[11px] text-[var(--text-secondary)] mt-1">{flag.evidence || flag.alignment_rationale}</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                           <span className={`font-ui text-[9px] px-1.5 py-0.5 rounded-[2px] border ${flag.risk_level === 'High' ? "bg-[rgba(255,45,85,0.1)] text-[var(--signal-alert)] border-[rgba(255,45,85,0.3)]" : "bg-[rgba(255,107,53,0.1)] text-[var(--signal-warn)] border-[rgba(255,107,53,0.3)]"}`}>
                              {flag.risk_level === 'High' ? 'CRITICAL' : 'REVIEW'}
                           </span>
                           {!flag.silenced && (
                             <button onClick={() => handleSilence(flag.id)} className="text-[9px] text-[var(--text-muted)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 uppercase tracking-widest">Silence</button>
                           )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Matching Optimization */}
              <div className="lg:col-span-5 flex flex-col gap-2">
                <div className="flex justify-between items-end mb-1">
                  <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase">
                    Matching Engine
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleMatchScan}>Run Scan</Button>
                </div>
                <div className="flex flex-col gap-3">
                  {suggestions.map(sugg => (
                    <div key={sugg.id} className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-4 flex flex-col gap-3 hover:border-[var(--border-hot)] transition-all">
                      <div className="flex justify-between items-center">
                        <span className="font-ui text-[12px] font-bold text-[var(--text-primary)]">{sugg.teams.name}</span>
                        <span className="font-ui text-[10px] text-[var(--signal-live)]">+{sugg.suggested_match_score - sugg.current_match_score}% Optimization</span>
                      </div>
                      <div className="font-body text-[10px] text-[var(--text-secondary)] italic border-l-2 border-[var(--border)] pl-3">
                        &ldquo;{sugg.rationale}&rdquo;
                      </div>
                      <Button size="sm" className="w-full">APPROVE_SWAP</Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Final Placement */}
            <div className="mb-[64px]">
               <div className="font-ui text-[10px] text-[var(--text-secondary)] tracking-[0.18em] uppercase mb-3">
                Final Sector Placement
              </div>
              <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block font-ui text-[10px] text-[var(--text-muted)] mb-1.5 uppercase tracking-widest">🥇 Sector 01</label>
                    <Select className="bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] font-ui text-[12px]">
                      <option value="">Select team...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="block font-ui text-[10px] text-[var(--text-muted)] mb-1.5 uppercase tracking-widest">🥈 Sector 02</label>
                    <Select className="bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] font-ui text-[12px]">
                      <option value="">Select team...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                  </div>
                  <div>
                    <label className="block font-ui text-[10px] text-[var(--text-muted)] mb-1.5 uppercase tracking-widest">🥉 Sector 03</label>
                    <Select className="bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-primary)] font-ui text-[12px]">
                      <option value="">Select team...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </Select>
                  </div>
                </div>
                <Button variant="primary" className="w-full h-12 font-bold tracking-[0.1em]">LOCK_FINAL_RESULTS</Button>
              </div>
            </div>
          </div>

          {/* Bottom Status Bar */}
          <div className="h-[32px] mt-auto flex-shrink-0 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center">
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center font-ui text-[10px] text-[var(--text-muted)]">
              <span className="text-[var(--signal-live)] mr-2">●</span> BROADCAST_UP
            </div>
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center font-ui text-[10px] text-[var(--text-muted)]">
              <span className="text-[var(--signal-info)] mr-2">●</span> MATCH_ENG_NOMINAL
            </div>
            <div className="flex-1 flex items-center justify-center font-ui text-[10px] text-[var(--text-muted)]">
              <span className="text-[var(--signal-clean)] mr-2">●</span> INTEGRITY_STABLE
            </div>
          </div>
        </main>
      </div>

    </div>
  )
}