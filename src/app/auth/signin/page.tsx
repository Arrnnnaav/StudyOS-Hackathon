'use client'

import { signIn } from 'next-auth/react'
import { Suspense, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowRight, Play } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { PUBLIC_DEMO_ACCESS, PUBLIC_STUDENT_DEMO_ACCESS } from '@/shared/demo-auth'

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SignInForm />
    </Suspense>
  )
}

function SignInForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/auth/continue'
  const preferredMode = searchParams.get('mode') === 'master' ? 'master' : 'student'
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleDemoAccess = async (access: string) => {
    setIsLoading(true)
    setError('')
    try {
      await signIn('credentials', { access, callbackUrl })
    } catch (err) {
      setError('Unable to open the live demo')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">StudyOS</span>
          </div>
          <CardTitle className="text-2xl">Open the live demo</CardTitle>
          <CardDescription>
            No signup required. Start with the ready-to-use student dashboard, or open the master workspace separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            onClick={() => void handleDemoAccess(preferredMode === 'master' ? PUBLIC_DEMO_ACCESS : PUBLIC_STUDENT_DEMO_ACCESS)}
            disabled={isLoading}
            className="w-full gap-2"
            size="lg"
          >
            <Play className="h-5 w-5" />
            {preferredMode === 'master' ? 'Open Master Admin' : 'Open Student Dashboard'}
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>

          <Button
            onClick={() => void handleDemoAccess(preferredMode === 'master' ? PUBLIC_STUDENT_DEMO_ACCESS : PUBLIC_DEMO_ACCESS)}
            disabled={isLoading}
            variant="outline"
            className="w-full gap-2"
          >
            {preferredMode === 'master' ? 'Open Student Dashboard instead' : 'Open Master Admin instead'}
          </Button>

          {error && (
            <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg text-center">
              {error}
            </div>
          )}

          <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
            By continuing, you agree to our{' '}
            <a href="/terms" className="underline hover:text-emerald-600">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="underline hover:text-emerald-600">Privacy Policy</a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
