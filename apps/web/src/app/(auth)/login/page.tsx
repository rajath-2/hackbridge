"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    // Mock login, redirecting to organizer for demo
    router.push("/dashboard/organizer")
  }

  return (
    <div className="min-h-screen dashboard-root flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[var(--hb-surface2)] border border-[var(--hb-border)] rounded-[10px] p-8 flex flex-col items-center">
        <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--hb-text)] mb-2">
          Hack<span className="text-[var(--hb-indigo-bright)]">Bridge</span>
        </h1>
        <h2 className="text-[15px] font-semibold text-[var(--hb-muted)] mb-6 text-center">
          Sign in to HackBridge
        </h2>
        
        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <div>
            <Input 
              type="email" 
              placeholder="Email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" variant="primary" className="w-full mt-2">
            Sign in
          </Button>
        </form>

        <div className="mt-6 text-[11px]">
          <a href="/signup" className="text-[var(--hb-indigo-bright)] hover:underline">
            Don't have an account? Sign up &rarr;
          </a>
        </div>
      </div>
    </div>
  )
}
