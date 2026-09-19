'use client'

import { signIn } from 'next-auth/react'
import { Suspense, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ArrowRight, Globe } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    setError('')
    try {
      await signIn('google', { callbackUrl })
    } catch (err) {
      setError('Failed to sign in with Google')
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
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to continue your DSA journey
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Google Sign In */}
          <Button
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full gap-2"
            size="lg"
          >
            <Globe className="h-5 w-5" />
            Continue with Google
            <ArrowRight className="h-4 w-4 ml-auto" />
          </Button>

          <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
            StudyOS currently uses Google sign-in only. Email-and-password accounts are not offered.
          </p>

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
