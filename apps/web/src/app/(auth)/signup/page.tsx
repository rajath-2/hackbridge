"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"

export default function SignupPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("participant")
  const router = useRouter()

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault()
    // Mock signup, redirecting to selected role
    router.push(`/dashboard/${role}`)
  }

  return (
    <div className="min-h-screen dashboard-root flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[var(--hb-surface2)] border border-[var(--hb-border)] rounded-[10px] p-8 flex flex-col items-center">
        <h1 className="text-[22px] font-bold tracking-[-0.03em] text-[var(--hb-text)] mb-2">
          Hack<span className="text-[var(--hb-indigo-bright)]">Bridge</span>
        </h1>
        <h2 className="text-[15px] font-semibold text-[var(--hb-muted)] mb-6 text-center">
          Create an account
        </h2>
        
        <form onSubmit={handleSignup} className="w-full flex flex-col gap-4">
          <div>
            <Input 
              type="text" 
              placeholder="Full Name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
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
          <div>
            <Select 
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="organizer">Organizer</option>
              <option value="participant">Participant</option>
              <option value="mentor">Mentor</option>
              <option value="judge">Judge</option>
            </Select>
          </div>
          <Button type="submit" variant="primary" className="w-full mt-2">
            Create account
          </Button>
        </form>

        <div className="mt-6 text-[11px]">
          <a href="/login" className="text-[var(--hb-indigo-bright)] hover:underline">
            Already have an account? Sign in &rarr;
          </a>
        </div>
      </div>
    </div>
  )
}
