"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  ShieldCheck,
  Zap,
  Users,
  Terminal as TerminalIcon,
  Cpu,
  Globe,
  ArrowRight
} from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--void)] text-[var(--text-primary)] font-sans selection:bg-[var(--signal-live)] selection:text-[var(--void)]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border)] bg-[var(--void)]/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold tracking-tight uppercase">
              HACK<span className="text-[var(--signal-live)]">BRIDGE</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 font-ui text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">
            <Link href="#features" className="hover:text-[var(--signal-live)] transition-colors">Protocol</Link>
            <Link href="#security" className="hover:text-[var(--signal-live)] transition-colors">Integrity</Link>
            <Link href="#network" className="hover:text-[var(--signal-live)] transition-colors">Network</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="font-ui text-[11px] uppercase tracking-widest hover:text-[var(--signal-live)] border-none">
                Login
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-[var(--signal-live)] !text-[var(--void)] border-transparent font-bold font-ui text-[11px] uppercase tracking-widest px-6 transition-all hover:scale-[1.02] shadow-none">
                Initialize
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 px-6 overflow-hidden">
          {/* Animated Background */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--signal-live)]/5 blur-[150px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[var(--signal-info)]/5 blur-[150px] rounded-full"></div>
            <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-[var(--signal-alert)]/3 blur-[120px] rounded-full"></div>
          </div>

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="flex-1 text-center lg:text-left">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  <div className="inline-flex items-center gap-2 px-3 py-1 border border-[var(--signal-live)]/30 bg-[var(--signal-live)]/5 rounded-full mb-6">
                    <div className="w-2 h-2 rounded-full bg-[var(--signal-live)] dot-live"></div>
                    <span className="font-ui text-[10px] text-[var(--signal-live)] uppercase tracking-widest font-bold">Protocol v2.0 Live</span>
                  </div>
                  <h1 className="t-display text-5xl md:text-7xl lg:text-8xl mb-6 leading-tight">
                    NEXT-GEN <br />
                    <span className="text-[var(--signal-live)]">INTELLIGENCE</span> <br />
                    FOR HACKATHONS
                  </h1>
                  <p className="font-body text-lg text-[var(--text-secondary)] mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                    The OS for modern innovation events. Real-time matching, integrity monitoring,
                    and advanced logistics orchestration — all in one unified command center.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                    <Link href="/signup">
                      <Button className="h-14 px-10 bg-[var(--signal-live)]/90 !text-[var(--void)] border-transparent font-bold t-section uppercase tracking-widest hover:scale-105 hover:bg-[var(--signal-live)] transition-all shadow-md shadow-[var(--signal-live)]/5">
                        Launch Network
                      </Button>
                    </Link>
                    <Link href="/login">
                      <Button variant="ghost" className="h-14 px-10 border-[var(--border)] text-[var(--text-primary)] font-bold t-section uppercase tracking-widest hover:border-[var(--signal-live)] hover:text-[var(--signal-live)] transition-all">
                        Access Console
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              </div>

              <motion.div
                className="flex-1 w-full max-w-[600px]"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <div className="bg-[var(--surface-1)] border border-[var(--border)] rounded-lg overflow-hidden shadow-2xl">
                  <div className="bg-[var(--surface-2)] border-b border-[var(--border)] px-4 py-2 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--signal-alert)]/50"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--signal-ping)]/50"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--signal-live)]/50"></div>
                    </div>
                    <div className="t-micro uppercase opacity-50 font-bold tracking-widest">system_monitor.sh</div>
                    <div className="w-10"></div>
                  </div>
                  <div className="p-6 font-display text-[12px] leading-relaxed text-[var(--text-secondary)]">
                    <div className="text-[var(--signal-live)] mb-1">➜ Initializing HackBridge Core...</div>
                    <div className="mb-1 text-[var(--text-muted)]">[OK] Memory banks allocated.</div>
                    <div className="mb-1 text-[var(--text-muted)]">[OK] Cryptographic handshake complete.</div>
                    <div className="mb-1 text-[var(--signal-info)]">➜ Scoping event parameters: GLOBAL_FINTECH_2026</div>
                    <div className="mb-1">Searching for participants... <span className="text-[var(--signal-live)]">645 nodes found.</span></div>
                    <div className="mb-1">Analyzing team velocity... <span className="text-[var(--signal-ping)]">Optimal matching active.</span></div>
                    <div className="mb-1 text-[var(--signal-alert)]">! Integrity Warning: Node ID-42 anomalous commit frequency.</div>
                    <div className="mb-1">➜ Deploying Mentor Response Unit... <span className="text-[var(--signal-live)]">Deployed.</span></div>
                    <div className="mt-4 flex gap-1">
                      <span className="text-[var(--signal-live)]">➜</span>
                      <span className="text-[var(--text-primary)] inline-block w-2 h-4 bg-[var(--signal-live)] cli-cursor"></span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 px-6 bg-[var(--surface-1)]/30 border-y border-[var(--border)]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <h2 className="t-display text-4xl mb-4">ENGINEERED FOR EXCELLENCE</h2>
              <p className="font-ui text-[10px] uppercase tracking-[0.3em] text-[var(--signal-live)]">Protocol Capabilities</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Cpu className="w-6 h-6" />}
                title="AI MATCHING"
                description="Vector-based team formation using skill synergy, project intent, and personality alignment."
              />
              <FeatureCard
                icon={<ShieldCheck className="w-6 h-6" />}
                title="INTEGRITY SHIELD"
                description="Real-time plagiarism detection and velocity audit to ensure radical transparency in development."
              />
              <FeatureCard
                icon={<Zap className="w-6 h-6" />}
                title="REAL-TIME OPS"
                description="Live dashboard for organizers with instant mentor pings and participant health monitoring."
              />
              <FeatureCard
                icon={<Users className="w-6 h-6" />}
                title="MENTOR NETWORK"
                description="Seamlessly bridge the gap between experts and innovators with priority-based request handling."
              />
              <FeatureCard
                icon={<Globe className="w-6 h-6" />}
                title="EVENT AGNOSTIC"
                description="From local meetups to global 10k+ participant hackathons, the infrastructure scales automatically."
              />
              <FeatureCard
                icon={<TerminalIcon className="w-6 h-6" />}
                title="CLI FIRST"
                description="Power tools for developers to initialize projects, submit code, and track progress without leaving the terminal."
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-10">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-[var(--signal-live)] blur-[180px] rounded-full"></div>
          </div>

          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="t-display text-5xl md:text-6xl mb-8">READY TO BRIDGE THE GAP?</h2>
            <p className="font-body text-xl text-[var(--text-secondary)] mb-12">
              Join the growing network of elite organizers and innovators.
              The future of hackathons is decentralized, intelligent, and real-time.
            </p>
            <Link href="/signup">
              <Button className="h-16 px-12 bg-[var(--signal-live)]/90 !text-[var(--void)] border-transparent font-bold t-section uppercase tracking-widest hover:scale-105 hover:bg-[var(--signal-live)] transition-all flex items-center gap-4 mx-auto group shadow-md shadow-[var(--signal-live)]/5">
                Initialize Your Event
                <ArrowRight className="group-hover:translate-x-2 transition-transform" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[var(--border)] bg-[var(--surface-1)]">
        <div className="max-w-7xl mx-auto flex flex-col md:row items-center justify-between gap-8">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-bold tracking-tight uppercase">
              HACK<span className="text-[var(--signal-live)]">BRIDGE</span>
            </span>
          </div>
          <div className="flex gap-12 font-ui text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
            <Link href="#" className="hover:text-[var(--text-primary)] transition-colors">Documentation</Link>
            <Link href="#" className="hover:text-[var(--text-primary)] transition-colors">Security</Link>
            <Link href="#" className="hover:text-[var(--text-primary)] transition-colors">Privacy</Link>
          </div>
          <div className="t-micro uppercase text-[var(--text-muted)] tracking-widest">
            © 2026 HACKBRIDGE_PROTOCOLS. ALL_RIGHTS_RESERVED.
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div
      whileHover={{ y: -8 }}
      className="p-8 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg hover:border-[var(--signal-live)] transition-all group shadow-lg"
    >
      <div className="w-12 h-12 bg-[var(--void)] border border-[var(--border)] rounded flex items-center justify-center text-[var(--signal-live)] mb-6 group-hover:shadow-[0_0_15px_rgba(0,255,194,0.3)] transition-all">
        {icon}
      </div>
      <h3 className="t-display text-xl mb-4 group-hover:text-[var(--signal-live)] transition-colors">{title}</h3>
      <p className="font-body text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
    </motion.div>
  )
}
