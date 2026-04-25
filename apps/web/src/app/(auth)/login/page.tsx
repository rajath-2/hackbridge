"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")
    setLoading(true)
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      setLoading(false)
      const role = data.user.user_metadata?.role || 'participant'

      if (role === 'organizer') router.push('/dashboard/organizer')
      else if (role === 'mentor') router.push('/dashboard/mentor')
      else if (role === 'judge') router.push('/dashboard/judge')
      else router.push('/dashboard/participant')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--void)] flex items-center justify-center p-6 selection:bg-[var(--signal-live)] selection:text-[var(--void)] overflow-hidden relative">
      {/* Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-150 mix-blend-overlay"></div>
      <div className="absolute inset-0 pointer-events-none opacity-[0.15]" style={{ backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)", backgroundSize: "40px 40px" }}></div>

      {/* Animated Background - Matching Landing Page */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--signal-live)]/10 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[var(--signal-info)]/10 blur-[150px] rounded-full"></div>
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] bg-[var(--signal-alert)]/5 blur-[120px] rounded-full"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-[440px] bg-[var(--surface-1)]/80 backdrop-blur-xl border border-[var(--border)] rounded-lg overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.4)] relative z-10"
      >
        {/* Terminal Header */}
        <div className="bg-[var(--surface-2)]/50 border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--signal-alert)]/60"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--signal-ping)]/60"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--signal-live)]/60"></div>
          </div>
          <div className="t-micro uppercase opacity-70 font-bold tracking-[0.2em]">Auth_Protocol_v2.0</div>
          <div className="w-[40px]"></div>
        </div>

        <div className="p-10">
          <div className="mb-10 text-center">
            <Link href="/">
              <motion.h1 
                whileHover={{ scale: 1.02 }}
                className="t-display text-[32px] uppercase text-[var(--text-primary)] mb-3 cursor-pointer tracking-tight"
              >
                HACK<span className="text-[var(--signal-live)]">BRIDGE</span>
              </motion.h1>
            </Link>
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-[var(--signal-live)]/30 bg-[var(--signal-live)]/5 rounded-full">
              <span className="t-micro uppercase text-[var(--signal-live)] tracking-widest font-bold">Secure_Uplink_Required</span>
            </div>
          </div>
          
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6 p-4 bg-[var(--signal-alert)]/10 border border-[var(--signal-alert)]/30 text-[var(--signal-alert)] t-micro uppercase text-center font-bold tracking-widest"
            >
              ACCESS_DENIED: {errorMsg}
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="t-micro uppercase opacity-80 ml-1 font-bold tracking-widest">Identity_Handle</label>
              <Input 
                type="email" 
                placeholder="EMAIL_ADDRESS" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-[var(--surface-2)]/50 border-[var(--border)] focus:border-[var(--signal-live)] h-12 t-code px-4"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="t-micro uppercase opacity-80 ml-1 font-bold tracking-widest">Access_Cipher</label>
              <Input 
                type="password" 
                placeholder="PASSWORD" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[var(--surface-2)]/50 border-[var(--border)] focus:border-[var(--signal-live)] h-12 t-code px-4"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-14 mt-4 bg-[var(--signal-live)] text-[var(--void)] font-bold t-section uppercase tracking-widest shadow-[0_0_20px_rgba(0,255,194,0.3)] hover:brightness-110"
              disabled={loading}
            >
              {loading ? "AUTHENTICATING..." : "INITIATE_UPLINK"}
            </Button>
          </form>

          <div className="mt-10 pt-8 border-t border-[var(--border)] text-center">
            <Link href="/signup" className="t-micro uppercase text-[var(--signal-live)] hover:text-[var(--text-primary)] transition-colors tracking-widest font-bold">
              Create New Identity Node &rarr;
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
