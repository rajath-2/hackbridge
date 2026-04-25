"use client"

import { useState, useEffect } from "react"
import { NavBar } from "@/components/dashboard/NavBar"
import { StatCard } from "@/components/ui/StatCard"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { api } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { Grid2X2, ShieldAlert, Plus, X } from "lucide-react"

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

export default function OrganizerDashboard() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "integrity">("overview");
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);

  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [event, setEvent] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [commitCount, setCommitCount] = useState(0);
  const [lastCommitTime, setLastCommitTime] = useState<string | null>(null);

  // Create Event Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    event_code: "", name: "", start_time: "", end_time: "", tracks: ""
  });
  const [creating, setCreating] = useState(false);



  const loadEventData = async (activeEvent: any) => {
    if (!activeEvent) { setEvent(null); return; }
    setEvent(activeEvent);
    try {
      // Fetch each resource independently so one failure doesn't block others
      let flagsData: any[] = [];
      let teamsData: any[] = [];
      let mentorsData: any[] = [];

      try { teamsData = await api.get(`/teams/event/${activeEvent.id}`); } catch (e) { console.warn("Failed to load teams:", e); }
      try { flagsData = await api.get(`/integrity/flags/event/${activeEvent.id}`); } catch (e) { console.warn("Failed to load flags:", e); }
      try { mentorsData = await api.get(`/events/${activeEvent.id}/participants?role=mentor`); } catch (e) { console.warn("Failed to load mentors:", e); }

      setFlags(flagsData);
      setTeams(teamsData);
      setMentors(mentorsData);

      // Fetch commit count from all teams
      let totalCommits = 0;
      let latestTime: string | null = null;
      for (const t of teamsData) {
        try {
          const commits = await api.get(`/commits/team/${t.id}`);
          totalCommits += commits.length;
          if (commits.length > 0 && (!latestTime || commits[0].timestamp > latestTime)) {
            latestTime = commits[0].timestamp;
          }
        } catch {}
      }
      setCommitCount(totalCommits);
      setLastCommitTime(latestTime);
    } catch (error) {
      console.error("Failed to load event data:", error);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
      const events = await api.get("/events/all");
      setAllEvents(events || []);
      if (events && events.length > 0) {
        await loadEventData(events[0]);
      } else {
        setEvent(null);
      }
    } catch (error) {
      console.error("Failed to fetch initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInitialData(); }, []);

  const handleSweep = async () => {
    if (!event) return;
    setLoading(true);
    try {
      await api.post(`/integrity/sweep/event/${event.id}`, { trigger: "manual_organizer" });
      await loadEventData(event);
    } catch (err) { console.error("Sweep failed:", err); }
    finally { setLoading(false); }
  };



  const handleCreateEvent = async () => {
    setCreating(true);
    try {
      const payload = {
        event_code: newEvent.event_code,
        name: newEvent.name,
        start_time: new Date(newEvent.start_time).toISOString(),
        end_time: new Date(newEvent.end_time).toISOString(),
        tracks: newEvent.tracks.split(",").map(t => t.trim()).filter(Boolean),
        judging_rounds: []
      };
      const created = await api.post("/events/", payload);
      setAllEvents(prev => [...prev, created]);
      await loadEventData(created);
      setShowCreateModal(false);
      setNewEvent({ event_code: "", name: "", start_time: "", end_time: "", tracks: "" });
    } catch (err: any) {
      alert("Failed to create event: " + (err.message || "Unknown error"));
    } finally { setCreating(false); }
  };

  const activeFlagsCount = flags.filter(f => !f.silenced).length;

  const timeSince = (iso: string | null) => {
    if (!iso) return "No commits yet";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--void)] flex items-center justify-center font-ui uppercase tracking-widest text-[var(--text-muted)] animate-pulse">
        Initializing Command Center...
      </div>
    );
  }

  const eventDropdown = (
    <Select 
      className="w-auto font-ui text-[11px] h-7 bg-[var(--surface-2)] border-[var(--border)] text-[var(--signal-live)] rounded-[3px] cursor-pointer"
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

  // Build ticker from real team data
  const tickerItems = [
    ...teams.slice(0, 3).map(t => ({ type: "NODE", id: t.team_code, team: t.name, msg: `Track: ${t.selected_track || "General"}` })),
    { type: "STATUS", id: "●", team: "SYSTEM", msg: `${teams.length} nodes online · ${commitCount} commits total` }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--void)] font-body selection:bg-[var(--signal-live)] selection:text-[var(--void)]">
      {/* 5.1 Live Ticker Bar */}
      <div className="h-[32px] bg-[var(--signal-live)]/8 border-b border-[var(--signal-live)]/20 overflow-hidden flex items-center w-full sticky top-0 z-[100]">
        <div className="ticker-track whitespace-nowrap flex items-center">
          {[...tickerItems, ...tickerItems, ...tickerItems].map((item, i) => (
            <span key={i} className="font-ui text-[10px] text-[var(--signal-live)] uppercase tracking-[0.1em] mx-4 flex items-center gap-2">
              <span>{item.type === 'NODE' ? '●' : (item.type === 'STATUS' ? '◎' : '⚑')}</span>
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

      <NavBar eventDropdown={eventDropdown} eventName={event?.name} role="organizer" />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[240px] flex-shrink-0 bg-[var(--surface-1)] border-r border-[var(--border)] flex flex-col sticky top-[32px] h-[calc(100vh-32px)]">
          <div className="py-5 px-6 t-section">Control Panel</div>

          {/* Create Event Button */}
          <div className="px-4 mb-4">
            <Button onClick={() => setShowCreateModal(true)} className="w-full h-[36px] bg-[var(--signal-live)] text-[var(--void)] font-bold text-[11px] uppercase tracking-widest">
              <Plus size={14} />
              Create Event
            </Button>
          </div>

          <Button 
            variant="ghost"
            onClick={() => setActiveTab("overview")}
            className={`px-6 justify-start rounded-none h-[40px] border-l-[3px] font-ui text-[12px] uppercase tracking-wider ${activeTab === 'overview' ? "text-[var(--text-primary)] border-[var(--signal-live)] bg-[var(--signal-live)]/5" : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5"}`}
          >
            <Grid2X2 size={14} />
            Overview
          </Button>
          <Button 
            variant="ghost"
            onClick={() => setActiveTab("integrity")}
            className={`px-6 justify-start rounded-none h-[40px] border-l-[3px] font-ui text-[12px] uppercase tracking-wider ${activeTab === 'integrity' ? "text-[var(--text-primary)] border-[var(--signal-live)] bg-[var(--signal-live)]/5" : "text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-white/5"}`}
          >
            <ShieldAlert size={14} />
            Integrity
            {activeFlagsCount > 0 && (
              <span className="ml-auto font-ui text-[10px] px-1.5 py-0.5 rounded-[3px] bg-[var(--signal-alert)]/15 text-[var(--signal-alert)] border border-[var(--signal-alert)]/40">{activeFlagsCount}</span>
            )}
          </Button>


        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-[720px] flex flex-col h-full overflow-y-auto">
          
          {/* CLI Status Bar */}
          <div className="h-[40px] flex-shrink-0 bg-[var(--surface-2)] border-b border-[var(--border)] flex items-center justify-between px-6">
            <div className="t-code flex items-center">
              <span className="mr-2">$</span>
              <span>hackbridge status --event={event?.event_code?.toLowerCase() || "unknown"}</span>
              <span className="cli-cursor ml-1 text-[var(--signal-live)]">▋</span>
            </div>
            <div className="font-ui text-[11px] text-[var(--signal-live)] border border-[var(--signal-live)] rounded-[3px] px-2.5 py-1 uppercase tracking-tight">
              {event?.event_code || "NO_EVENT"}
            </div>
            <div className="font-ui text-[11px] text-[var(--text-secondary)] uppercase tracking-tight">
              {event ? `${teams.length} Nodes · ${commitCount} Commits` : "No event selected"}
            </div>
          </div>

          <div className="p-[32px_40px] flex flex-col flex-1">
            {/* Page Header */}
            <div className="mb-[32px]">
              <div className="t-section mb-1 uppercase">ORGANIZER · DASHBOARD</div>
              <h1 className="t-display mb-2 text-[var(--text-primary)] uppercase">COMMAND CENTER</h1>
              <div className="font-body text-[13px] text-[var(--text-secondary)] flex items-center gap-2">
                <span>{event?.name || "No event selected"}</span>
                <span className="opacity-30">·</span>
                <span>{teams.length} Nodes Online</span>
                <span className="opacity-30">·</span>
                <span className="text-[var(--signal-live)]">{event ? "Uplink Nominal" : "Awaiting Event"}</span>
              </div>
              <div className="w-full h-[1px] bg-[var(--border)] mt-6"></div>
            </div>

            {/* Stat Row */}
            <div className="grid grid-cols-4 gap-[16px] mb-[24px]">
              <StatCard label="Active Nodes" value={teams.length.toString().padStart(2, '0')} sub={`${teams.filter(t => t.repo_url).length} linked to repo`} variant="live" />
              <StatCard label="Mentors" value={mentors.length.toString().padStart(2, '0')} sub="Specialists assigned" variant="ping" />
              <StatCard label="Total Commits" value={commitCount.toString().padStart(2, '0')} sub={`Last: ${timeSince(lastCommitTime)}`} variant="info" />
              <StatCard label="Risk Flags" value={activeFlagsCount.toString().padStart(2, '0')} sub="Integrity alerts detected" variant="alert" />
            </div>

            <div className="grid grid-cols-12 gap-[24px] mb-[24px]">

              {/* Tab Content */}
              {activeTab === "overview" ? (
                <div className="col-span-12 space-y-8">
                  <div className="space-y-4">
                    <div className="t-section uppercase border-b border-[var(--border)] pb-2">
                      Operational Nodes ({teams.length})
                    </div>
                    {teams.length === 0 ? (
                      <div className="p-10 text-center t-label italic uppercase bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px]">No teams registered yet. Share the event code to get started.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {teams.map((t: any) => (
                          <div key={t.id} className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] p-4 flex flex-col gap-3 group hover:border-[var(--border-hot)] transition-all">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-ui text-[14px] font-bold text-[var(--text-primary)] uppercase">{t.name}</div>
                                <div className="t-micro uppercase tracking-widest">{t.selected_track || "General"} · {t.team_code}</div>
                              </div>
                              <div className={`w-2 h-2 rounded-full ${t.repo_url ? "bg-[var(--signal-live)]" : "bg-[var(--text-muted)]"}`}></div>
                            </div>
                            <div className="mt-auto flex gap-2">
                               <Select
                                  className="flex-1 font-ui text-[10px] h-7 bg-[var(--surface-2)] border-[var(--border)] uppercase"
                                  value={t.mentor_id || ""}
                                  onChange={async (e) => {
                                    const mentorId = e.target.value || null;
                                    const supabase = createClient();
                                    await supabase.from("teams").update({ mentor_id: mentorId }).eq("id", t.id);
                                    setTeams(prev => prev.map(team => team.id === t.id ? { ...team, mentor_id: mentorId } : team));
                                  }}
                                >
                                  <option value="">NO_SPECIALIST</option>
                                  {mentors.map((m: any) => (
                                    <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>
                                  ))}
                                </Select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="col-span-12 space-y-4">
                  <div className="flex justify-between items-end border-b border-[var(--border)] pb-2">
                    <div className="t-section uppercase">Integrity Watchlist</div>
                    <Button variant="secondary" size="sm" onClick={handleSweep} disabled={loading} className="h-7 text-[10px] px-3 border-[var(--border-hot)] uppercase">
                      {loading ? "INITIALIZING_SWEEP..." : "RUN_FULL_SWEEP"}
                    </Button>
                  </div>
                  <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] overflow-hidden">
                    {flags.length === 0 ? (
                      <div className="p-10 text-center t-label italic uppercase">No integrity flags detected in current sweep.</div>
                    ) : flags.map((flag) => (
                      <div key={flag.id} className={`p-4 border-b border-[var(--border)] last:border-0 hover:bg-white/5 transition-colors group ${flag.silenced ? "opacity-30" : ""}`}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full ${flag.risk_level === 'High' ? "bg-[var(--signal-alert)]" : "bg-[var(--signal-warn)]"}`}></div>
                            <div>
                              <div className="font-ui text-[13px] font-bold text-[var(--text-primary)] uppercase">{flag.teams.name}</div>
                              <div className="font-body text-[11px] text-[var(--text-secondary)] mt-1">{flag.evidence || flag.alignment_rationale}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                             <span className={`font-ui text-[9px] px-2 py-1 rounded-[3px] border uppercase tracking-widest ${flag.risk_level === 'High' ? "bg-[var(--signal-alert)]/10 text-[var(--signal-alert)] border-[var(--signal-alert)]/40" : "bg-[var(--signal-warn)]/10 text-[var(--signal-warn)] border-[var(--signal-warn)]/40"}`}>
                                {flag.risk_level === 'High' ? 'HIGH RISK' : 'REVIEW'}
                             </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Status Bar */}
          <div className="h-[32px] mt-auto flex-shrink-0 bg-[var(--surface-2)] border-t border-[var(--border)] flex items-center">
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center t-micro uppercase">
              <span className="text-[var(--signal-live)] mr-2">●</span> {event ? "EVENT_ACTIVE" : "NO_EVENT"}
            </div>
            <div className="flex-1 border-r border-[var(--border)] flex items-center justify-center t-micro uppercase">
              <span className="text-[var(--signal-ping)] mr-2">●</span> {mentors.length} MENTORS
            </div>
            <div className="flex-1 flex items-center justify-center t-micro uppercase">
              <span className="text-[var(--signal-info)] mr-2">●</span> {activeFlagsCount > 0 ? `${activeFlagsCount} FLAGS_ACTIVE` : "INTEGRITY_STABLE"}
            </div>
          </div>
        </main>
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[520px] bg-[var(--surface-1)] border border-[var(--border)] rounded-lg overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.5)]">
            <div className="bg-[var(--surface-2)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[var(--signal-live)] dot-live" />
                <span className="t-section uppercase text-[var(--signal-live)] tracking-[0.2em] font-bold">Initialize New Event</span>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-8 flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="t-micro uppercase opacity-80 ml-1 font-bold tracking-widest">Event_Code</label>
                <Input placeholder="e.g. HACK-2026" value={newEvent.event_code} onChange={e => setNewEvent(p => ({...p, event_code: e.target.value}))} className="h-12 bg-[var(--surface-2)] border-[var(--border)] font-mono uppercase tracking-widest" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="t-micro uppercase opacity-80 ml-1 font-bold tracking-widest">Event_Name</label>
                <Input placeholder="e.g. HackBridge Global 2026" value={newEvent.name} onChange={e => setNewEvent(p => ({...p, name: e.target.value}))} className="h-12 bg-[var(--surface-2)] border-[var(--border)]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="t-micro uppercase opacity-80 ml-1 font-bold tracking-widest">Start_Time</label>
                  <Input type="datetime-local" value={newEvent.start_time} onChange={e => setNewEvent(p => ({...p, start_time: e.target.value}))} className="h-12 bg-[var(--surface-2)] border-[var(--border)]" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="t-micro uppercase opacity-80 ml-1 font-bold tracking-widest">End_Time</label>
                  <Input type="datetime-local" value={newEvent.end_time} onChange={e => setNewEvent(p => ({...p, end_time: e.target.value}))} className="h-12 bg-[var(--surface-2)] border-[var(--border)]" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="t-micro uppercase opacity-80 ml-1 font-bold tracking-widest">Tracks (comma-separated)</label>
                <Input placeholder="e.g. AI/ML, Web3, HealthTech" value={newEvent.tracks} onChange={e => setNewEvent(p => ({...p, tracks: e.target.value}))} className="h-12 bg-[var(--surface-2)] border-[var(--border)]" />
              </div>
              <Button onClick={handleCreateEvent} disabled={creating || !newEvent.event_code || !newEvent.name || !newEvent.start_time || !newEvent.end_time} className="w-full h-14 mt-2 bg-[var(--signal-live)] text-[var(--void)] font-bold t-section uppercase tracking-widest shadow-[0_0_20px_rgba(0,255,194,0.3)]">
                {creating ? "DEPLOYING..." : "DEPLOY_EVENT"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}