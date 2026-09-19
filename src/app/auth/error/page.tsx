import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const messages: Record<string, { title: string; description: string }> = {
  Configuration: {
    title: 'Sign-in needs configuration',
    description: 'The Google sign-in connection is not ready. Check the local Google OAuth client ID, secret, and callback URL, then restart the app.',
  },
  AccessDenied: {
    title: 'Google sign-in was cancelled',
    description: 'No account was connected. You can safely try again when you are ready.',
  },
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const { error } = await searchParams
  const errorCode = typeof error === 'string' ? error : ''
  const message = messages[errorCode] ?? {
    title: 'We could not sign you in',
    description: 'Please return to the sign-in page and try again.',
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12 dark:bg-neutral-950">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
          <CardTitle>{message.title}</CardTitle>
          <CardDescription>{message.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/auth/signin"><ArrowLeft /> Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
