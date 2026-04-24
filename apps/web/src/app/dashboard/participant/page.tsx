"use client"

import { useState, useEffect } from "react"
import { NavBar } from "@/components/dashboard/NavBar"
import { NotificationFeed } from "@/components/dashboard/NotificationFeed"
import { Timeline, TimelineItem } from "@/components/ui/Timeline"
import { MentorCard } from "@/components/ui/MentorCard"
import { CLIBlock } from "@/components/ui/CLIBlock"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"
import { createClient } from "@/lib/supabase/client"
import { useNotifications } from "@/hooks/useNotifications"
import { Select } from "@/components/ui/select"

export default function ParticipantDashboard() {
  const [team, setTeam] = useState<any>(null)
  const [mentor, setMentor] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [repoUrl, setRepoUrl] = useState("")
  const [analyzed, setAnalyzed] = useState(false)
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
  const [cliToken, setCliToken] = useState("")
  const [cliLinkedAt, setCliLinkedAt] = useState<string | null>(null)

  const notifications = useNotifications(team?.event_id, user?.id, "participant")

  useEffect(() => {
    const init = async () => {
      try {
        const supabase = createClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()
        setUser(authUser)

        const teamData = await api.get("/teams/me")
        setTeam(teamData)
        setRepoUrl(teamData?.repo_url || "")

        const { cli_token, cli_linked_at } = await api.get("/users/me/cli-token")
        setCliToken(cli_token)
        setCliLinkedAt(cli_linked_at)

        if (teamData?.mentor_id) {
          const { data: mentorData } = await supabase
            .from("users")
            .select("*, mentor_profiles(*)")
            .eq("id", teamData.mentor_id)
            .single()
          setMentor(mentorData)
        }

        if (teamData) {
          const collab = await api.get(`/collaboration/team/${teamData.id}`)
          setCollabData(collab)
        }

        if (!teamData) {
          const eventsData = await api.get("/events/all")
          setEvents(eventsData)
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
      alert("Invalid team code or already in a team.")
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

  const timelineItems: TimelineItem[] = [
    { status: 'done', label: 'Hacking Begins', time: '10:00 AM' },
    { status: 'active', label: 'Check-in 1', time: '2:00 PM' },
    { status: 'pending', label: 'Check-in 2', time: '8:00 PM' },
    { status: 'pending', label: 'Submissions Close', time: '10:00 AM (Sun)' },
  ];

  const handleAnalyse = async () => {
    if (!team || !repoUrl) return
    setLoading(true)
    try {
      await api.post(`/teams/${team.id}/repo`, { repo_url: repoUrl })
      
      // Re-fetch team data to get the new fingerprint and match score
      const teamData = await api.get("/teams/me")
      setTeam(teamData)
      
      setAnalyzed(true)
    } catch (err) {
      console.error("Analysis failed:", err)
    } finally {
      setLoading(false)
    }
  };

  if (loading) return (
    <div className="min-h-screen dashboard-root flex items-center justify-center">
      <span className="text-[14px] text-[var(--hb-muted)] animate-hb-pulse">Loading HackBridge...</span>
    </div>
  )

  if (!team) {
    return (
      <div className="min-h-screen dashboard-root">
        <NavBar role="participant" />
        <main className="max-w-[1200px] mx-auto px-6 py-12 flex flex-col items-center">
            <h1 className="text-[24px] font-bold text-[var(--hb-text)] mb-2">Welcome to HackBridge</h1>
            <p className="text-[14px] text-[var(--hb-muted)] mb-12">You are not in a team yet. Choose an option to get started.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                {/* Join Team */}
                <Card variant="elevated" className="p-8 flex flex-col">
                    <h2 className="text-[18px] font-semibold text-[var(--hb-text)] mb-4">Join an Existing Team</h2>
                    <p className="text-[12px] text-[var(--hb-muted)] mb-6 flex-1">Enter the team code shared by your team leader to join their workspace.</p>
                    <div className="flex flex-col gap-4">
                        <Input 
                          placeholder="TEAM-CODE" 
                          value={joinCode} 
                          onChange={(e) => setJoinCode(e.target.value.toUpperCase())} 
                        />
                        <Button variant="primary" onClick={handleJoinTeam}>Join Team</Button>
                    </div>
                </Card>

                {/* Create Team */}
                <Card variant="elevated" className="p-8 flex flex-col">
                    <h2 className="text-[18px] font-semibold text-[var(--hb-text)] mb-4">Create a New Team</h2>
                    <p className="text-[12px] text-[var(--hb-muted)] mb-6 flex-1">Start a new project and invite others to join using your team code.</p>
                    <div className="flex flex-col gap-4">
                        <Input 
                          placeholder="Team Name" 
                          value={newTeamName} 
                          onChange={(e) => setNewTeamName(e.target.value)} 
                        />
                        <Select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}>
                            <option value="">Select Event...</option>
                            {events.map(e => (
                              <option key={e.id} value={e.id}>{e.name} ({e.event_code})</option>
                            ))}
                        </Select>
                        <Select value={selectedTrack} onChange={(e) => setSelectedTrack(e.target.value)}>
                            <option value="">Select Track...</option>
                            <option value="Web3">Web3</option>
                            <option value="AI/ML">AI/ML</option>
                            <option value="Social Impact">Social Impact</option>
                            <option value="General">General</option>
                        </Select>
                        <Button variant="primary" onClick={handleCreateTeam}>Create Team</Button>
                    </div>
                </Card>
            </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen dashboard-root">
      <NavBar eventCode={team?.events?.event_code || "HACK26"} role="participant" />
      
      <main className="max-w-[1200px] mx-auto px-6 py-8">
        
        {/* Tab Toggle */}
        <div className="flex gap-4 mb-8 border-b border-[var(--hb-border)]">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`pb-2 text-[12px] font-bold uppercase tracking-widest transition-all ${activeTab === "overview" ? "text-[var(--hb-indigo-bright)] border-b-2 border-[var(--hb-indigo-bright)]" : "text-[var(--hb-muted)]"}`}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab("sync")}
            className={`pb-2 text-[12px] font-bold uppercase tracking-widest transition-all ${activeTab === "sync" ? "text-[var(--hb-indigo-bright)] border-b-2 border-[var(--hb-indigo-bright)]" : "text-[var(--hb-muted)]"}`}
          >
            Team Sync & Collab
          </button>
        </div>

        {activeTab === "overview" ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 mb-8">
          
          {/* Left Column - 40% */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            <section>
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2">
                Team Info
              </div>
              <Card variant="base">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-[15px] font-semibold text-[var(--hb-text)]">{team.name}</h2>
                    <p className="text-[11px] text-[var(--hb-muted)]">{team.selected_track || "No track selected"}</p>
                  </div>
                  <Badge variant="indigo">{team.team_code}</Badge>
                </div>
              </Card>
            </section>

            <section>
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2">
                Team Members
              </div>
              <Card variant="base" className="flex flex-col gap-2">
                {team.team_members?.map((member: any) => (
                  <div key={member.user_id} className="flex items-center gap-2 py-1 border-b border-[var(--hb-border)] last:border-0">
                    <div className="w-6 h-6 rounded-full bg-[var(--hb-surface3)] flex items-center justify-center text-[10px] font-bold text-[var(--hb-indigo-bright)]">
                      {member.users?.name?.charAt(0) || "U"}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] text-[var(--hb-text)] font-medium">{member.users?.name || "Anonymous"}</span>
                      <span className="text-[9px] text-[var(--hb-muted)]">{member.users?.email}</span>
                    </div>
                    {member.user_id === team.leader_id && (
                      <Badge variant="indigo" className="ml-auto text-[8px] px-1.5 py-0">Leader</Badge>
                    )}
                  </div>
                ))}
              </Card>
            </section>

            <section>
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2">
                Event Timeline
              </div>
              <Card variant="base">
                <Timeline items={timelineItems} />
              </Card>
            </section>

          </div>

          {/* Right Column - 60% */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            
            <section>
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2">
                Assigned Mentor
              </div>
              {mentor ? (
                <MentorCard 
                  teamId={team.id}
                  name={mentor.name}
                  initials={mentor.name.split(" ").map((n: string) => n[0]).join("")}
                  matchPct={team.mentor_match_score || 0}
                  tags={mentor.mentor_profiles?.expertise_tags || []}
                />
              ) : (
                <Card variant="base" className="text-center py-6 text-[11px] text-[var(--hb-muted)] italic">
                  Waiting for initial activity to match...
                </Card>
              )}
            </section>

            <section>
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2">
                GitHub Repository
              </div>
              <Card variant="base" className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <Input 
                    placeholder="https://github.com/username/repo" 
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                  />
                  <Button variant="secondary" onClick={handleAnalyse} disabled={loading}>
                    {loading ? "Analyzing..." : "Analyse"}
                  </Button>
                </div>
                
                {(analyzed || (team?.repo_fingerprint && (team.repo_fingerprint.primary_language || team.repo_fingerprint.languages?.length > 0))) && (
                  <Card variant="ai">
                    Groq Analysis: Detected {team?.repo_fingerprint?.primary_language || team?.repo_fingerprint?.languages?.[0] || "General Stack"} 
                    {(team?.repo_fingerprint?.tech_stack?.length > 0 || team?.repo_fingerprint?.frameworks?.length > 0) ? 
                      ` with ${(team.repo_fingerprint.tech_stack || team.repo_fingerprint.frameworks)?.join(", ")}` : ""}. 
                    {team?.mentor_match_score ? ` Initial match score: ${team.mentor_match_score}%` : ""}
                  </Card>
                )}
              </Card>
            </section>

            <section>
              <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-2 flex justify-between items-center">
                <span>CLI Integration</span>
                <Badge variant="indigo" className="text-[9px]">Personal Link</Badge>
              </div>
              <CLIBlock 
                prompt={`hackbridge init ${cliToken || "YOUR_PERSONAL_TOKEN"}`}
                successMessage={cliLinkedAt ? "Personal CLI linked. Your activity will now be attributed to you." : undefined}
              />
              <p className="text-[9px] text-[var(--hb-muted)] mt-2 italic text-center">
                This token is unique to you. Do not share it with others.
              </p>
            </section>

          </div>

        </div>
        ) : (
          <div className="flex flex-col gap-8 mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Connected Nodes */}
              <div className="lg:col-span-1 flex flex-col gap-4">
                <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em]">
                  Connected Nodes ({collabData?.environments?.length || 0})
                </div>
                <div className="flex flex-col gap-2">
                  {collabData?.environments?.map((env: any) => {
                    const isActive = (Date.now() - new Date(env.last_active).getTime()) < 10 * 60 * 1000;
                    return (
                      <Card 
                        key={env.id} 
                        variant="base" 
                        className={`p-4 cursor-pointer transition-all hover:border-[var(--hb-indigo-bright)] ${selectedEnvId === env.id ? "border-[var(--hb-indigo-bright)] bg-[var(--hb-surface2)]" : ""}`}
                        onClick={() => setSelectedEnvId(env.id)}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${isActive ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-neutral-600"}`} />
                            <span className="text-[13px] font-semibold text-[var(--hb-text)]">{env.users?.name}</span>
                          </div>
                          <Badge variant={isActive ? "indigo" : "amber"}>{isActive ? "Online" : "Offline"}</Badge>
                        </div>
                        <div className="mt-2 text-[10px] text-[var(--hb-muted)] font-mono">
                          Last sync: {new Date(env.last_active).toLocaleTimeString()}
                        </div>
                      </Card>
                    );
                  })}
                </div>

                <Card variant="elevated" className="p-4 mt-4 bg-[var(--hb-surface2)] border-[var(--hb-indigo)]/20">
                  <h3 className="text-[12px] font-bold text-[var(--hb-text)] mb-2 uppercase tracking-wider">Sync Command</h3>
                  <code className="text-[11px] text-[var(--hb-indigo-bright)] font-mono">hackbridge collab sync</code>
                </Card>
              </div>

              {/* Environment Audit */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em]">
                  Environment Audit vs Official Master
                </div>
                <Card variant="base" className="overflow-hidden">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-[var(--hb-surface3)] text-[var(--hb-muted)] uppercase tracking-tighter">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Runtime</th>
                        <th className="px-4 py-3">Key Packages</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hb-border)]">
                      {collabData?.environments?.map((env: any) => {
                        // Dynamically determine primary runtime (Node, Python, Go, Rust)
                        const runtime = env.tools?.["node"] ? `Node ${env.tools["node"]}` : 
                                       env.tools?.["python"] ? `Py ${env.tools["python"]}` : 
                                       env.tools?.["go"] ? `Go ${env.tools["go"]}` : 
                                       env.tools?.["rustc"] ? `Rust ${env.tools["rustc"]}` : "Unknown";
                        
                        // Get top 2 key dependencies
                        const deps = Object.entries(env.dependencies || {})
                          .filter(([k]) => !k.includes("eslint") && !k.includes("types"))
                          .slice(0, 2)
                          .map(([k, v]) => `${k.split(':').pop()}: ${v}`)
                          .join(", ");

                        const officialDeps = collabData?.official_state?.dependencies || {};
                        let isDrifting = false;
                        for (const [name, reqVer] of Object.entries(officialDeps)) {
                          if (env.dependencies?.[name] && env.dependencies[name] !== reqVer) {
                            isDrifting = true;
                            break;
                          }
                        }
                        
                        return (
                          <tr key={env.id} className="hover:bg-[var(--hb-surface2)] transition-colors">
                            <td className="px-4 py-3 font-medium text-[var(--hb-text)]">{env.users?.name}</td>
                            <td className="px-4 py-3 font-mono text-[var(--hb-muted)]">{runtime}</td>
                            <td className={`px-4 py-3 font-mono ${isDrifting ? "text-red-400 font-bold" : "text-[var(--hb-muted)]"}`}>
                              {deps || "No deps synced"}
                            </td>
                            <td className="px-4 py-3">
                              {isDrifting ? (
                                <span className="text-[9px] px-1.5 py-0.5 bg-red-950/30 text-red-400 border border-red-800/50 rounded">DRIFT</span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.5 bg-green-950/20 text-green-500 border border-green-800/30 rounded">SYNCED</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {(!collabData?.environments || collabData.environments.length === 0) && (
                    <div className="p-8 text-center text-[var(--hb-muted)] italic">No environment data synced yet.</div>
                  )}
                </Card>

                {/* Expanded Detail View */}
                {selectedEnvId && collabData?.environments?.find((e: any) => e.id === selectedEnvId) && (
                  <Card variant="base" className="p-6 border-[var(--hb-indigo)]/30 animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-[14px] font-bold text-[var(--hb-text)] uppercase tracking-widest">
                        Node Report: {collabData.environments.find((e: any) => e.id === selectedEnvId).users?.name}
                      </h3>
                      <button onClick={() => setSelectedEnvId(null)} className="text-[var(--hb-muted)] hover:text-white">✕</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {/* Full Dependencies */}
                      <div className="flex flex-col gap-2">
                        <div className="text-[9px] text-[var(--hb-indigo-bright)] uppercase font-bold">All Dependencies</div>
                        <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {Object.entries(collabData.environments.find((e: any) => e.id === selectedEnvId).dependencies || {}).map(([k, v]: [any, any]) => (
                            <div key={k} className="flex justify-between py-1 border-b border-[var(--hb-border)] text-[10px]">
                              <span className="text-[var(--hb-muted)] font-mono">{k.split(':').pop()}</span>
                              <span className="text-[var(--hb-text)] font-mono">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* System Tools */}
                      <div className="flex flex-col gap-2">
                        <div className="text-[9px] text-[var(--hb-indigo-bright)] uppercase font-bold">System Runtimes</div>
                        <div className="flex flex-col gap-1">
                          {Object.entries(collabData.environments.find((e: any) => e.id === selectedEnvId).tools || {}).map(([k, v]: [any, any]) => (
                            <div key={k} className="flex justify-between py-1 border-b border-[var(--hb-border)] text-[10px]">
                              <span className="text-[var(--hb-muted)] uppercase">{k}</span>
                              <span className="text-[var(--hb-text)] font-mono">{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Env Keys Audit */}
                      <div className="flex flex-col gap-2">
                        <div className="text-[9px] text-[var(--hb-indigo-bright)] uppercase font-bold">Environment Keys</div>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(collabData.environments.find((e: any) => e.id === selectedEnvId).env_keys || {}).map(([k, v]: [any, any]) => (
                            <Badge key={k} variant="indigo" className="text-[8px] bg-transparent border-[var(--hb-border)] text-[var(--hb-muted)]">
                              {k}
                            </Badge>
                          ))}
                          {Object.keys(collabData.environments.find((e: any) => e.id === selectedEnvId).env_keys || {}).length === 0 && (
                            <div className="text-[10px] text-[var(--hb-muted)] italic">No .env keys detected</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* History Timeline */}
                <div className="mt-4">
                  <div className="text-[10px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-4">
                    Version Evolution Timeline
                  </div>
                  <div className="flex flex-col gap-3">
                    {collabData?.history?.map((entry: any) => (
                      <div key={entry.id} className="flex gap-3 relative pl-4 border-l border-[var(--hb-border)]">
                        <div className="absolute left-[-4px] top-1.5 w-2 h-2 rounded-full bg-[var(--hb-indigo)]" />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold text-[var(--hb-text)]">{entry.message}</span>
                            <span className="text-[9px] text-[var(--hb-dim)]">{new Date(entry.created_at).toLocaleString()}</span>
                          </div>
                          <div className="flex gap-2 mt-1">
                            {entry.changes?.added?.length > 0 && <span className="text-[9px] text-green-400">+{entry.changes.added.length} added</span>}
                            {entry.changes?.updated?.length > 0 && <span className="text-[9px] text-yellow-400">~{entry.changes.updated.length} updated</span>}
                            {entry.changes?.removed?.length > 0 && <span className="text-[9px] text-red-400">-{entry.changes.removed.length} removed</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!collabData?.history || collabData.history.length === 0) && (
                      <div className="text-[var(--hb-muted)] text-[11px] italic">No version history recorded yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full Width Footer - Notification Feed */}
        <section>
          <NotificationFeed 
            notifications={notifications.map(n => ({
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