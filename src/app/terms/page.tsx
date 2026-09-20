import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service',
  description: 'The terms for using LearningHQ and Point & Ask.',
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-14 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50">
      <article className="mx-auto max-w-3xl space-y-8">
        <Link href="/" className="text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">← LearningHQ</Link>
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Terms</p>
          <h1 className="text-4xl font-bold">Terms of Service</h1>
          <p className="text-neutral-600 dark:text-neutral-300">These terms describe the rules for using LearningHQ and the Point &amp; Ask browser extension.</p>
        </header>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Using LearningHQ</h2>
          <p>Use LearningHQ for lawful learning, teaching, and organization activities. Keep your account secure and provide accurate details when completing your profile.</p>
          <p>Organization administrators may invite and manage students only for organizations they are authorized to represent.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">AI-assisted answers</h2>
          <p>Ask, Research Mode, and Point &amp; Ask provide learning assistance. AI-generated answers and public-web citations can be incomplete or inaccurate, so verify important information with reliable sources.</p>
          <p>Do not submit sensitive personal, financial, confidential, illegal, or harmful material for AI processing.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Acceptable use</h2>
          <p>Do not misuse the service, bypass rate limits or access controls, interfere with other users, upload harmful content, or use generated material to facilitate cheating, abuse, or unlawful conduct.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Content and availability</h2>
          <p>Publishers and organization administrators are responsible for the learning material they create or share. Features and providers may change as the service evolves, including to protect security and reliability.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Privacy</h2>
          <p>Our <Link href="/privacy" className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">Privacy Policy</Link> explains the learning data, extension context, and AI processing used to provide the service.</p>
        </section>
      </article>
    </main>
  )
}
