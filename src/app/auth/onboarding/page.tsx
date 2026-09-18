'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowRight, Target, BookOpen, CheckCircle } from 'lucide-react'
import { useRouter as useNextRouter } from 'next/navigation'
import { dsaFoundations } from '@/data/dsa-curriculum'

const tracks = [
  {
    key: 'dsa-foundations',
    name: 'DSA Foundations',
    description: 'Master Data Structures & Algorithms from scratch. 14 topics, curated resources, prerequisite-aware progression.',
    yearMin: 1,
    yearMax: 2,
    duration: '14 weeks',
    topics: 14,
    icon: Target
  }
]

export default function OnboardingPage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(1) // 1: year, 2: track
  const [year, setYear] = useState<number | null>(null)
  const [track, setTrack] = useState<string | null>(null)

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (status === 'unauthenticated') {
    return null // Will redirect via layout
  }

  const handleYearSelect = (y: number) => {
    setYear(y)
    setStep(2)
  }

  const handleTrackSelect = async (t: string) => {
    setTrack(t)
    
    // Update user in backend
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, track: t })
      })
      
      // Update session
      await update({ year, activeTrack: t })
      
      router.push('/dashboard/today')
      router.refresh()
    } catch (err) {
      console.error('Onboarding error:', err)
    }
  }

  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">StudyOS</span>
            </div>
            <CardTitle className="text-2xl">What year are you in?</CardTitle>
            <CardDescription>
              This helps us personalize your roadmap
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4].map(y => (
              <Button
                key={y}
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => handleYearSelect(y)}
              >
                <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center font-semibold text-emerald-700 dark:text-emerald-300">
                  {y}
                </span>
                <div className="text-left">
                  <p className="font-medium">Year {y}</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {y === 1 ? 'Foundation building' : y === 2 ? 'Core patterns' : y === 3 ? 'Placement prep' : 'Advanced topics'}
                  </p>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Step 2: Track selection
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4 py-12">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">StudyOS</span>
          </div>
          <CardTitle className="text-2xl">What do you want to work on?</CardTitle>
          <CardDescription>
            Year {year} • Choose your focus track
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tracks.filter(t => t.yearMin <= (year || 0) && t.yearMax >= (year || 0)).map(t => (
            <Button
              key={t.key}
              variant="outline"
              className="w-full justify-start gap-4 p-6 h-auto text-left"
              onClick={() => handleTrackSelect(t.key)}
              disabled={!t}
            >
              <t.icon className="h-10 w-10 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div className="text-left flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg">{t.name}</h3>
                  <span className="px-2 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
                    {t.duration}
                  </span>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t.description}</p>
                <div className="flex items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {t.topics} topics
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3" />
                    Years {t.yearMin}–{t.yearMax}
                  </span>
                </div>
              </div>
            </Button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}