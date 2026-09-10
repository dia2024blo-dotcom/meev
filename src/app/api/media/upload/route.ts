import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { db } from '@/lib/db'
import { newId } from '@/lib/meev/ids'
import { guard, serverError, badRequest } from '@/lib/meev/guard'
import { clientIp, rateLimit, rateLimitResponse } from '@/lib/meev/rate-limit'
import { checkImageSafety } from '@/lib/meev/nsfw'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BYTES = Number(process.env.MEEV_MAX_UPLOAD_MB || 5) * 1024 * 1024
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

type SniffedType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | null

/** Magic-byte MIME sniffing — never trust Content-Type or filename. */
function sniffMime(buf: Buffer): SniffedType {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 // WEBP
  ) {
    return 'image/webp'
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif'
  return null
}

export async function POST(req: Request) {
  const g = await guard(req)
  if (g.response) return g.response
  try {
    // upload abuse guard: 10 uploads / minute per user
    const rl = rateLimit(`upload:${g.user.id}`, 10, 60_000)
    if (!rl.ok) return rateLimitResponse(rl.retryAfter)

    let form: FormData
    try {
      form = await req.formData()
    } catch {
      return badRequest('Expected multipart/form-data with a "file" field')
    }
    const file = form.get('file')
    if (!file || typeof file === 'string') return badRequest('A file is required')

    // v7: avatar mode — `square=1` center/smart-crops the photo to a perfect
    // square at upload time so it FILLS every circular avatar frame with a
    // balanced composition, no matter the original aspect ratio.
    // (sharp's `attention` strategy keeps the visual subject in frame.)
    const square = form.get('square') === '1'

    const bytes = file.size
    if (bytes === 0) return badRequest('The file is empty')
    if (bytes > MAX_BYTES) {
      return badRequest(`File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB)`)
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const mime = sniffMime(buf)
    if (!mime) {
      // log suspicious (non-image) upload attempts
      await db.auditLog
        .create({
          data: {
            id: newId(),
            userId: g.user.id,
            action: 'suspicious_upload',
            ip: clientIp(req),
            meta: JSON.stringify({ size: bytes, declaredType: file.type || '' }),
          },
        })
        .catch(() => null)
      return badRequest('Only image files (JPEG/PNG/WebP/GIF) are allowed')
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    const id = newId()
    const animated = mime === 'image/gif'

    // v5 AI moderation: reject adult/pornographic uploads before they ever
    // hit disk. The vision check runs on a downscaled copy (fast + private).
    try {
      const probe = await sharp(buf)
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer()
      const verdict = await checkImageSafety(probe, 'image/jpeg')
      if (verdict.flagged) {
        await db.auditLog
          .create({
            data: {
              id: newId(),
              userId: g.user.id,
              action: 'nsfw_upload_blocked',
              ip: clientIp(req),
              meta: JSON.stringify({ label: verdict.label, reason: verdict.reason, size: bytes }),
            },
          })
          .catch(() => null)
        return badRequest(
          '🚫 لا يمكن رفع صور إباحية أو غير لائقة على Meev — المحتوى البالغ ممنوع / Adult or inappropriate images are not allowed on Meev',
        )
      }
    } catch {
      // moderation probe failed → fail-open (report engine still covers abuse)
    }

    try {
      const base = sharp(buf, animated ? { animated: true } : undefined)
      const meta = await base.metadata()

      // v7: the square avatar crop — applies BEFORE writing any variant.
      // attention = subject-aware crop (faces/people/contrast), falling back
      // to a center crop for flat images. GIFs keep their first frame.
      const cropped = square
        ? sharp(buf).resize(512, 512, { fit: 'cover', position: sharp.strategy.attention })
        : null

      // WebP primary + JPEG fallback + 320px thumb
      await (cropped ?? sharp(buf, animated ? { animated: true } : undefined))
        .webp({ quality: 82 })
        .toFile(path.join(UPLOAD_DIR, `${id}.webp`))
      await (cropped ?? sharp(buf)) // JPEG fallback takes the first frame of GIFs
        .jpeg({ quality: 85 })
        .toFile(path.join(UPLOAD_DIR, `${id}.jpg`))
      await (cropped ?? sharp(buf, animated ? { animated: true } : undefined))
        .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path.join(UPLOAD_DIR, `${id}_thumb.webp`))

      return Response.json({
        url: `/uploads/${id}.webp`,
        fallbackUrl: `/uploads/${id}.jpg`,
        thumbUrl: `/uploads/${id}_thumb.webp`,
        width: square ? 512 : (meta.width ?? null),
        height: square ? 512 : (meta.height ?? null),
        bytes,
      })
    } catch (decodeErr) {
      // magic bytes looked like an image but the payload is corrupt/truncated —
      // that's a client error, not a 500
      console.warn('[meev:api] image decode failed (likely corrupt upload):', (decodeErr as Error).message)
      return badRequest('That image file looks corrupt or truncated')
    }
  } catch (err) {
    return serverError(err)
  }
}
