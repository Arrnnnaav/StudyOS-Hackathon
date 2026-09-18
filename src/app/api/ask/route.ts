import { auth } from '@/lib/auth'
import { getExtensionToken, createAsk, trackEvent } from '@/lib/db'
import { NextResponse } from 'next/server'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1'
})

const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0'

export async function POST(request: Request) {
  let extensionSessionToken: string | null = null
  let userId: string | null = null
  let topicId: string | null = null
  let context: any = null
  let question: string | null = null
  let askId = ''

  try {
    const session = await auth()
    
    // Try extension session token first
    const body = await request.json()
    extensionSessionToken = body.extension_session_token || null
    topicId = body.topic_id || null
    context = body.context
    question = body.question

    if (!context || !question) {
      return NextResponse.json({ error: 'Context and question required' }, { status: 400 })
    }

    // Resolve user
    if (extensionSessionToken) {
      const tokenData = await getExtensionToken(extensionSessionToken)
      if (!tokenData || new Date(tokenData.expiresAt) < new Date()) {
        return NextResponse.json({ error: 'Invalid or expired extension token' }, { status: 401 })
      }
      userId = tokenData.userId
    } else if (session?.user?.id) {
      userId = session.user.id
    } else {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    askId = crypto.randomUUID()
    const startTime = Date.now()

    // Build prompt
    const prompt = buildPrompt(context, question)
    
    // Call Bedrock
    const response = await bedrock.send(new InvokeModelCommand({
      ModelId: MODEL_ID,
      ContentType: 'application/json',
      Accept: 'application/json',
      Body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1000,
        temperature: 0.3,
        system: getSystemPrompt(),
        messages: [{ role: 'user', content: prompt }]
      })
    }))

    const responseBody = JSON.parse(new TextDecoder().decode(response.body))
    const answer = responseBody.content[0].text
    const latencyMs = Date.now() - startTime

    // Extract grounding
    const grounding = extractGrounding(context, answer)

    // Check for insufficient context
    const insufficientContext = answer.toLowerCase().includes('insufficient') || 
                                 answer.toLowerCase().includes('cannot answer') ||
                                 answer.toLowerCase().includes('not enough information')

    // Persist ask
    const now = new Date().toISOString()
    await createAsk({
      id: askId,
      userId,
      topicId,
      domain: context.domain,
      pageTitle: context.page_title,
      selectedText: context.selected_text,
      nearbyBefore: context.nearby_before,
      nearbyAfter: context.nearby_after,
      question,
      answer,
      model: MODEL_ID,
      latencyMs,
      helpful: null,
      feedbackReason: null,
      savedToReview: false,
      createdAt: now
    })

    // Track event
    await trackEvent({
      eventId: crypto.randomUUID(),
      eventName: 'point_ask_submitted',
      timestamp: now,
      userId,
      sessionId: 'web',
      topicId,
      domain: context.domain,
      properties: {
        model: MODEL_ID,
        latencyMs,
        selectedChars: context.selected_text?.length || 0,
        nearbyChars: (context.nearby_before?.length || 0) + (context.nearby_after?.length || 0),
        questionChars: question.length,
        insufficientContext
      }
    })

    return NextResponse.json({
      askId,
      answer,
      grounding,
      insufficientContext,
      latencyMs
    })

  } catch (error) {
    console.error('Ask error:', error)
    
    // Track failure
    if (userId) {
      await trackEvent({
        eventId: crypto.randomUUID(),
        eventName: 'point_ask_failed',
        timestamp: new Date().toISOString(),
        userId,
        sessionId: 'web',
        topicId,
        domain: context?.domain,
        properties: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }

    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}

function getSystemPrompt(): string {
  return `You are a concise tutor for engineering students.

Use only the supplied selected content and nearby context for claims about the selected code/text.

If the provided context is not sufficient to answer reliably, say that clearly: "The selected content doesn't contain enough information to answer this reliably."

Explain:
1. What the selected part does
2. Why it matters  
3. The direct answer to the student's question

Prefer a short example when it improves understanding.

Do not invent file names, line numbers, citations, APIs, or surrounding code that was not provided.`
}

function buildPrompt(context: any, question: string): string {
  return `Selected text:
\`\`\`
${context.selected_text}
\`\`\`

Nearby context (before):
\`\`\`
${context.nearby_before || '(none)'}
\`\`\`

Nearby context (after):
\`\`\`
${context.nearby_after || '(none)'}
\`\`\`

Page: ${context.page_title} (${context.domain})

Question: ${question}`
}

function extractGrounding(context: any, answer: string) {
  const grounding = []
  
  if (context.selected_text && answer.toLowerCase().includes(context.selected_text.toLowerCase().slice(0, 50))) {
    grounding.push({ type: 'selected_text', excerpt: context.selected_text.slice(0, 200) })
  }
  
  if (context.nearby_before && answer.toLowerCase().includes(context.nearby_before.toLowerCase().slice(0, 50))) {
    grounding.push({ type: 'nearby_before', excerpt: context.nearby_before.slice(0, 200) })
  }
  
  if (context.nearby_after && answer.toLowerCase().includes(context.nearby_after.toLowerCase().slice(0, 50))) {
    grounding.push({ type: 'nearby_after', excerpt: context.nearby_after.slice(0, 200) })
  }

  return grounding
}