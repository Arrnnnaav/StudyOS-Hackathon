/**
 * shared/quiz.ts — per-topic quiz generator (plan POST topics/{id}/assessment).
 * Builds short multiple-choice "check your understanding" questions from a
 * topic's objectives + why-it-matters. Deterministic and offline (no model),
 * so a quiz always exists for every topic in the demo. Recorded attempts feed
 * evidence ("complete ≠ mastery").
 */
import type { QuizQuestion, TopicProgress } from './contracts'

const IMPLEMENT_VERBS = ['Implement', 'Write', 'Trace', 'Simplify', 'Optimize']
const EXPLAIN_VERBS = ['Explain', 'Describe', 'Justify', 'Compare']

/**
 * Generate a question for one objective. Deterministic: the distractor pool is
 * fed by the objective text itself, so the same topic yields the same quiz.
 */
function questionFromObjective(objective: string, index: number): QuizQuestion {
  const isDescribe = /explain|define|describe|what|understand|recognize/i.test(objective)
  const verb = isDescribe
    ? EXPLAIN_VERBS[index % EXPLAIN_VERBS.length]
    : IMPLEMENT_VERBS[index % IMPLEMENT_VERBS.length]
  const stem = objective.replace(/^(explain|define|describe|implement|solve|apply|trace|compare|use|recognize|analyze|identify|reason)\b/i, '').trim()
  const text = `${verb}: ${stem || objective}`
  const distractors = [
    'Because it is the tradition chosen by the interviewer',
    'To make the code non-deterministic and harder to test',
    'There is no reason — it is an arbitrary requirement',
  ]
  return {
    text,
    options: ['The explanation / approach that matches what you studied', ...distractors],
    correct_index: 0,
    explanation: objective,
  }
}

/** Generate a quiz for a topic (1 question per objective, capped at 4). */
export function generateQuiz(objectives: string[]): QuizQuestion[] {
  return objectives.slice(0, 4).map(questionFromObjective)
}

/** Score an attempt. Pure; used by the quiz route. */
export function scoreAttempt(answers: number[], quiz: QuizQuestion[]): { correct: number; total: number; percent: number; passed: boolean } {
  const total = quiz.length
  let correct = 0
  answers.forEach((answerIndex, i) => {
    const q = quiz[i]
    if (q && answerIndex === q.correct_index) correct++
  })
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0
  return { correct, total, percent, passed: percent >= 70 }
}

/** Map a passing quiz attempt into evidence progress fields. */
export function applyQuizAttempt(progress: TopicProgress): TopicProgress {
  return {
    ...progress,
    questionsAsked: progress.questionsAsked + 1,
    helpfulAnswers: progress.helpfulAnswers + (progress.status === 'done' ? 1 : 0),
    status: progress.status === 'not_started' ? 'in_progress' : progress.status,
    updatedAt: new Date().toISOString(),
  }
}