type ReviewSaveBody = {
  askId?: unknown
  topicId?: unknown
  question?: unknown
  answer?: unknown
}

type StoredAsk = {
  topicId?: unknown
  question?: unknown
  answer?: unknown
} | null

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

export function reviewInput(body: ReviewSaveBody, ask: StoredAsk) {
  const askId = text(body.askId)
  const question = text(body.question) ?? text(ask?.question)
  const answer = text(body.answer) ?? text(ask?.answer)

  if (!askId || !question || !answer) return null

  return {
    askId,
    topicId: text(body.topicId) ?? text(ask?.topicId),
    question,
    answer,
  }
}
