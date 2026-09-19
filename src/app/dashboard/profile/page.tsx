'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Profile = { name: string; email: string; phone: string; college: string; branch: string; year: number; activeTrack: string; github?: string; linkedin?: string; leetcode?: string }
type Summary = { points: number; streakDays: number; recentActivity: Array<{ kind: string; topicId: string; occurredAt: string }> }

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { void fetch('/api/profile').then(async (response) => {
    const data = await response.json()
    if (response.ok) { setProfile(data.profile); setSummary(data.learningSummary) }
    else setMessage(data.error || 'Could not load your profile')
  }).catch(() => setMessage('Could not load your profile')) }, [])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!profile) return
    setSaving(true); setMessage('')
    const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile) })
    const data = await response.json()
    setSaving(false)
    if (!response.ok) { setMessage(data.error || 'Could not save your profile'); return }
    setProfile(data.profile); setMessage('Profile saved')
  }
  const update = (key: keyof Profile, value: string | number) => setProfile((current) => current ? { ...current, [key]: value } : current)

  if (!profile) return <div className="mx-auto max-w-2xl py-12 text-slate-500">{message || 'Loading profile…'}</div>
  return <main className="mx-auto max-w-3xl space-y-6"><header><p className="text-sm font-semibold text-emerald-700">STUDENT PROFILE</p><h2 className="mt-1 text-3xl font-bold">Your learning identity</h2><p className="mt-2 text-slate-500">Keep your academic details up to date. Your Google email is managed by sign-in.</p></header><section className="grid gap-3 sm:grid-cols-3"><Metric label="Points" value={summary?.points ?? 0} /><Metric label="Learning streak" value={(summary?.streakDays ?? 0) + ' day' + (summary?.streakDays === 1 ? '' : 's')} /><Metric label="Recent actions" value={summary?.recentActivity.length ?? 0} /></section><Card><CardHeader><CardTitle>Edit profile</CardTitle></CardHeader><CardContent><form onSubmit={save} className="grid gap-4 sm:grid-cols-2"><ProfileField label="Full name" value={profile.name} onChange={(value) => update('name', value)} required /><div><Label>Google email</Label><Input className="mt-2" value={profile.email} disabled /></div><ProfileField label="10-digit phone number" value={profile.phone} onChange={(value) => update('phone', value.replace(/\D/g, '').slice(0, 10))} required /><ProfileField label="College / university" value={profile.college} onChange={(value) => update('college', value)} required /><ProfileField label="Course / branch" value={profile.branch} onChange={(value) => update('branch', value)} required /><div><Label htmlFor="profile-year">Current year</Label><select id="profile-year" value={profile.year} onChange={(event) => update('year', Number(event.target.value))} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3">{[1, 2, 3, 4].map((year) => <option key={year} value={year}>Year {year}</option>)}</select></div><ProfileField label="GitHub URL" value={profile.github || ''} onChange={(value) => update('github', value)} type="url" /><ProfileField label="LinkedIn URL" value={profile.linkedin || ''} onChange={(value) => update('linkedin', value)} type="url" /><ProfileField label="LeetCode URL" value={profile.leetcode || ''} onChange={(value) => update('leetcode', value)} type="url" />{message && <p className="sm:col-span-2 text-sm text-emerald-700">{message}</p>}<div className="sm:col-span-2 flex justify-end"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></div></form></CardContent></Card></main>
}

function Metric({ label, value }: { label: string; value: string | number }) { return <Card><CardContent className="p-4"><p className="text-2xl font-bold">{value}</p><p className="text-sm text-slate-500">{label}</p></CardContent></Card> }
function ProfileField({ label, value, onChange, required, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string }) { const id = 'profile-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-'); return <div><Label htmlFor={id}>{label}</Label><Input id={id} className="mt-2" type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} /></div> }
