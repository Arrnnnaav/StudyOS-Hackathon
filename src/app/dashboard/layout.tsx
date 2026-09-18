'use client'

import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { LayoutDashboard, BookOpen, Clock, BarChart, Settings, LogOut, BookMarked, Flame, FolderPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Today', href: '/dashboard/today', icon: Flame },
  { name: 'Roadmap', href: '/dashboard/roadmap', icon: BookOpen },
  { name: 'Topics', href: '/dashboard/topics', icon: BookMarked },
  { name: 'Custom Topics', href: '/dashboard/custom-topics', icon: FolderPlus },
  { name: 'Review', href: '/dashboard/review', icon: Clock },
  { name: 'Progress', href: '/dashboard/progress', icon: BarChart },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()

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

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 transform transition-transform duration-200 lg:translate-x-0">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-2 px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">StudyOS</span>
          </div>
          
          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
          
          {/* User Menu */}
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
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
                  onClick={() => fetch('/api/auth/signout', { method: 'POST' }).then(() => router.push('/'))}
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
      <main className="lg:ml-64 min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              {navigation.find(n => pathname === n.href || pathname.startsWith(n.href + '/'))?.name || 'Dashboard'}
            </h1>
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-sm text-neutral-500 dark:text-neutral-400">
                Year {session?.user?.year || '?'} • {session?.user?.activeTrack || 'DSA Foundations'}
              </span>
            </div>
          </div>
        </header>
        
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}