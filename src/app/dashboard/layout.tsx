'use client'

import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { BookOpen, Clock, BarChart, Settings, LogOut, BookMarked, Flame, FolderPlus, Building2, Menu, X, UserRound } from 'lucide-react'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Today', href: '/dashboard/today', icon: Flame },
  { name: 'Roadmap', href: '/dashboard/roadmap', icon: BookOpen },
  { name: 'Topics', href: '/dashboard/topics', icon: BookMarked },
  { name: 'Custom Topics', href: '/dashboard/custom-topics', icon: FolderPlus },
  { name: 'Organization', href: '/dashboard/organization', icon: Building2 },
  { name: 'Review', href: '/dashboard/review', icon: Clock },
  { name: 'Progress', href: '/dashboard/progress', icon: BarChart },
  { name: 'Profile', href: '/dashboard/profile', icon: UserRound },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-8 bg-neutral-200 dark:bg-neutral-700 rounded w-48 mx-auto mb-4"></div>
          <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-32 mx-auto"></div>
        </div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 dark:bg-neutral-950 dark:text-neutral-100">
      {menuOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[1px] lg:hidden" onClick={closeMenu} />}
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-[17.5rem] border-r border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-950/10 backdrop-blur-xl transition-transform duration-300 dark:border-neutral-800 dark:bg-neutral-900/95 lg:w-64 lg:translate-x-0 lg:shadow-none',
        menuOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between gap-2 px-5 py-5 border-b border-slate-100 dark:border-neutral-800">
            <Link href="/dashboard/today" onClick={closeMenu} className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-sm font-black text-white shadow-lg shadow-emerald-600/25">S</span>
              <span className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">StudyOS</span>
            </Link>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={closeMenu} aria-label="Close navigation"><X /></Button>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={closeMenu}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-900/50'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          
          {/* User Menu */}
          <div className="p-4 border-t border-slate-100 dark:border-neutral-800">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 px-2 py-1.5">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session?.user?.image || ''} alt={session?.user?.name || ''} />
                    <AvatarFallback>{session?.user?.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="text-left flex-1 truncate">
                    <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {session?.user?.name || 'User'}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {session?.user?.email}
                    </p>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48" align="end" forceMount>
                <div className="px-2 py-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {session?.user?.email}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="flex items-center gap-2 w-full">
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-red-600 dark:text-red-400"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="min-h-screen lg:ml-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#f8fafc]/80 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/80">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="border-slate-200 bg-white lg:hidden dark:bg-neutral-900" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu /></Button>
              <h1 className="text-base font-semibold tracking-tight text-slate-900 dark:text-neutral-100 sm:text-xl">
              {navigation.find(n => pathname === n.href || pathname.startsWith(n.href + '/'))?.name || 'Dashboard'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-sm text-neutral-500 dark:text-neutral-400">
                Year {session?.user?.year || '?'} • {session?.user?.activeTrack || 'DSA Foundations'}
              </span>
            </div>
          </div>
        </header>
        
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
