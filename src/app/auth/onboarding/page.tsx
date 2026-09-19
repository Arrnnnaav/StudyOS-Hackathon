'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type FormFields = {
  name: string; phone: string; college: string; branch: string; year: string; activeTrack: string
  github: string; linkedin: string; leetcode: string
}

const initialFields: FormFields = { name: '', phone: '', college: '', branch: '', year: '', activeTrack: 'dsa-foundations', github: '', linkedin: '', leetcode: '' }

export default function OnboardingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [fields, setFields] = useState<FormFields>(initialFields)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  if (status === 'loading') return <div className="min-h-screen grid place-items-center">Loading…</div>
  if (status === 'unauthenticated') { router.replace('/auth/signin'); return null }

  const update = (key: keyof FormFields, value: string) => setFields((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const response = await fetch('/api/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, name: fields.name || session?.user?.name || '', year: Number(fields.year) }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'We could not save your profile')
      router.replace('/dashboard/today')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We could not save your profile')
    } finally { setSaving(false) }
  }

  return <main className="min-h-screen bg-neutral-50 px-4 py-10 dark:bg-neutral-950"><Card className="mx-auto w-full max-w-2xl"><CardHeader><CardTitle>Set up your learning profile</CardTitle><CardDescription>Complete this once to personalise your StudyOS plan. Your Google email stays read-only.</CardDescription></CardHeader><CardContent><form onSubmit={submit} className="grid gap-5 sm:grid-cols-2"><Field label="Full name" value={fields.name || session?.user?.name || ''} onChange={(value) => update('name', value)} required /><div><Label>Google email</Label><Input value={session?.user?.email || ''} disabled className="mt-2" /></div><Field label="10-digit phone number" value={fields.phone} onChange={(value) => update('phone', value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" required /><Field label="College / university" value={fields.college} onChange={(value) => update('college', value)} required /><Field label="Course / branch" value={fields.branch} onChange={(value) => update('branch', value)} required /><div><Label htmlFor="year">Current year</Label><select id="year" required value={fields.year} onChange={(event) => update('year', event.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Select year</option>{[1, 2, 3, 4].map((year) => <option key={year} value={year}>Year {year}</option>)}</select></div><div className="sm:col-span-2"><Label htmlFor="track">Learning track</Label><select id="track" value={fields.activeTrack} onChange={(event) => update('activeTrack', event.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="dsa-foundations">DSA Foundations</option></select></div><p className="sm:col-span-2 text-sm text-neutral-500">Optional public learning profiles</p><Field label="GitHub URL" value={fields.github} onChange={(value) => update('github', value)} type="url" /><Field label="LinkedIn URL" value={fields.linkedin} onChange={(value) => update('linkedin', value)} type="url" /><Field label="LeetCode URL" value={fields.leetcode} onChange={(value) => update('leetcode', value)} type="url" />{error && <p role="alert" className="sm:col-span-2 text-sm text-red-600">{error}</p>}<div className="sm:col-span-2 flex justify-end"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save and open dashboard'}</Button></div></form></CardContent></Card></main>
}

function Field({ label, value, onChange, required, type = 'text', inputMode }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; inputMode?: 'numeric' }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return <div><Label htmlFor={id}>{label}</Label><Input id={id} className="mt-2" value={value} onChange={(event) => onChange(event.target.value)} required={required} type={type} inputMode={inputMode} /></div>
}
