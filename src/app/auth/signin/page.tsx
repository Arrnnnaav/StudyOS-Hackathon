'use client'

import { signIn } from 'next-auth/react'
import { Suspense, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ArrowRight, Mail, Lock, Globe, AtSign } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SignInForm />
    </Suspense>
  )
}

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard/today'
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

  const handleCredentialsSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email')
    const password = formData.get('password')
    
    // For hackathon demo, we'll use Google OAuth primarily
    setError('Please use Google Sign In for the hackathon demo')
    setIsLoading(false)
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

          <Separator className="my-6">Or continue with email</Separator>

          {/* Email/Password Form */}
          <form onSubmit={handleCredentialsSignIn} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Email
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@university.edu"
                className="w-full"
                disabled
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                className="w-full"
                disabled
              />
            </div>
            <Button type="submit" className="w-full" disabled>
              Sign in
            </Button>
          </form>

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