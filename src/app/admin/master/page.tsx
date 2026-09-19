'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Copy, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Organization = { id: string; name: string; createdAt: string }
type OrganizationOverview = { metrics: { students: number; admins: number; publishedTopics: number; assignedTopics: number }; learners: Array<{ userId: string; completedTopics: number; activeTopics: number }> }
type OrganizationTopic = { id: string; title: string; status: string }

export default function MasterAdminPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [overviews, setOverviews] = useState<Record<string, OrganizationOverview>>({})
  const [topicsByOrganization, setTopicsByOrganization] = useState<Record<string, OrganizationTopic[]>>({})
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/organizations')
    if (!response.ok) return
    const body = await response.json()
    const nextOrganizations = body.organizations || []
    setOrganizations(nextOrganizations)
    const entries = await Promise.all(nextOrganizations.map(async (organization: Organization) => {
      const [overview, topics] = await Promise.all([fetch(`/api/admin/organizations/${organization.id}/overview`), fetch(`/api/admin/organizations/${organization.id}/topics`)])
      return [organization.id, overview.ok ? await overview.json() : undefined, topics.ok ? (await topics.json()).topics : []] as const
    }))
    setOverviews(Object.fromEntries(entries.filter((entry): entry is readonly [string, OrganizationOverview, OrganizationTopic[]] => Boolean(entry[1])).map(([id, overview]) => [id, overview])))
    setTopicsByOrganization(Object.fromEntries(entries.map(([id, , topics]) => [id, topics])))
  }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])
  const create = async () => { const response = await fetch('/api/admin/organizations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); if (!response.ok) return; setName(''); await load() }
  const inviteAdmin = async (organizationId: string) => { const response = await fetch(`/api/admin/organizations/${organizationId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'organization_admin' }) }); const body = await response.json(); if (response.ok) { const link = `${window.location.origin}/dashboard/organization?invite=${body.invite.token}`; await navigator.clipboard?.writeText(link); setMessage(`Admin invite copied for ${organizationId}`) } }
  const unpublish = async (organizationId: string, topicId: string) => { const response = await fetch(`/api/admin/organizations/${organizationId}/topics/${topicId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'unpublished' }) }); if (response.ok) { setMessage('Topic unpublished'); await load() } }
  return <main className="mx-auto max-w-5xl space-y-6 px-5 py-10"><header><p className="flex items-center gap-2 text-sm font-semibold text-violet-700"><ShieldCheck className="h-4 w-4" /> PLATFORM CONTROL</p><h1 className="mt-1 text-3xl font-bold">Master Admin</h1><p className="mt-2 text-slate-500">Create organizations, appoint publishers, and see organization-only learning progress across the platform.</p></header><Card><CardHeader><CardTitle>New organization</CardTitle></CardHeader><CardContent className="flex flex-col gap-3 sm:flex-row"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. North Campus DSA Club" /><Button onClick={create} disabled={!name.trim()}><Building2 /> Create organization</Button></CardContent></Card>{message && <p className="text-sm text-emerald-700">{message}</p>}<section className="grid gap-4 sm:grid-cols-2">{organizations.map((organization) => { const overview = overviews[organization.id]; return <Card key={organization.id}><CardHeader><div className="flex justify-between gap-3"><CardTitle>{organization.name}</CardTitle><Badge variant="secondary">Organization</Badge></div></CardHeader><CardContent><p className="text-xs text-slate-500">Created {new Date(organization.createdAt).toLocaleDateString()}</p>{overview && <><p className="mt-3 text-sm text-slate-600">{overview.metrics.students} students · {overview.metrics.admins} admins · {overview.metrics.publishedTopics} published topics</p><div className="mt-2 space-y-1 text-xs text-slate-500">{overview.learners.map((learner) => <p key={learner.userId}>{learner.userId}: {learner.completedTopics} complete, {learner.activeTopics} active assignments</p>)}</div></>}<div className="mt-3 space-y-2">{(topicsByOrganization[organization.id] || []).filter((topic) => topic.status === 'published').map((topic) => <div key={topic.id} className="flex items-center justify-between gap-2 text-sm"><span>{topic.title}</span><Button size="sm" variant="ghost" onClick={() => void unpublish(organization.id, topic.id)}>Unpublish</Button></div>)}</div><Button variant="outline" className="mt-4" onClick={() => void inviteAdmin(organization.id)}><Copy /> Copy admin invite</Button></CardContent></Card>})}</section></main>
}
