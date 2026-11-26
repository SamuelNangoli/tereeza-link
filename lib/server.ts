
import 'server-only';

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

import { consumeLimit } from './database';
import { clientIp } from './client-ip';
import { AppError } from './validation';

// Environment configuration
export function env(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new AppError(
      'Service configuration is incomplete.',
      503
    );
  }

  return value;
}

export const site = () =>
  process.env.SITE_URL || 'http://localhost:3000';

// Token generation
export const token = () => randomBytes(24).toString('hex');

// Secure HMAC hashing
export const hash = (value: string) =>
  createHmac('sha256', env('IP_HASH_SECRET'))
    .update(value)
    .digest('hex');

// Timing-safe comparison
export function equal(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);

  return (
    x.length === y.length &&
    timingSafeEqual(x, y)
  );
}

// Request origin validation
export function origin(req: Request): void {
  if (req.headers.get('origin') !== new URL(site()).origin) {
    throw new AppError('Request origin is not allowed.', 403);
  }
}

// Request body validation
export async function body(req: Request) {
  if (Number(req.headers.get('content-length') || 0) > 8192) {
    throw new AppError('Request too large.', 413);
  }

  const text = await req.text();

  if (Buffer.byteLength(text) > 8192) {
    throw new AppError('Request too large.', 413);
  }

  try {
    const data = JSON.parse(text);

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      throw new Error();
    }

    return data;
  } catch {
    throw new AppError('Invalid JSON object.');
  }
}

// Rate limiting
export async function limit(
  req: Request,
  scope: string,
  max: number,
  seconds = 3600
): Promise<void> {
  // Use the shared Vercel client-IP extraction helper.
  // Local development uses a shared fallback identifier.
  const ip = clientIp(req.headers);

  let allowed: boolean;

  try {
    allowed = await consumeLimit(
      hash(scope + ip),
      max,
      seconds
    );
  } catch {
    throw new AppError(
      'Rate limiting unavailable. Try later.',
      503
    );
  }

  if (!allowed) {
    throw new AppError(
      'Too many requests. Try again later.',
      429
    );
  }
}

// Standard API error responses
export function failure(e: unknown) {
  const status = e instanceof AppError ? e.status : 503;

  return Response.json(
    {
      error:
        e instanceof AppError
          ? e.message
          : 'Service temporarily unavailable.',
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        ...(status === 429
          ? { 'Retry-After': '3600' }
          : {}),
      },
    }
  );
}

// Admin session signature
function signature(value: string): string {
  return createHmac('sha256', env('SESSION_SECRET'))
    .update(value)
    .digest('hex');
}

// Admin session generation
export function session(): string {
  const expiry = String(Date.now() + 8 * 3600000);

  return expiry + '.' + signature(expiry);
}

// Admin authentication
export async function admin(): Promise<void> {
  const value =
    (await cookies()).get('tereeza-admin')?.value || '';

  const [expiry, sig] = value.split('.');

  if (
    !expiry ||
    !sig ||
    !equal(sig, signature(expiry)) ||
    !/^\d+$/.test(expiry) ||
    Number(expiry) < Date.now()
  ) {
    throw new AppError('Admin sign-in required.', 401);
  }
}

// Google Web Risk threat screening
export async function threat(url: string): Promise<void> {
  const key = process.env.WEB_RISK_API_KEY;

  if (!key) {
    if (process.env.REQUIRE_THREAT_CHECK === 'true') {
      throw new AppError(
        'Threat screening unavailable.',
        503
      );
    }

    return;
  }

  const params = new URLSearchParams({
    key,
    uri: url,
  });

  for (const type of [
    'MALWARE',
    'SOCIAL_ENGINEERING',
    'UNWANTED_SOFTWARE',
  ]) {
    params.append('threatTypes', type);
  }

  const response = await fetch(
    'https://webrisk.googleapis.com/v1/uris:search?' +
      params,
    {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    }
  );

  if (!response.ok) {
    throw new AppError(
      'Threat screening unavailable.',
      503
    );
  }

  if ((await response.json()).threat) {
    throw new AppError(
      'This URL was flagged as unsafe.',
      422
    );
  }
}
