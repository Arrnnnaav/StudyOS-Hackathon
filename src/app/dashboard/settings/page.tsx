'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ListChecks, KeyRound, RefreshCw, ExternalLink } from 'lucide-react'

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pairingError, setPairingError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  if (status === 'loading') {
    return <div className="flex h-64 items-center justify-center">Loading...</div>
  }

  if (status === 'unauthenticated') {
    return null
  }

  const generateCode = async () => {
    setGenerating(true)
    setCopied(false)
    setPairingError('')
    try {
      const res = await fetch('/api/extension/pair-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to generate code')
      const data = await res.json()
      setPairingCode(data.code)
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : 'Failed to generate code')
    } finally {
      setGenerating(false)
    }
  }

  const copyCode = () => {
    if (!pairingCode) return
    navigator.clipboard?.writeText(pairingCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">⚙️</span>
          <h1 className="text-3xl font-bold text-neutral-950 dark:text-neutral-50">Settings</h1>
        </div>
        <p className="text-neutral-600 dark:text-neutral-400">
          Connect the StudyOS Chrome extension and manage your account.
        </p>
      </div>

      {/* Profile */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
            <span className="text-neutral-600 dark:text-neutral-400">Name</span>
            <span className="font-medium">{session?.user?.name || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
            <span className="text-neutral-600 dark:text-neutral-400">Email</span>
            <span className="font-medium">{session?.user?.email || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-neutral-200 dark:border-neutral-700">
            <span className="text-neutral-600 dark:text-neutral-400">Year</span>
            <span className="font-medium">Year {(session?.user as any)?.year || '—'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-neutral-600 dark:text-neutral-400">Active track</span>
            <span className="font-medium">{(session?.user as any)?.activeTrack || 'DSA Foundations'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Extension pairing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Connect Extension
          </CardTitle>
          <CardDescription>
            Generate a 6-character pairing code to connect the StudyOS Chrome extension to your account.
            The code expires in 10 minutes and is single-use. This is a beta pairing flow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pairingCode ? (
            <div className="space-y-3">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-center">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-2">Your pairing code</p>
                <div className="flex items-center justify-center gap-2">
                  <Input
                    readOnly
                    value={pairingCode}
                    className="w-40 text-center text-2xl tracking-widest font-mono font-bold"
                  />
                  <Button variant="outline" onClick={copyCode}>
                    {copied ? 'Copied!' : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3">
                  1. Open the StudyOS extension side panel • 2. Click &quot;Pair with StudyOS&quot; • 3. Enter this code
                </p>
              </div>
              <Button variant="ghost" onClick={generateCode} disabled={generating}>
                Generate new code
              </Button>
            </div>
          ) : (
            <Button onClick={generateCode} disabled={generating} className="gap-2">
              <KeyRound className="h-4 w-4" />
              {generating ? 'Generating...' : 'Get pairing code'}
            </Button>
          )}
          {pairingError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{pairingError}</p>}

          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
              Don&apos;t have the extension yet? Load it in Chrome:
            </p>
            <ol className="text-sm text-neutral-600 dark:text-neutral-400 list-decimal list-inside space-y-1">
              <li>Open <code className="text-emerald-600">chrome://extensions</code></li>
              <li>Enable <strong>Developer mode</strong></li>
              <li>Click <strong>Load unpacked</strong> and select the <code>/extension</code> folder</li>
            </ol>
            <a
              href="/dashboard/settings/pairing-guide"
              className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 mt-3 hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> Read the pairing guide
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
