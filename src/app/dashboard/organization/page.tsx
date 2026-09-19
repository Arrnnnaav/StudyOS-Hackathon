'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Building2, ExternalLink, KeyRound, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Context = {
  actor: { kind: 'master_admin' | 'organization_admin' | 'student'; organizationId?: string } | null
  membership: { organizationId: string; role: string } | null
  organization: { id: string; name: string } | null
  topics: Array<{ id: string; title: string; description: string; objectives: string[]; estimatedMinutes: number; deliveryMode: 'library' | 'assigned' }>
}

export default function OrganizationPage() {
  const [data, setData] = useState<Context | null>(null)
  const [code, setCode] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [message, setMessage] = useState('')
  const load = useCallback(async () => {
    const response = await fetch('/api/organization')
    if (response.ok) setData(await response.json())
  }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])
  useEffect(() => { const timer = window.setTimeout(() => { const token = new URLSearchParams(window.location.search).get('invite'); if (token) setInviteToken(token) }, 0); return () => window.clearTimeout(timer) }, [])

  const join = async () => {
    setMessage('')
    const response = await fetch('/api/organization', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inviteToken.trim() ? { inviteToken: inviteToken.trim() } : { joinCode: code.trim() }) })
    if (!response.ok) { const body = await response.json(); setMessage(body?.error?.message || 'Could not join organization'); return }
    await load()
  }

  if (!data) return <div className="py-16 text-center text-sm text-slate-500">Loading organization…</div>
  if (data.actor?.kind === 'master_admin') return <AdminJump href="/admin/master" label="Open Master Admin" description="Create organizations, appoint organization admins, and monitor the platform." />
  if (data.actor?.kind === 'organization_admin') return <AdminJump href="/admin/organization" label="Open Organization Admin" description="Manage your cohort, publish topics, and share onboarding access." />
  if (!data.membership || !data.organization) return (
    <div className="mx-auto max-w-xl space-y-5 py-8">
      <header><p className="text-sm font-semibold text-emerald-700">JOIN A COHORT</p><h2 className="mt-1 text-3xl font-bold">Learn with an organization</h2><p className="mt-2 text-slate-500">Use a shareable join code or an invite token from your teacher.</p></header>
      <Card><CardContent className="space-y-3 p-5"><Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Join code" /><Input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} placeholder="Invite token (optional)" /><Button onClick={join} disabled={!code.trim() && !inviteToken.trim()}><KeyRound className="h-4 w-4" /> Join organization</Button>{message && <p className="text-sm text-rose-600">{message}</p>}</CardContent></Card>
    </div>
  )
  return <div className="mx-auto max-w-4xl space-y-6 py-3"><header className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-emerald-700">YOUR ORGANIZATION</p><h2 className="mt-1 text-3xl font-bold">{data.organization.name}</h2><p className="mt-2 text-slate-500">Published learning material from your cohort.</p></div><Badge variant="secondary"><Users className="mr-1 h-3.5 w-3.5" /> Student</Badge></header>{data.topics.length === 0 ? <Card><CardContent className="p-8 text-center text-slate-500">Your organization has not published material yet.</CardContent></Card> : <div className="grid gap-4 sm:grid-cols-2">{data.topics.map((topic) => <Card key={topic.id}><CardHeader><div className="flex justify-between gap-2"><CardTitle>{topic.title}</CardTitle><Badge variant={topic.deliveryMode === 'assigned' ? 'default' : 'secondary'}>{topic.deliveryMode === 'assigned' ? 'Assigned' : 'Library'}</Badge></div></CardHeader><CardContent><p className="text-sm text-slate-500">{topic.description}</p><p className="mt-3 text-xs text-slate-500">{topic.objectives.length} objectives · ~{topic.estimatedMinutes} min</p></CardContent></Card>)}</div>}</div>
}

function AdminJump({ href, label, description }: { href: string; label: string; description: string }) {
  return <div className="mx-auto max-w-xl py-12"><Card><CardContent className="p-7"><Building2 className="mb-4 h-8 w-8 text-emerald-600" /><h2 className="text-2xl font-bold">You have organization access</h2><p className="mt-2 text-slate-500">{description}</p><Button className="mt-5" asChild><Link href={href}>{label}<ExternalLink /></Link></Button></CardContent></Card></div>
}
