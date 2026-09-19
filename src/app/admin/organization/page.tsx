'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, KeyRound, Send, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

type Context = { actor: { kind: string } | null; membership: { organizationId: string } | null; organization: { name: string } | null }
type Topic = { id: string; title: string; status: string; deliveryMode: string; objectives: string[] }

export default function OrganizationAdminPage() {
  const [context, setContext] = useState<Context | null>(null)
  const [members, setMembers] = useState<Array<{ userId: string; role: string }>>([])
  const [learners, setLearners] = useState<Array<{ userId: string; completedTopics: number; activeTopics: number }>>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [joinCode, setJoinCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [objectives, setObjectives] = useState('')
  const [estimatedMinutes, setEstimatedMinutes] = useState('30')
  const [resources, setResources] = useState('')
  const [assigned, setAssigned] = useState(false)
  const [message, setMessage] = useState('')
  const orgId = context?.membership?.organizationId
  const load = useCallback(async () => {
    const current = await fetch('/api/organization').then((response) => response.ok ? response.json() : null)
    setContext(current)
    if (!current?.membership?.organizationId) return
    const id = current.membership.organizationId
    const [memberResponse, topicResponse, overviewResponse] = await Promise.all([fetch(`/api/admin/organizations/${id}/members`), fetch(`/api/admin/organizations/${id}/topics`), fetch(`/api/admin/organizations/${id}/overview`)])
    if (memberResponse.ok) setMembers((await memberResponse.json()).members || [])
    if (topicResponse.ok) setTopics((await topicResponse.json()).topics || [])
    if (overviewResponse.ok) setLearners((await overviewResponse.json()).learners || [])
  }, [])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])
  const rotateCode = async () => { if (!orgId) return; const response = await fetch(`/api/admin/organizations/${orgId}/join-code`, { method: 'POST' }); if (response.ok) setJoinCode((await response.json()).code) }
  const inviteStudent = async () => { if (!orgId) return; const response = await fetch(`/api/admin/organizations/${orgId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'student' }) }); const body = await response.json(); if (response.ok) { await navigator.clipboard?.writeText(`${window.location.origin}/dashboard/organization?invite=${body.invite.token}`); setMessage('Student invite link copied') } }
  const removeStudent = async (userId: string) => { if (!orgId || !window.confirm('Remove this student from the organization? Their personal learning history will remain private.')) return; const response = await fetch(`/api/admin/organizations/${orgId}/members`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) }); if (response.ok) { setMessage('Student removed from this organization'); await load() } }
  const publish = async () => { if (!orgId) return; const parsedResources = resources.split('\n').map((line) => line.split('|').map((part) => part.trim())).filter((parts) => parts.length >= 2 && parts[0] && parts[1]).map(([resourceTitle, url, kind]) => ({ title: resourceTitle, url, kind: kind === 'watch' || kind === 'practice' ? kind : 'read' })); const response = await fetch(`/api/admin/organizations/${orgId}/topics`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, description, objectives: objectives.split('\n').filter(Boolean), estimatedMinutes: Number(estimatedMinutes), resources: parsedResources, deliveryMode: assigned ? 'assigned' : 'library', status: 'published' }) }); if (response.ok) { setTitle(''); setDescription(''); setObjectives(''); setResources(''); await load() } }
  if (!context) return <div className="p-10 text-center text-slate-500">Loading organization admin…</div>
  if (context.actor?.kind !== 'organization_admin') return <div className="mx-auto max-w-xl p-10 text-center text-slate-500">Organization-admin access is required.</div>
  return <main className="mx-auto max-w-5xl space-y-6 px-5 py-10"><header><p className="text-sm font-semibold text-emerald-700">COHORT CONSOLE</p><h1 className="mt-1 text-3xl font-bold">{context.organization?.name}</h1><p className="mt-2 text-slate-500">Publish a learning path, onboard students, and keep your cohort moving.</p></header><section className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Students ({members.filter((member) => member.role === 'student').length})</CardTitle></CardHeader><CardContent className="space-y-3"><Button variant="outline" onClick={() => void inviteStudent()}><Send /> Copy student invite</Button><div className="flex gap-2"><Input value={joinCode} readOnly placeholder="Generate a join code" /><Button variant="outline" size="icon" onClick={() => void rotateCode()} aria-label="Rotate join code"><KeyRound /></Button>{joinCode && <Button variant="outline" size="icon" onClick={() => void navigator.clipboard?.writeText(joinCode)} aria-label="Copy join code"><Copy /></Button>}</div><div className="space-y-2">{members.filter((member) => member.role === 'student').map((member) => <div key={member.userId} className="flex items-center justify-between gap-2 text-sm text-slate-600"><span>{member.userId}</span><Button size="sm" variant="ghost" onClick={() => void removeStudent(member.userId)} aria-label={`Remove ${member.userId}`}><Trash2 /></Button></div>)}</div>{message && <p className="text-sm text-emerald-700">{message}</p>}</CardContent></Card><Card><CardHeader><CardTitle>Published topics</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{topics.filter((topic) => topic.status === 'published').length}</p><p className="text-sm text-slate-500">{topics.filter((topic) => topic.deliveryMode === 'assigned').length} assigned to the cohort</p></CardContent></Card></section><Card><CardHeader><CardTitle>Student assignment progress</CardTitle></CardHeader><CardContent className="space-y-2">{learners.length ? learners.map((learner) => <p key={learner.userId} className="text-sm text-slate-600">{learner.userId}: {learner.completedTopics} complete · {learner.activeTopics} active</p>) : <p className="text-sm text-slate-500">No organization assignment progress yet.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Publish a structured topic</CardTitle></CardHeader><CardContent className="space-y-3"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Topic title" /><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will students learn?" /><Textarea value={objectives} onChange={(event) => setObjectives(event.target.value)} placeholder={'Objectives, one per line\nTrace a linked list\nImplement insertion'} /><Input value={estimatedMinutes} type="number" min="1" max="600" onChange={(event) => setEstimatedMinutes(event.target.value)} placeholder="Estimated minutes" /><Textarea value={resources} onChange={(event) => setResources(event.target.value)} placeholder={'Optional resources, one per line\nArticle | https://example.com | read\nVideo | https://example.com | watch'} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={assigned} onChange={(event) => setAssigned(event.target.checked)} /> Assign to every organization student</label><Button onClick={() => void publish()} disabled={!title.trim() || !description.trim() || !objectives.trim()}>Publish topic</Button></CardContent></Card><section className="grid gap-3 sm:grid-cols-2">{topics.map((topic) => <Card key={topic.id}><CardContent className="p-4"><div className="flex justify-between gap-2"><strong>{topic.title}</strong><Badge variant={topic.deliveryMode === 'assigned' ? 'default' : 'secondary'}>{topic.deliveryMode}</Badge></div><p className="mt-2 text-sm text-slate-500">{topic.objectives.length} objectives · {topic.status}</p></CardContent></Card>)}</section></main>
}
