import Link from 'next/link'

export const metadata = {
  title: 'Privacy',
  description: 'How LearningHQ handles learning data and extension requests.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-14 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <article className="mx-auto max-w-3xl space-y-8">
        <Link href="/" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">← LearningHQ</Link>
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Privacy</p>
          <h1 className="text-4xl font-bold">Your learning data stays under your control.</h1>
          <p className="text-neutral-600 dark:text-neutral-300">This page describes the current LearningHQ website and Point &amp; Ask browser extension.</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">What we collect</h2>
          <p>We store the account details and learning activity needed to provide your dashboard, progress, saved reviews, and organization access.</p>
          <p>The extension sends only the selected text, nearby context needed to answer it, your question, and basic page metadata when you choose Ask.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">AI and public-web research</h2>
          <p>Normal Ask sends your selected text, nearby context, question, page metadata, and the most recent previous questions and answers in that learning context to Gemini to generate an explanation.</p>
          <p>When you explicitly enable Research Mode, the selected text and question may be sent to Gemini Google Search to find current public-web sources. If that provider is unavailable, the question is sent to DuckDuckGo to retrieve public links before Gemini prepares a cited answer from those links.</p>
          <p>Research Mode displays only provider-returned source links. It is optional and rate-limited.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Security</h2>
          <p>AI credentials and application secrets stay server-side and are never included in the browser extension. The extension pairs with your account using a short-lived code and an expiring session token.</p>
          <p>We use AWS-hosted infrastructure for application data and operational security controls.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Your choices</h2>
          <p>You can choose not to use the extension or Research Mode. Do not submit sensitive personal, financial, or confidential material for AI processing.</p>
        </section>
      </article>
    </main>
  )
}
