"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Users, ShieldAlert, Award, LogOut } from "lucide-react"

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Matching", href: "/dashboard/matching", icon: Users },
  { name: "Integrity", href: "/dashboard/integrity", icon: ShieldAlert },
  { name: "Judging", href: "/dashboard/judging", icon: Award },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-display text-xl font-bold tracking-tight text-[var(--text-primary)] uppercase">
              HACK<span className="text-[var(--signal-live)]">BRIDGE</span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={pathname === item.href ? "secondary" : "ghost"}
                    className="gap-2"
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="danger" size="sm" className="gap-2 h-[36px] px-4 font-ui text-[11px] font-bold tracking-widest">
              <LogOut className="h-4 w-4" />
              SIGN OUT
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
