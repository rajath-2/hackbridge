"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
    <div className="min-h-screen bg-[var(--void)] flex items-center justify-center p-6 selection:bg-[var(--signal-info)] selection:text-[var(--void)]">
      <div className="w-full max-w-[400px] bg-[var(--surface-1)] border border-[var(--border)] rounded-[4px] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
        {/* Terminal Header */}
        <div className="bg-[var(--surface-2)] border-b border-[var(--border)] px-4 py-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--signal-alert)] opacity-50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--signal-ping)] opacity-50"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[var(--signal-live)] opacity-50"></div>
          </div>
          <div className="t-micro uppercase opacity-50 font-bold tracking-widest">Auth_Protocol_v1.5</div>
          <div className="w-[40px]"></div>
        </div>

        <div className="p-8">
          <div className="mb-8 text-center">
            <h1 className="t-display text-[28px] uppercase text-[var(--text-primary)] mb-2">
              HACK<span className="text-[var(--signal-info)]">BRIDGE</span>
            </h1>
            <p className="t-micro uppercase opacity-50 tracking-widest">Establish Secure Uplink</p>
          </div>
          
          {errorMsg && (
            <div className="mb-6 p-3 bg-[var(--signal-alert)]/10 border border-[var(--signal-alert)]/30 text-[var(--signal-alert)] t-micro uppercase text-center">
              ACCESS_DENIED: {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="t-micro uppercase opacity-50 ml-1">Identity_Handle</label>
              <Input 
                type="email" 
                placeholder="EMAIL_ADDRESS" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-[var(--surface-2)] border-[var(--border)] focus:border-[var(--signal-info)] h-12 t-code"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="t-micro uppercase opacity-50 ml-1">Access_Cipher</label>
              <Input 
                type="password" 
                placeholder="PASSWORD" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[var(--surface-2)] border-[var(--border)] focus:border-[var(--signal-info)] h-12 t-code"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full h-14 mt-4 bg-[var(--signal-info)] text-[var(--void)] font-bold t-section uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all"
              disabled={loading}
            >
              {loading ? "AUTHENTICATING..." : "INITIATE_UPLINK"}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-[var(--border)] text-center">
            <a href="/signup" className="t-micro uppercase text-[var(--signal-info)] hover:opacity-80 transition-opacity tracking-widest">
              Create New Identity Node &rarr;
            </a>
          </div>
        </div>
      </div>

      {/* Decorative background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--signal-info)] blur-[120px] rounded-full"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--signal-alert)] blur-[120px] rounded-full opacity-30"></div>
      </div>
    </div>
  )
}
