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
      <div className="min-h-screen dashboard-root">
        <NavBar role="mentor" />
        <main className="max-w-[640px] mx-auto px-6 py-16">
          <div className="text-center mb-10">
            <h1 className="text-[26px] font-bold text-[var(--hb-text)] mb-2">
              Welcome, Mentor
            </h1>
            <p className="text-[15px] text-[var(--hb-muted)]">
              Enter the event code shared by the organizer to join the hackathon.
            </p>
          </div>

          {/* Join Event Card */}
          <Card variant="elevated" className="p-8 mb-8">
            <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-4 font-semibold">
              Join Hackathon Event
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                <Input
                  placeholder="e.g. HACK26"
                  value={eventCode}
                  onChange={(e) => setEventCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinEvent()}
                  className="text-[15px] font-mono tracking-wider h-12"
                />
              </div>

              {/* Domain / Expertise Selector */}
              <div>
                <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-1.5 font-semibold">
                  Your Domain / Expertise
                </div>
                <Input
                  list="domain-options"
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  placeholder="Select or type your specialization..."
                  className="h-11 text-[14px]"
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
                <p className="text-[11px] text-[var(--hb-muted)] mt-1.5">
                  Teams in this domain will be prioritized during assignment.
                </p>
              </div>

              <Button
                variant="primary"
                onClick={handleJoinEvent}
                disabled={joining || !eventCode.trim() || !selectedDomain}
                className="h-12 text-[14px] w-full"
              >
                {joining ? "Joining..." : "Join Event"}
              </Button>
            </div>

            {joinError && (
              <div className="mt-3 text-[13px] text-[var(--hb-red)] font-medium animate-notif-in">
                ✕ {joinError}
              </div>
            )}
          </Card>

          {/* Optional Resume Upload */}
          <div className="max-w-[520px] mx-auto">
            <div className="flex items-center gap-2 mb-1">
              <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] font-semibold">
                Resume Upload
              </div>
              <Badge variant="indigo" className="text-[9px]">Optional</Badge>
            </div>
            <ResumeUpload
              role="mentor"
              existingProfile={mentorProfile || undefined}
              onUploadComplete={(analysis) => setMentorProfile(analysis)}
              className="[&>div:first-child>div:first-child]:hidden"
            />
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

  return (
    <div className="min-h-screen dashboard-root">
      <NavBar eventCode={event?.event_code || "HACK26"} role="mentor" />

      <main className="max-w-[1200px] mx-auto px-6 py-8">

        {/* Profile Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-6 border-b border-[var(--hb-border)]">
          <div>
            <h1 className="text-[24px] font-bold text-[var(--hb-text)] mb-2">
              {user?.user_metadata?.name || user?.user_metadata?.full_name || "Mentor Dashboard"}
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[var(--hb-muted)]">{user?.email}</span>
              {mentorProfile?.expertise_tags && mentorProfile.expertise_tags.length > 0 && (
                <>
                  <span className="text-[var(--hb-dim)]">•</span>
                  <Badge variant="amber" className="text-[10px]">
                    {mentorProfile.expertise_tags[0]}
                  </Badge>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stat Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard label="Assigned Teams" value={teams.length.toString()} sub="Active" />
          <StatCard
            label="Pending Pings"
            value={<span className="text-[var(--hb-amber)]">{pings.length}</span>}
            sub="Awaiting response"
          />
          <StatCard label="Commits Today" value={commits.length.toString()} sub="Across all teams" />
        </div>

        {/* Main Grid: Pings + Commits */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">

          {/* Pings Column */}
          <div className="flex flex-col gap-3">
            <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] font-semibold">
              Incoming Pings
            </div>
            {pings.length > 0 ? pings.map(ping => (
              <div key={ping.id} className="relative">
                <NotificationCard
                  type="MENTOR PING"
                  message={ping.message}
                  meta={new Date(ping.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  variant="mentor-ping"
                />
                <Button variant="ghost" size="sm" className="absolute top-3 right-3 text-[11px] text-[var(--hb-amber)] hover:text-[#F0C060]">
                  View team →
                </Button>
              </div>
            )) : (
              <Card variant="base" className="flex items-center justify-center py-10">
                <span className="text-[13px] text-[var(--hb-dim)] italic">No active pings</span>
              </Card>
            )}
          </div>

          {/* Commit Feed Column */}
          <div className="lg:col-span-2 flex flex-col gap-3 h-[420px]">
            <div className="flex justify-between items-center">
              <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] font-semibold">
                Live Commit Feed
              </div>
              <div className="flex gap-1.5 overflow-x-auto">
                {teams.length > 0 ? teams.map(t => (
                  <Badge key={t.id} variant="indigo">{t.name}</Badge>
                )) : (
                  <span className="text-[11px] text-[var(--hb-dim)] italic">No teams assigned yet</span>
                )}
              </div>
            </div>

            <Card variant="base" className="flex-1 overflow-y-auto">
              <div className="flex flex-col">
                {commits.length > 0 ? commits.map(commit => (
                  <CommitFeedItem
                    key={commit.id}
                    hash={commit.id?.slice(0, 6) || "------"}
                    message={commit.message}
                    aiSummary={commit.ai_summary}
                  />
                )) : (
                  <div className="flex items-center justify-center py-16">
                    <span className="text-[13px] text-[var(--hb-dim)] italic">No commits detected yet</span>
                  </div>
                )}
              </div>
            </Card>
          </div>

        </div>

        {/* Assigned Teams */}
        <div className="mb-10">
          <div className="text-[11px] text-[var(--hb-dim)] uppercase tracking-[0.08em] mb-3 font-semibold">
            Assigned Teams
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.length > 0 ? teams.map(team => (
              <Card key={team.id} variant="base">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[var(--hb-text)]">{team.name}</h3>
                    <div className="flex gap-1.5 mt-1.5">
                      <Badge variant="indigo" className="text-[10px]">
                        {team.selected_track || "General"}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="green">Clean</Badge>
                </div>
                <div className="text-[12px] text-[var(--hb-muted)] mt-4">
                  Code: <span className="font-mono text-[var(--hb-text)]">{team.team_code}</span>
                </div>
              </Card>
            )) : (
              <div className="col-span-3">
                <Card variant="base" className="flex items-center justify-center py-12">
                  <span className="text-[13px] text-[var(--hb-dim)] italic">
                    No teams assigned to you yet. The organizer will assign teams once matching completes.
                  </span>
                </Card>
              </div>
            )}
          </div>
        </div>



        {/* Notification Feed */}
        <section className="mb-8">
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