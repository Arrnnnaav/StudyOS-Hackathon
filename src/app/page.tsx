'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, BookOpen, Target, Zap } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 lg:py-32 px-6">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-100 dark:bg-neutral-800 text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            AWS First Commit Hackathon • Live Demo
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 mb-6">
            Know what to learn today.{' '}
            <span className="text-emerald-600 dark:text-emerald-400">Understand what stops you.</span>
          </h1>
          
          <p className="text-xl lg:text-2xl text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto mb-10">
            You have YouTube, LeetCode, GitHub, and AI. But none of them tells you 
            <strong>what to learn today</strong> — and when you get stuck, that question disappears.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signin">
              <Button size="lg" className="w-full sm:w-auto gap-2">
                Start DSA Foundations
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="#demo">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Watch 90-sec Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section id="demo" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-neutral-200 dark:border-neutral-800">
              <CardHeader>
                <Target className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mb-2" />
                <CardTitle>A roadmap that tells you what is next</CardTitle>
                <CardDescription>
                  Opinionated DSA curriculum with prerequisites. Today screen shows exactly one next action with reasoning.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-neutral-200 dark:border-neutral-800">
              <CardHeader>
                <Zap className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mb-2" />
                <CardTitle>Point & Ask when something is confusing</CardTitle>
                <CardDescription>
                  Select any code or text on GitHub, LeetCode, docs. Get a grounded explanation from AWS Bedrock with citations.
                </CardDescription>
              </CardHeader>
            </Card>
            
            <Card className="border-neutral-200 dark:border-neutral-800">
              <CardHeader>
                <BookOpen className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mb-2" />
                <CardTitle>Questions return later as reviews</CardTitle>
                <CardDescription>
                  Mark answers "Helpful" → Save to Review → Spaced repetition brings it back. Questions become learning evidence.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20 px-6 bg-neutral-100 dark:bg-neutral-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-neutral-950 dark:text-neutral-50">
            Built on AWS
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 max-w-4xl mx-auto">
            {[
              { name: 'Amplify', desc: 'Hosting' },
              { name: 'Cognito', desc: 'Auth' },
              { name: 'API Gateway', desc: 'API' },
              { name: 'Lambda', desc: 'Compute' },
              { name: 'DynamoDB', desc: 'State' },
              { name: 'Bedrock', desc: 'AI' },
              { name: 'CloudWatch', desc: 'Observability' }
            ].map(({ name, desc }) => (
              <div key={name} className="text-center p-4 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
                <div className="font-semibold text-neutral-950 dark:text-neutral-50">{name}</div>
                <div className="text-sm text-neutral-500 dark:text-neutral-400">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-neutral-950 dark:text-neutral-50 mb-4">
            Ready to stop wondering what to study?
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400 mb-8">
            Join 500+ engineering students who get a daily study plan that actually works.
          </p>
          <Link href="/auth/signin">
            <Button size="lg" className="gap-2">
              Start Free — No Card Required
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}