/**
 * shared/today.ts — pure Today selection algorithm (plan §7.4).
 * No LLM, no I/O. Unit-tested. Lives here so the app and any server code
 * share one implementation (ported from the studyos mono-repo).
 *
 * Decision order:
 *   1. A review is due            → review is today's first action
 *   2. A topic is in progress     → continue it
 *   3. Otherwise                  → first topic (curriculum order) that is
 *                                   not done and whose prerequisites are done
 *   4. Everything reachable done  → "done"
 */
import type { Topic } from '@/data/dsa-curriculum'
import type { TopicStatus } from './contracts'

export type StatusMap = Readonly<Record<string, TopicStatus>>

/** Build a lookup map from raw progress rows ({ topicId, status }). */
export function toStatusMap(
  rows: { topicId: string; status?: string }[],
): StatusMap {
  const map: Record<string, TopicStatus> = {}
  for (const row of rows) {
    const s = row.status as TopicStatus | undefined
    if (s) map[row.topicId] = s
  }
  return map
}

export function statusOf(map: StatusMap, topicId: string): TopicStatus {
  return map[topicId] ?? 'not_started'
}

export function prerequisitesDone(topic: Topic, map: StatusMap): boolean {
  return topic.prerequisites.every((id) => statusOf(map, id) === 'done')
}

/** Titles of the done prerequisites — powers the "Why now" line. */
export function donePrerequisiteTitles(
  topic: Topic,
  topics: readonly Topic[],
  map: StatusMap,
): string[] {
  return topic.prerequisites
    .filter((id) => statusOf(map, id) === 'done')
    .map((id) => topics.find((t) => t.id === id)?.title ?? id)
}

export type TodayPick =
  | { kind: 'review'; reviewsDue: number; topicId?: string; whyNow: string }
  | { kind: 'topic'; topic: Topic; continued: boolean; whyNow: string }
  | { kind: 'done'; whyNow: string }

export function todayPick(
  topics: readonly Topic[],
  map: StatusMap,
  reviewsDue: number,
  reviewTopicId?: string,
): TodayPick {
  // 1. Reviews due come first.
  if (reviewsDue > 0) {
    return {
      kind: 'review',
      reviewsDue,
      topicId: reviewTopicId,
      whyNow:
        reviewsDue === 1
          ? '1 review is due. Spaced repetition beats re-learning — do it first.'
          : `${reviewsDue} reviews are due. Spaced repetition beats re-learning — clear them first.`,
    }
  }

  // 2. Continue the earliest in-progress topic.
  const inProgress = topics.find((t) => statusOf(map, t.id) === 'in_progress')
  if (inProgress) {
    return {
      kind: 'topic',
      topic: inProgress,
      continued: true,
      whyNow: 'You already started this topic — finish what you began before switching context.',
    }
  }

  // 3. First not-done topic whose prerequisites are all done.
  for (const topic of topics) {
    if (statusOf(map, topic.id) === 'done') continue
    if (!prerequisitesDone(topic, map)) continue
    const done = donePrerequisiteTitles(topic, topics, map)
    const whyNow =
      done.length > 0
        ? `You have completed ${done.join(' and ')}. This is the next prerequisite-ready topic.`
        : 'This is the first topic on your roadmap — no prerequisites needed.'
    return { kind: 'topic', topic, continued: false, whyNow }
  }

  // 4. Everything reachable is done (or locked behind prereqs).
  const allDone = topics.every((t) => statusOf(map, t.id) === 'done')
  return {
    kind: 'done',
    whyNow: allDone
      ? 'You finished every topic on this track. Mixed revision, or wait for the next track.'
      : 'The remaining topics are locked behind prerequisites — finish a topic to unlock them.',
  }
}

/** Count of done topics, and total. */
export function progressStats(topics: readonly Topic[], map: StatusMap): { done: number; total: number } {
  return {
    done: topics.filter((t) => statusOf(map, t.id) === 'done').length,
    total: topics.length,
  }
}

/** Compute the evidence label for a topic (plan §7.6). Pure. */
export function evidenceLabel(o: {
  status: TopicStatus
  questionsAsked: number
  reviewsCompleted: number
}): 'No Evidence' | 'Started' | 'Developing' | 'Reviewed' {
  // Reviews completed is the strongest evidence -> marks mastery of understanding.
  if (o.reviewsCompleted > 0) return 'Reviewed'
  // Any question asked or in-progress work -> developing.
  if (o.status === 'in_progress' || o.questionsAsked > 0) return 'Developing'
  // Done the topic but no supporting evidence -> still developing.
  if (o.status === 'done' && o.reviewsCompleted === 0) return 'Developing'
  return 'No Evidence'
}