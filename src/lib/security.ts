/**
 * Security utilities — rate limiting, CSRF protection, input validation
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── In-Memory Rate Limiter ────────────────────────────────
// Production: replace with Redis-backed limiter (e.g. @upstash/ratelimit)

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (now > entry.resetAt) rateLimitStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

export function rateLimit(
  identifier: string,
  { maxRequests = 60, windowMs = 60_000 }: { maxRequests?: number; windowMs?: number } = {}
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  entry.count++;
  const allowed = entry.count <= maxRequests;
  return { allowed, remaining: Math.max(0, maxRequests - entry.count), resetAt: entry.resetAt };
}

export function rateLimitResponse(remaining: number, resetAt: number): NextResponse {
  return NextResponse.json(
    { ok: false, error: 'Too many requests. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        'X-RateLimit-Remaining': String(remaining),
      },
    }
  );
}

// ─── CSRF Origin Check ─────────────────────────────────────

export function checkOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');

  // Allow requests with no origin (same-origin non-browser)
  if (!origin) return true;

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

// ─── Input Sanitizer ────────────────────────────────────────

export function sanitizeString(input: unknown, maxLength = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Strip control chars
    .substring(0, maxLength)
    .trim();
}

export function validatePositiveNumber(input: unknown, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}): number | null {
  if (typeof input !== 'number' || !Number.isFinite(input)) return null;
  if (input < min || input > max) return null;
  return input;
}

// ─── Safe Error Response ────────────────────────────────────

export function safeError(error: unknown, fallbackMessage = 'Internal server error'): NextResponse {
  const isDev = process.env.NODE_ENV === 'development';
  const message = isDev && error instanceof Error ? error.message : fallbackMessage;
  console.error('[API Error]', error);
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}
