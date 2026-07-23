import { NextRequest, NextResponse } from 'next/server'
import { ZodError, ZodType } from 'zod'
import { validateOrigin } from '@/lib/csrf'
import { rateLimitIP } from '@/lib/rate-limit'

export type ApiHandler<T> = (data: T, request: NextRequest) => Promise<NextResponse>

export function withValidation<T>(
  schema: ZodType<T>,
  handler: ApiHandler<T>,
  options?: { csrf?: boolean; rateLimit?: boolean },
) {
  return async (request: NextRequest) => {
    try {
      if (options?.csrf !== false) {
        if (!validateOrigin(request)) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }

      if (options?.rateLimit !== false) {
        const rl = rateLimitIP(request)
        if (!rl.allowed) {
          return NextResponse.json(
            { error: 'Too many requests' },
            {
              status: 429,
              headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
            },
          )
        }
      }

      let body: unknown
      const contentType = request.headers.get('content-type') || ''

      if (contentType.includes('multipart/form-data')) {
        body = await request.formData()
      } else {
        body = await request.json()
      }

      const parsed = schema.parse(body)
      return await handler(parsed, request)
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const details = error.issues.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }))
        return NextResponse.json({ error: 'Validation failed', details }, { status: 400 })
      }

      if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
      }

      const message = error instanceof Error ? error.message : 'Internal server error'
      console.error('[API Error]', message, error)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }
}

export function successResponse(data: unknown, status = 200) {
  return NextResponse.json({ success: true, ...(data as Record<string, unknown>) }, { status })
}

export function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}
