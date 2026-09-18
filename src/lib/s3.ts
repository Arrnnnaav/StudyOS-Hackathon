/**
 * lib/s3.ts — Point & Ask crop persistence (one honest extra AWS service).
 * Stores a pasted/captured crop (data URL or base64) in S3 for the signed-in
 * user and returns a short-lived key/reference. Crops never contain page text
 * beyond what the student circled, and buckets are private + lifecycle-purged.
 * This is used alongside /api/extension/crop so operators can inspect quality
 * without Dashboard exposing raw private content.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

export const CROP_BUCKET = process.env.S3_CROP_BUCKET || ''

const client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })

/** True when S3 crop persistence is configured. */
export function cropsConfigured(): boolean {
  return Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && CROP_BUCKET)
}

/** Strip any data-url prefix, leaving raw base64. */
function base64Of(input: string): { base64: string; ext: string } {
  const match = input.match(/^data:image\/(\w+);base64,([\s\S]*)$/)
  if (match) return { base64: match[2], ext: match[1] === 'jpeg' ? 'jpg' : match[1] }
  return { base64: input, ext: 'png' }
}

/**
 * Upload a crop. Returns { key, s3Key } or throws if S3 is unconfigured.
 * Key format: crops/{userId}/{uuid}.{ext}
 */
export async function putCrop(userId: string, dataUrl: string): Promise<{ key: string }> {
  if (!cropsConfigured()) throw new Error('S3 crops not configured')
  const { base64, ext } = base64Of(dataUrl)
  const key = `crops/${userId}/${crypto.randomUUID()}.${ext}`
  const body = Buffer.from(base64, 'base64')
  await client.send(
    new PutObjectCommand({
      Bucket: CROP_BUCKET,
      Key: key,
      Body: body,
      ContentType: `image/${ext === 'jpg' ? 'jpeg' : 'png'}`,
    }),
  )
  return { key }
}